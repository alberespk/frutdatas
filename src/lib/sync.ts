import type { BancoLocal } from "./db";
import { TABELAS, type NomeTabela, type Registro } from "./tabelas";

/** Parte do cliente Supabase que a sincronização usa (facilita testar). */
export interface ClienteSync {
  from(tabela: string): {
    upsert(linhas: Record<string, unknown>[]): {
      select(): PromiseLike<{ data: Registro[] | null; error: { message: string } | null }>;
    };
    select(colunas: string): {
      gt(coluna: string, valor: string): {
        order(coluna: string, opcoes: { ascending: boolean }): {
          limit(n: number): PromiseLike<{ data: Registro[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
}

export interface ResultadoSync {
  enviados: number;
  recebidos: number;
  erro?: string;
}

const PAGINA = 1000;
/** Volta o cursor um pouco para não perder gravações que terminaram fora de ordem no servidor. */
const MARGEM_MS = 30_000;

/** Campos que só o servidor define. */
function paraEnvio(r: Registro): Record<string, unknown> {
  const { sincronizado_em: _s, ...resto } = r;
  return resto;
}

/** Envia a fila, na ordem em que os lançamentos foram feitos (pai antes dos itens). */
export async function enviarFila(banco: BancoLocal, cliente: ClienteSync): Promise<number> {
  const fila = await banco.fila.orderBy("seq").toArray();
  if (!fila.length) return 0;

  // Cada registro vai uma vez só (a versão mais recente), na posição da 1ª vez que entrou na fila.
  const ordem: { tabela: NomeTabela; id: string; seqs: number[] }[] = [];
  const porChave = new Map<string, (typeof ordem)[number]>();
  for (const item of fila) {
    const chave = `${item.tabela}:${item.id}`;
    const existente = porChave.get(chave);
    if (existente) existente.seqs.push(item.seq!);
    else {
      const novo = { tabela: item.tabela, id: item.id, seqs: [item.seq!] };
      porChave.set(chave, novo);
      ordem.push(novo);
    }
  }

  // Agrupa sequências seguidas da mesma tabela num único envio.
  const lotes: (typeof ordem)[] = [];
  for (const item of ordem) {
    const ultimo = lotes.at(-1);
    if (ultimo && ultimo[0].tabela === item.tabela) ultimo.push(item);
    else lotes.push([item]);
  }

  let enviados = 0;
  for (const lote of lotes) {
    const tabela = lote[0].tabela;
    const linhas = (await banco.t(tabela).bulkGet(lote.map((l) => l.id))).filter(
      (r): r is Registro => !!r,
    );
    if (linhas.length) {
      const { data, error } = await cliente.from(tabela).upsert(linhas.map(paraEnvio)).select();
      if (error) throw new Error(`${tabela}: ${error.message}`);
      const seqs = lote.flatMap((l) => l.seqs);
      await banco.transaction("rw", banco.t(tabela), banco.fila, async () => {
        await banco.fila.bulkDelete(seqs);
        // Guarda a versão do servidor, a não ser que o registro tenha sido editado durante o envio.
        for (const r of data ?? []) {
          const pendente = await banco.fila.where("id").equals(r.id).count();
          if (!pendente) await banco.t(tabela).put(r);
        }
      });
    } else {
      await banco.fila.bulkDelete(lote.flatMap((l) => l.seqs));
    }
    enviados += linhas.length;
  }
  return enviados;
}

/** Baixa o que mudou no servidor desde a última vez, tabela por tabela. */
export async function receber(
  banco: BancoLocal,
  cliente: ClienteSync,
  tabelas: readonly NomeTabela[] = TABELAS,
): Promise<number> {
  let recebidos = 0;
  for (const tabela of tabelas) {
    const chaveCursor = `cursor:${tabela}`;
    let cursor = ((await banco.meta.get(chaveCursor))?.valor as string) ?? "1970-01-01T00:00:00Z";
    let maior: string | null = null;
    for (;;) {
      const { data, error } = await cliente
        .from(tabela)
        .select("*")
        .gt("sincronizado_em", cursor)
        .order("sincronizado_em", { ascending: true })
        .limit(PAGINA);
      if (error) throw new Error(`${tabela}: ${error.message}`);
      const linhas = data ?? [];
      if (!linhas.length) break;
      await banco.transaction("rw", banco.t(tabela), banco.fila, async () => {
        for (const r of linhas) {
          // Edição local ainda não enviada tem prioridade até subir.
          const pendente = await banco.fila.where("id").equals(r.id).count();
          if (!pendente) await banco.t(tabela).put(r);
        }
      });
      recebidos += linhas.length;
      cursor = linhas.at(-1)!.sincronizado_em as string;
      maior = cursor;
      if (linhas.length < PAGINA) break;
    }
    if (maior) {
      const recuado = new Date(new Date(maior).getTime() - MARGEM_MS).toISOString();
      await banco.meta.put({ chave: chaveCursor, valor: recuado });
    }
  }
  return recebidos;
}

export async function sincronizarCom(
  banco: BancoLocal,
  cliente: ClienteSync,
  tabelas: readonly NomeTabela[] = TABELAS,
): Promise<ResultadoSync> {
  const enviados = await enviarFila(banco, cliente);
  const recebidos = await receber(banco, cliente, tabelas);
  return { enviados, recebidos };
}
