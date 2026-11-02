"use client";
// Consultas ao banco local usadas pelas telas (atualizam sozinhas com useLiveQuery).
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { NomeTabela, Registro } from "./tabelas";

/** Registros não cancelados de uma tabela. */
export function useTabela(tabela: NomeTabela, filtro?: (r: Registro) => boolean, deps: unknown[] = []) {
  return useLiveQuery(
    () => db.t(tabela).filter((r) => !r.cancelado_em && (!filtro || filtro(r))).toArray(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabela, ...deps],
  );
}

/** Mapa id -> registro (inclui desativados, para mostrar nomes no histórico). */
export function useMapa(tabela: NomeTabela) {
  return useLiveQuery(async () => new Map((await db.t(tabela).toArray()).map((r) => [r.id, r])), [tabela]);
}

export const ordenarPorNome = (a: Registro, b: Registro) =>
  String(a.nome ?? "").localeCompare(String(b.nome ?? ""), "pt-BR");

export const ativos = (r: Registro) => !r.cancelado_em && r.ativo !== false;

/** Último preço pago por um produto (+ classificação), de preferência a este fornecedor. */
export async function ultimoPreco(fornecedorId: string, produtoId: string, classificacaoId: string | null) {
  const itens = (await db.t("compra_itens").where("produto_id").equals(produtoId).toArray()).filter(
    (i) => !i.cancelado_em && (classificacaoId ? i.classificacao_id === classificacaoId : true),
  );
  if (!itens.length) return null;
  const compras = new Map(
    (await db.t("compras").bulkGet([...new Set(itens.map((i) => String(i.compra_id)))]))
      .filter((c): c is Registro => !!c && !c.cancelado_em)
      .map((c) => [c.id, c]),
  );
  const comData = itens
    .map((i) => ({ i, c: compras.get(String(i.compra_id)) }))
    .filter((x) => x.c)
    .sort((a, b) => `${b.c!.data}${b.i.criado_em}`.localeCompare(`${a.c!.data}${a.i.criado_em}`));
  const doFornecedor = comData.find((x) => x.c!.fornecedor_id === fornecedorId);
  const escolhido = doFornecedor ?? comData[0];
  return escolhido
    ? { preco: Number(escolhido.i.preco_unitario), data: String(escolhido.c!.data), doFornecedor: !!doFornecedor }
    : null;
}

/** Estoque calculado a partir de todos os movimentos do aparelho. */
export function useEstoque(dataHoje: string) {
  return useLiveQuery(async () => {
    const { calcularEstoque } = await import("./estoque");
    return calcularEstoque(await db.t("movimentos_estoque").toArray(), dataHoje);
  }, [dataHoje]);
}

/** Último preço de venda de um produto (+ classificação), de preferência a este cliente. */
export async function ultimoPrecoVenda(clienteId: string, produtoId: string, classificacaoId: string | null) {
  const itens = (await db.t("venda_itens").where("produto_id").equals(produtoId).toArray()).filter(
    (i) => !i.cancelado_em && (classificacaoId ? i.classificacao_id === classificacaoId : true),
  );
  if (!itens.length) return null;
  const vendas = new Map(
    (await db.t("vendas").bulkGet([...new Set(itens.map((i) => String(i.venda_id)))]))
      .filter((v): v is Registro => !!v && !v.cancelado_em)
      .map((v) => [v.id, v]),
  );
  const comData = itens
    .map((i) => ({ i, v: vendas.get(String(i.venda_id)) }))
    .filter((x) => x.v)
    .sort((a, b) => `${b.v!.data}${b.i.criado_em}`.localeCompare(`${a.v!.data}${a.i.criado_em}`));
  const doCliente = comData.find((x) => x.v!.cliente_id === clienteId);
  const escolhido = doCliente ?? comData[0];
  return escolhido
    ? { preco: Number(escolhido.i.preco_acerto ?? escolhido.i.preco_unitario), data: String(escolhido.v!.data), doCliente: !!doCliente }
    : null;
}
