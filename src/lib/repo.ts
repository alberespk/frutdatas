import type { BancoLocal } from "./db";
import type { NomeTabela, Registro } from "./tabelas";

export function novoId(): string {
  return crypto.randomUUID();
}

/**
 * Grava um registro no celular e coloca na fila de envio.
 * Funciona igual com ou sem internet; a sincronização envia depois.
 */
export async function gravar(
  banco: BancoLocal,
  tabela: NomeTabela,
  dados: Partial<Registro>,
  usuarioId: string | null,
): Promise<Registro> {
  const agora = new Date().toISOString();
  return banco.transaction("rw", banco.t(tabela), banco.fila, async () => {
    const atual = dados.id ? await banco.t(tabela).get(dados.id) : undefined;
    const registro: Registro = {
      ...(atual ?? { criado_por: usuarioId, criado_em: agora, cancelado_em: null }),
      ...dados,
      id: dados.id ?? atual?.id ?? novoId(),
      atualizado_em: agora,
    };
    await banco.t(tabela).put(registro);
    await banco.fila.add({ tabela, id: registro.id, em: agora });
    return registro;
  });
}

/** Grava vários registros de uma vez (ex.: compra + itens), na ordem dada. */
export async function gravarVarios(
  banco: BancoLocal,
  itens: { tabela: NomeTabela; dados: Partial<Registro> }[],
  usuarioId: string | null,
): Promise<Registro[]> {
  const tabelas = [...new Set(itens.map((i) => i.tabela))].map((t) => banco.t(t));
  return banco.transaction("rw", [...tabelas, banco.fila], async () => {
    const salvos: Registro[] = [];
    for (const i of itens) salvos.push(await gravar(banco, i.tabela, i.dados, usuarioId));
    return salvos;
  });
}

/** "Excluir" = marcar como cancelado (nunca apaga, para não voltar na sincronização). */
export function cancelar(banco: BancoLocal, tabela: NomeTabela, id: string, usuarioId: string | null) {
  return gravar(banco, tabela, { id, cancelado_em: new Date().toISOString() }, usuarioId);
}
