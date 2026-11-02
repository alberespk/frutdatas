// Testa a migração e as regras de segurança num Postgres em memória (PGlite),
// simulando o que o Supabase fornece (schema auth, auth.uid(), papel authenticated).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const pasta = join(__dirname, "..", "supabase");
const migracoes = readdirSync(join(pasta, "migrations")).sort();

const SIMULA_SUPABASE = `
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
  create role anon;
  grant usage on schema public to authenticated;
  alter default privileges in schema public grant all on tables to authenticated;
`;

const SOCIO = "00000000-0000-0000-0000-00000000000a";
const CAMPO = "00000000-0000-0000-0000-00000000000b";

let db: PGlite;

async function como<T>(usuario: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${usuario}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SIMULA_SUPABASE);
  for (const m of migracoes) await db.exec(readFileSync(join(pasta, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(pasta, "seed.sql"), "utf8"));
  // Cadastros mínimos para os testes (o seed não traz mais dados fictícios).
  await db.exec(`
    insert into public.clientes (nome, prazo_dias) values ('Cliente Teste', 7), ('Cliente Dois', 0);
    insert into public.produtos (nome, unidade) values ('Produto Teste', 'caixa');
    insert into public.fornecedores (nome, tipo) values ('Produtor Teste', 'produtor');
  `);
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${SOCIO}', 'socio@frutdatas.test', '{"nome":"Sócio Teste"}'),
      ('${CAMPO}', 'ajudante@frutdatas.test', '{}');
  `);
}, 60_000);

describe("usuários", () => {
  it("primeiro login vira sócio com letra A; o segundo vira campo com letra B", async () => {
    const r = await db.query<{ nome: string; papel: string; letra: string }>(
      "select nome, papel, letra from public.usuarios order by letra",
    );
    expect(r.rows).toEqual([
      { nome: "Sócio Teste", papel: "socio", letra: "A" },
      { nome: "ajudante", papel: "campo", letra: "B" },
    ]);
  });
});

describe("listas iniciais", () => {
  it("seed traz só classificações, categorias e motivos de perda", async () => {
    const r = await db.query<{ cl: number; ca: number; mo: number; ar: number }>(
      "select (select count(*)::int from classificacoes) cl, (select count(*)::int from categorias_despesa) ca, (select count(*)::int from motivos_perda) mo, (select count(*)::int from areas) ar",
    );
    expect(r.rows[0]).toEqual({ cl: 4, ca: 12, mo: 5, ar: 0 });
  });

  it("limpeza cancela cadastros de exemplo sem lançamentos e preserva os demais", async () => {
    await db.exec(`insert into public.fornecedores (nome, tipo) values ('Sebastião Rodrigues', 'produtor')`);
    await db.exec(readFileSync(join(pasta, "migrations", "20261102000003_remover_dados_exemplo.sql"), "utf8"));
    const r = await db.query<{ nome: string; cancelado: boolean }>(
      "select nome, cancelado_em is not null cancelado from fornecedores order by nome",
    );
    expect(r.rows).toEqual([
      { nome: "Produtor Teste", cancelado: false },
      { nome: "Sebastião Rodrigues", cancelado: true },
    ]);
  });
});

describe("sincronização", () => {
  it("versão mais antiga não sobrescreve a mais nova (última gravação vence)", async () => {
    const id = "10000000-0000-0000-0000-000000000001";
    await como(SOCIO, () =>
      db.exec(`insert into produtos (id, nome, atualizado_em, criado_por) values ('${id}', 'Uva', '2026-11-02 10:00', '${SOCIO}')`),
    );
    await como(SOCIO, () =>
      db.exec(`update produtos set nome = 'Uva antiga', atualizado_em = '2026-11-02 09:00' where id = '${id}'`),
    );
    let r = await db.query<{ nome: string }>(`select nome from produtos where id = '${id}'`);
    expect(r.rows[0].nome).toBe("Uva");

    await como(SOCIO, () =>
      db.exec(`update produtos set nome = 'Uva niágara', atualizado_em = '2026-11-02 11:00' where id = '${id}'`),
    );
    r = await db.query<{ nome: string }>(`select nome from produtos where id = '${id}'`);
    expect(r.rows[0].nome).toBe("Uva niágara");
  });

  it("servidor carimba sincronizado_em a cada gravação", async () => {
    const r = await db.query<{ ok: boolean }>(
      "select bool_and(sincronizado_em >= criado_em) ok from produtos",
    );
    expect(r.rows[0].ok).toBe(true);
  });
});

describe("permissões", () => {
  it("campo não vê clientes; sócio vê", async () => {
    const campo = await como(CAMPO, () => db.query("select id from clientes"));
    const socio = await como(SOCIO, () => db.query("select id from clientes"));
    expect(campo.rows.length).toBe(0);
    expect(socio.rows.length).toBe(2);
  });

  it("campo vê produtos e fornecedores para lançar compras", async () => {
    const r = await como(CAMPO, () => db.query("select id from produtos"));
    expect(r.rows.length).toBeGreaterThan(0);
  });

  it("campo não altera cadastro de produto", async () => {
    await expect(
      como(CAMPO, () => db.exec(`insert into produtos (nome, criado_por) values ('Kiwi', '${CAMPO}')`)),
    ).rejects.toThrow(/row-level security/);
  });

  it("campo pode cadastrar produtor novo na hora da compra", async () => {
    await como(CAMPO, () =>
      db.exec(`insert into fornecedores (nome, tipo, criado_por) values ('Produtor Novo', 'produtor', '${CAMPO}')`),
    );
    const r = await db.query("select id from fornecedores where nome = 'Produtor Novo'");
    expect(r.rows.length).toBe(1);
  });

  it("campo não se promove a sócio", async () => {
    await como(CAMPO, () => db.exec(`update usuarios set papel = 'socio' where id = '${CAMPO}'`));
    const r = await db.query<{ papel: string }>(`select papel from usuarios where id = '${CAMPO}'`);
    expect(r.rows[0].papel).toBe("campo");
  });

  it("campo vê só as próprias compras", async () => {
    const forn = (await db.query<{ id: string }>("select id from fornecedores limit 1")).rows[0].id;
    await como(SOCIO, () =>
      db.exec(`insert into compras (data, fornecedor_id, criado_por) values ('2026-11-02', '${forn}', '${SOCIO}')`),
    );
    await como(CAMPO, () =>
      db.exec(`insert into compras (data, fornecedor_id, criado_por) values ('2026-11-02', '${forn}', '${CAMPO}')`),
    );
    const campo = await como(CAMPO, () => db.query("select id from compras"));
    const socio = await como(SOCIO, () => db.query("select id from compras"));
    expect(campo.rows.length).toBe(1);
    expect(socio.rows.length).toBe(2);
  });
});
