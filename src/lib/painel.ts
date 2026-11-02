// Números do painel dos sócios, calculados a partir do banco local.
import { arred2 } from "./lancamentos";
import type { Registro } from "./tabelas";
import { valorItem } from "./vendas";

const ativo = (r: Registro) => !r.cancelado_em;
const noPeriodo = (d: unknown, de: string, ate: string) => String(d) >= de && String(d) <= ate;

export interface Ranking {
  id: string;
  valor: number;
}

export interface ResumoPainel {
  compras: number;
  qtdCompras: number;
  vendas: number;
  qtdVendas: number;
  custoVendido: number;
  margem: number;
  percentual: number;
  perdas: number;
  despesas: number;
  produtores: Ranking[];
  clientes: Ranking[];
}

function ranking(m: Map<string, number>, n: number): Ranking[] {
  return [...m.entries()]
    .map(([id, valor]) => ({ id, valor: arred2(valor) }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, n);
}

export function resumirPainel(p: {
  compras: Registro[];
  compraItens: Registro[];
  vendas: Registro[];
  vendaItens: Registro[];
  movimentos: Registro[];
  despesas: Registro[];
  de: string;
  ate: string;
  top?: number;
}): ResumoPainel {
  const top = p.top ?? 5;
  const compras = new Map(p.compras.filter((c) => ativo(c) && noPeriodo(c.data, p.de, p.ate)).map((c) => [c.id, c]));
  const porProdutor = new Map<string, number>();
  let totalCompras = 0;
  for (const i of p.compraItens) {
    const c = compras.get(String(i.compra_id));
    if (!c || !ativo(i)) continue;
    totalCompras += Number(i.total);
    const f = String(c.fornecedor_id);
    porProdutor.set(f, (porProdutor.get(f) ?? 0) + Number(i.total));
  }

  const vendas = new Map(p.vendas.filter((v) => ativo(v) && noPeriodo(v.data, p.de, p.ate)).map((v) => [v.id, v]));
  const custo = new Map<string, number>();
  for (const m of p.movimentos) if (ativo(m) && m.tipo === "venda") custo.set(String(m.origem_id), Number(m.custo_unitario ?? 0));
  const porCliente = new Map<string, number>();
  let receita = 0;
  let cmv = 0;
  for (const i of p.vendaItens) {
    const v = vendas.get(String(i.venda_id));
    if (!v || !ativo(i)) continue;
    const valor = valorItem(i);
    receita += valor;
    cmv += Number(i.quantidade_acerto ?? i.quantidade) * (custo.get(i.id) ?? 0);
    const c = String(v.cliente_id);
    porCliente.set(c, (porCliente.get(c) ?? 0) + valor);
  }

  const perdas = p.movimentos
    .filter((m) => ativo(m) && m.tipo === "perda" && noPeriodo(m.data, p.de, p.ate))
    .reduce((s, m) => s + -Number(m.quantidade) * Number(m.custo_unitario ?? 0), 0);
  const despesas = p.despesas.filter((d) => ativo(d) && noPeriodo(d.data, p.de, p.ate)).reduce((s, d) => s + Number(d.valor), 0);

  const r = arred2(receita);
  const c = arred2(cmv);
  return {
    compras: arred2(totalCompras),
    qtdCompras: compras.size,
    vendas: r,
    qtdVendas: vendas.size,
    custoVendido: c,
    margem: arred2(r - c),
    percentual: r > 0 ? (r - c) / r : 0,
    perdas: arred2(perdas),
    despesas: arred2(despesas),
    produtores: ranking(porProdutor, top),
    clientes: ranking(porCliente, top),
  };
}
