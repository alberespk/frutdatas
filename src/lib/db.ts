import Dexie, { type Table } from "dexie";
import { TABELAS, type NomeTabela, type Registro } from "./tabelas";

/** Um lançamento esperando para subir ao servidor. */
export interface ItemFila {
  seq?: number;
  tabela: NomeTabela;
  id: string;
  em: string;
}

export interface Meta {
  chave: string;
  valor: unknown;
}

/** Banco local no celular (IndexedDB). Espelha as tabelas do Supabase. */
export class BancoLocal extends Dexie {
  fila!: Table<ItemFila, number>;
  meta!: Table<Meta, string>;

  constructor(nome = "frutdatas") {
    super(nome);
    const esquema: Record<string, string> = {
      fila: "++seq, tabela, id",
      meta: "&chave",
    };
    for (const t of TABELAS) esquema[t] = "&id, atualizado_em, sincronizado_em";
    this.version(1).stores(esquema);
    // v2: índices para buscar itens, contas e movimentos de cada lançamento.
    this.version(2).stores({
      ...esquema,
      compras: "&id, atualizado_em, sincronizado_em, data, fornecedor_id",
      compra_itens: "&id, atualizado_em, sincronizado_em, compra_id, produto_id",
      colheitas: "&id, atualizado_em, sincronizado_em, ciclo_id, data",
      colheita_itens: "&id, atualizado_em, sincronizado_em, colheita_id",
      despesas: "&id, atualizado_em, sincronizado_em, data, ciclo_id, viagem_id",
      titulos: "&id, atualizado_em, sincronizado_em, origem_id, tipo",
      baixas: "&id, atualizado_em, sincronizado_em, titulo_id, movimento_id",
      movimentos_estoque: "&id, atualizado_em, sincronizado_em, origem_id, produto_id",
    });
    // v3: vendas e viagens.
    this.version(3).stores({
      compras: "&id, atualizado_em, sincronizado_em, data, fornecedor_id, viagem_id",
      vendas: "&id, atualizado_em, sincronizado_em, data, cliente_id, viagem_id",
      venda_itens: "&id, atualizado_em, sincronizado_em, venda_id, produto_id",
    });
  }

  t(tabela: NomeTabela): Table<Registro, string> {
    return this.table(tabela);
  }
}

export const db = new BancoLocal();

export async function lerMeta<T>(chave: string): Promise<T | undefined> {
  return (await db.meta.get(chave))?.valor as T | undefined;
}

export async function gravarMeta(chave: string, valor: unknown): Promise<void> {
  await db.meta.put({ chave, valor });
}
