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
