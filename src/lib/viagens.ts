// Viagens e fretes: resultado da carga de ida e o que veio de volta.
import { arred2, montarDespesa, type Gravacao } from "./lancamentos";
import type { Registro } from "./tabelas";
import { valorItem } from "./vendas";

const ativo = (r: Registro) => !r.cancelado_em;

export const ROTULO_SITUACAO_VIAGEM: Record<string, string> = {
  planejada: "Planejada",
  em_viagem: "Em viagem",
  encerrada: "Encerrada",
};

/** Dias da viagem contando saída e volta (mínimo 1). */
export function diasViagem(saida: string, volta: string | null | undefined): number {
  if (!volta) return 1;
  const [a1, m1, d1] = saida.split("-").map(Number);
  const [a2, m2, d2] = volta.split("-").map(Number);
  const dif = Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
  return Math.max(1, dif + 1);
}

export interface ResultadoViagem {
  receita: number;
  cmv: number;
  despesas: number;
  resultado: number;
  km: number | null;
  custoPorKm: number | null;
  vendas: number;
  volta: { compras: number; valor: number };
}

/**
 * Resultado da viagem = receita da carga de ida − custo da mercadoria vendida − despesas.
 * A carga de volta (compras de retorno) é mostrada à parte: vira estoque, não é custo da viagem.
 */
export function resultadoViagem(p: {
  viagem: Registro;
  vendas: Registro[];
  vendaItens: Registro[];
  movimentos: Registro[];
  despesas: Registro[];
  comprasVolta: Registro[];
  compraItens: Registro[];
}): ResultadoViagem {
  const vendas = p.vendas.filter((v) => ativo(v) && v.viagem_id === p.viagem.id);
  const ids = new Set(vendas.map((v) => v.id));
  const itens = p.vendaItens.filter((i) => ativo(i) && ids.has(String(i.venda_id)));
  let receita = 0;
  let cmv = 0;
  for (const i of itens) {
    receita += valorItem(i);
    const m = p.movimentos.find((x) => ativo(x) && x.origem_id === i.id && x.tipo === "venda");
    cmv += Number(i.quantidade_acerto ?? i.quantidade) * Number(m?.custo_unitario ?? 0);
  }
  const despesas = p.despesas.filter((d) => ativo(d) && d.viagem_id === p.viagem.id).reduce((s, d) => s + Number(d.valor), 0);
  const compras = p.comprasVolta.filter((c) => ativo(c) && c.viagem_id === p.viagem.id);
  const cids = new Set(compras.map((c) => c.id));
  const valorVolta = p.compraItens.filter((i) => ativo(i) && cids.has(String(i.compra_id))).reduce((s, i) => s + Number(i.total), 0);
  const ki = p.viagem.km_inicial;
  const kf = p.viagem.km_final;
  const km = ki != null && kf != null && Number(kf) >= Number(ki) ? Number(kf) - Number(ki) : null;
  const resultado = arred2(receita - cmv - despesas);
  return {
    receita: arred2(receita),
    cmv: arred2(cmv),
    despesas: arred2(despesas),
    resultado,
    km,
    custoPorKm: km ? arred2(despesas / km) : null,
    vendas: vendas.length,
    volta: { compras: compras.length, valor: arred2(valorVolta) },
  };
}

/** Encerrar: grava volta e km; se o motorista é por diária, lança a diária como conta a pagar. */
export function montarEncerramento(p: {
  viagem: Registro;
  data_volta: string;
  km_final: number | null;
  diaria: { categoria: Registro; motorista: Registro; dias: number; valorDia: number; vencimento: string } | null;
}): Gravacao[] {
  const g: Gravacao[] = [
    { tabela: "viagens", dados: { id: p.viagem.id, situacao: "encerrada", data_volta: p.data_volta, km_final: p.km_final } },
  ];
  if (p.diaria && p.diaria.dias > 0 && p.diaria.valorDia > 0) {
    const d = p.diaria;
    g.push(
      ...montarDespesa({
        data: p.data_volta,
        categoria: d.categoria,
        descricao: `${d.dias} diária(s) - viagem ${p.viagem.destino}`,
        valor: arred2(d.dias * d.valorDia),
        favorecido: String(d.motorista.nome),
        motorista_id: d.motorista.id,
        viagem_id: p.viagem.id,
        ciclo_id: null,
        pagamento: { tipo: "depois", vencimento: d.vencimento },
      }),
    );
  }
  return g;
}
