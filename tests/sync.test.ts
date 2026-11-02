// Testa a sincronização offline: banco local (IndexedDB simulado) + servidor falso em memória.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { BancoLocal } from "@/lib/db";
import { gravar, gravarVarios } from "@/lib/repo";
import { enviarFila, receber, sincronizarCom, type ClienteSync } from "@/lib/sync";
import type { Registro } from "@/lib/tabelas";

/** Servidor falso que imita o Supabase: carimba sincronizado_em e aplica "última gravação vence". */
class ServidorFalso implements ClienteSync {
  tabelas = new Map<string, Map<string, Registro>>();
  relogio = Date.parse("2026-11-02T12:00:00Z");
  falharEm: string | null = null;
  chamadasUpsert: { tabela: string; ids: string[] }[] = [];

  linhas(t: string) {
    if (!this.tabelas.has(t)) this.tabelas.set(t, new Map());
    return this.tabelas.get(t)!;
  }

  from(tabela: string) {
    const srv = this;
    return {
      upsert(linhas: Record<string, unknown>[]) {
        return {
          async select() {
            if (srv.falharEm === tabela) return { data: null, error: { message: "violação de regra" } };
            srv.chamadasUpsert.push({ tabela, ids: linhas.map((l) => String(l.id)) });
            const salvos: Registro[] = [];
            for (const l of linhas) {
              const atual = srv.linhas(tabela).get(String(l.id));
              if (atual && String(l.atualizado_em) < String(atual.atualizado_em)) {
                salvos.push(atual);
                continue;
              }
              srv.relogio += 1000;
              const r = { ...(l as Registro), sincronizado_em: new Date(srv.relogio).toISOString() };
              srv.linhas(tabela).set(r.id, r);
              salvos.push(r);
            }
            return { data: salvos, error: null };
          },
        };
      },
      select() {
        return {
          gt(_c: string, valor: string) {
            return {
              order() {
                return {
                  async limit(n: number) {
                    const data = [...srv.linhas(tabela).values()]
                      .filter((r) => String(r.sincronizado_em) > valor)
                      .sort((a, b) => String(a.sincronizado_em).localeCompare(String(b.sincronizado_em)))
                      .slice(0, n);
                    return { data, error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
  }
}

let n = 0;
let celular: BancoLocal;
let servidor: ServidorFalso;
const USUARIO = "00000000-0000-0000-0000-00000000000a";

beforeEach(async () => {
  celular = new BancoLocal(`teste-${++n}`);
  await celular.open();
  servidor = new ServidorFalso();
});

describe("gravação local", () => {
  it("grava no celular com id, autor e data, e põe na fila", async () => {
    const r = await gravar(celular, "produtos", { nome: "Morango" }, USUARIO);
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.criado_por).toBe(USUARIO);
    expect(await celular.t("produtos").get(r.id)).toMatchObject({ nome: "Morango" });
    expect(await celular.fila.count()).toBe(1);
  });

  it("edição mantém criado_por e criado_em", async () => {
    const r = await gravar(celular, "produtos", { nome: "Morango" }, USUARIO);
    const e = await gravar(celular, "produtos", { id: r.id, nome: "Morango bandeja" }, "outro");
    expect(e.criado_por).toBe(USUARIO);
    expect(e.criado_em).toBe(r.criado_em);
  });
});

describe("envio", () => {
  it("envia cada registro uma vez, na versão mais recente, e esvazia a fila", async () => {
    const r = await gravar(celular, "produtos", { nome: "Morango" }, USUARIO);
    await gravar(celular, "produtos", { id: r.id, nome: "Morango tipo 1" }, USUARIO);
    expect(await enviarFila(celular, servidor)).toBe(1);
    expect(servidor.linhas("produtos").get(r.id)?.nome).toBe("Morango tipo 1");
    expect(servidor.linhas("produtos").get(r.id)).not.toHaveProperty("sincronizado_em", undefined);
    expect(await celular.fila.count()).toBe(0);
  });

  it("envia o pai antes dos itens (compra antes dos itens da compra)", async () => {
    const compraId = crypto.randomUUID();
    await gravarVarios(
      celular,
      [
        { tabela: "compras", dados: { id: compraId, data: "2026-11-02" } },
        { tabela: "compra_itens", dados: { compra_id: compraId, quantidade: 10 } },
        { tabela: "compra_itens", dados: { compra_id: compraId, quantidade: 5 } },
      ],
      USUARIO,
    );
    await enviarFila(celular, servidor);
    expect(servidor.chamadasUpsert.map((c) => [c.tabela, c.ids.length])).toEqual([
      ["compras", 1],
      ["compra_itens", 2],
    ]);
  });

  it("se o servidor recusar, mantém na fila e avisa o erro", async () => {
    await gravar(celular, "clientes", { nome: "Sacolão" }, USUARIO);
    servidor.falharEm = "clientes";
    await expect(enviarFila(celular, servidor)).rejects.toThrow(/clientes: violação de regra/);
    expect(await celular.fila.count()).toBe(1);
  });

  it("sem internet nada se perde: o envio posterior sobe tudo", async () => {
    for (const nome of ["A", "B", "C"]) await gravar(celular, "fornecedores", { nome }, USUARIO);
    servidor.falharEm = "fornecedores";
    await expect(enviarFila(celular, servidor)).rejects.toThrow();
    servidor.falharEm = null;
    expect(await enviarFila(celular, servidor)).toBe(3);
    expect(servidor.linhas("fornecedores").size).toBe(3);
  });
});

describe("recebimento", () => {
  it("baixa o que outro celular gravou", async () => {
    const outro = new BancoLocal(`teste-outro-${n}`);
    await gravar(outro, "clientes", { nome: "Box 17 CEASA" }, USUARIO);
    await enviarFila(outro, servidor);

    expect(await receber(celular, servidor, ["clientes"])).toBe(1);
    const lista = await celular.t("clientes").toArray();
    expect(lista.map((c) => c.nome)).toEqual(["Box 17 CEASA"]);
  });

  it("não sobrescreve uma edição local que ainda não subiu", async () => {
    const r = await gravar(celular, "produtos", { nome: "Original" }, USUARIO);
    await sincronizarCom(celular, servidor, ["produtos"]);

    // Outro aparelho altera no servidor; aqui alteramos offline.
    servidor.relogio += 1000;
    servidor.linhas("produtos").set(r.id, {
      ...servidor.linhas("produtos").get(r.id)!,
      nome: "Do servidor",
      sincronizado_em: new Date(servidor.relogio + 60_000).toISOString(),
    });
    await gravar(celular, "produtos", { id: r.id, nome: "Local" }, USUARIO);
    await receber(celular, servidor, ["produtos"]);
    expect((await celular.t("produtos").get(r.id))?.nome).toBe("Local");
  });

  it("dois celulares editando o mesmo registro: vale a edição mais recente", async () => {
    const outro = new BancoLocal(`teste-outro2-${n}`);
    const r = await gravar(celular, "produtos", { nome: "Maracujá" }, USUARIO);
    await sincronizarCom(celular, servidor, ["produtos"]);
    await sincronizarCom(outro, servidor, ["produtos"]);

    await gravar(outro, "produtos", { id: r.id, nome: "Maracujá azedo (antigo)" }, USUARIO);
    await new Promise((ok) => setTimeout(ok, 5));
    await gravar(celular, "produtos", { id: r.id, nome: "Maracujá azedo" }, USUARIO);

    // O mais novo sobe primeiro; o mais antigo chega depois e é ignorado.
    await sincronizarCom(celular, servidor, ["produtos"]);
    await sincronizarCom(outro, servidor, ["produtos"]);
    expect(servidor.linhas("produtos").get(r.id)?.nome).toBe("Maracujá azedo");
    expect((await outro.t("produtos").get(r.id))?.nome).toBe("Maracujá azedo");
  });
});
