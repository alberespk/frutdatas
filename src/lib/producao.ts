"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { resumirCiclo, type ResumoCiclo } from "./lancamentos";
import type { Registro } from "./tabelas";

export interface DadosCiclo {
  ciclo: Registro;
  despesas: Registro[];
  colheitas: Registro[];
  itens: Registro[];
  resumo: ResumoCiclo;
}

/** Carrega despesas e colheitas de cada ciclo e calcula custo por kg. */
export async function carregarCiclos(ids?: string[]): Promise<DadosCiclo[]> {
  const ciclos = (ids ? (await db.t("ciclos").bulkGet(ids)).filter((c): c is Registro => !!c) : await db.t("ciclos").toArray()).filter(
    (c) => !c.cancelado_em,
  );
  const produtos = new Map((await db.t("produtos").toArray()).map((p) => [p.id, p]));
  const resultado: DadosCiclo[] = [];
  for (const ciclo of ciclos) {
    const despesas = (await db.t("despesas").where("ciclo_id").equals(ciclo.id).toArray()).filter((d) => !d.cancelado_em);
    const colheitas = (await db.t("colheitas").where("ciclo_id").equals(ciclo.id).toArray()).filter((c) => !c.cancelado_em);
    const itens = (await db.t("colheita_itens").where("colheita_id").anyOf(colheitas.map((c) => c.id)).toArray()).filter(
      (i) => !i.cancelado_em,
    );
    resultado.push({ ciclo, despesas, colheitas, itens, resumo: resumirCiclo(despesas, itens, produtos) });
  }
  return resultado;
}

export function useCiclos() {
  return useLiveQuery(() => carregarCiclos(), []);
}
