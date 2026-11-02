// Financeiro: contas a pagar/receber por pessoa, quitação de várias contas,
// caixa (saldo e fluxo) e margens por produto, cliente e viagem.
import { arred2, situacaoTitulo, totalPago, type FormaPagamento, type Gravacao, type Situacao } from "./lancamentos";
import { novoId } from "./repo";
import type { Registro } from "./tabelas";
import { valorItem } from "./vendas";

const ativo = (r: Registro) => !r.cancelado_em;

// ---------------------------------------------------------------- caixa

export function saldoCaixa(movimentos: Registro[], ate?: string) {
  const porForma: Record<string, number> = { pix: 0, dinheiro: 0, outro: 0 };
  let total = 0;
  for (const m of movimentos) {
    if (!ativo(m) || (ate && String(m.data) > ate)) continue;
    const v = (m.tipo === "entrada" ? 1 : -1) * Number(m.valor);
    total += v;
    porForma[String(m.forma)] = (porForma[String(m.forma)] ?? 0) + v;
  }
  for (const k of Object.keys(porForma)) porForma[k] = arred2(porForma[k]);
  return { total: arred2(total), porForma };
}

export function ordenarMovimentosCaixa(movs: Registro[]) {
  return [...movs].sort((a, b) => `${a.data}${a.criado_em}`.localeCompare(`${b.data}${b.criado_em}`));
}

/** Movimentos de um período com o saldo correndo. */
export function fluxoCaixa(movimentos: Registro[], de: string, ate: string) {
  const validos = ordenarMovimentosCaixa(movimentos.filter(ativo));
  let saldo = validos.filter((m) => String(m.data) < de).reduce((s, m) => s + (m.tipo === "entrada" ? 1 : -1) * Number(m.valor), 0);
  const saldoAnterior = arred2(saldo);
  let entradas = 0;
  let saidas = 0;
  const linhas: { m: Registro; saldo: number }[] = [];
  for (const m of validos) {
    const d = String(m.data);
    if (d < de || d > ate) continue;
    const v = Number(m.valor);
    if (m.tipo === "entrada") entradas += v;
    else saidas += v;
    saldo += m.tipo === "entrada" ? v : -v;
    linhas.push({ m, saldo: arred2(saldo) });
  }
  return { saldoAnterior, entradas: arred2(entradas), saidas: arred2(saidas), saldoFinal: arred2(saldo), linhas };
}

export type Natureza = "saldo_inicial" | "retirada" | "aporte" | "ajuste";

export const ROTULO_NATUREZA: Record<string, string> = {
  baixa: "Pagamento/recebimento",
  saldo_inicial: "Saldo inicial",
  retirada: "Retirada de sócio",
  aporte: "Aporte",
  ajuste: "Ajuste de caixa",
};

/** Movimento de caixa sem conta: saldo inicial, retirada, aporte ou ajuste. */
export function montarMovimentoAvulso(p: {
  natureza: Natureza;
  tipo: "entrada" | "saida";
  valor: number;
  forma: FormaPagamento;
  data: string;
  descricao: string | null;
}): Gravacao[] {
  const valor = arred2(p.valor);
  if (!(valor > 0)) throw new Error("Informe um valor maior que zero.");
  const tipo = p.natureza === "retirada" ? "saida" : p.natureza === "aporte" || p.natureza === "saldo_inicial" ? "entrada" : p.tipo;
  return [
    {
      tabela: "movimentos_caixa",
      dados: { data: p.data, tipo, natureza: p.natureza, valor, forma: p.forma, descricao: p.descricao ?? ROTULO_NATUREZA[p.natureza] },
    },
  ];
}

// ---------------------------------------------------------------- contas por pessoa

export function chavePessoa(t: Registro): string {
  if (t.fornecedor_id) return `f:${t.fornecedor_id}`;
  if (t.cliente_id) return `c:${t.cliente_id}`;
  if (t.motorista_id) return `m:${t.motorista_id}`;
  return `n:${String(t.favorecido ?? "").trim().toLowerCase() || "sem"}`;
}

export interface ContaAberta {
  titulo: Registro;
  pago: number;
  falta: number;
  situacao: Situacao;
}

export interface GrupoPessoa {
  chave: string;
  nome: string;
  aberto: number;
  vencido: number;
  proximoVencimento: string | null;
  contas: ContaAberta[];
}

/** Contas em aberto de um tipo, agrupadas por pessoa (mais vencido primeiro). */
export function agruparPorPessoa(
  titulos: Registro[],
  baixas: Registro[],
  tipo: "pagar" | "receber",
  dataHoje: string,
  nome: (t: Registro) => string,
): GrupoPessoa[] {
  const grupos = new Map<string, GrupoPessoa>();
  for (const t of titulos) {
    if (!ativo(t) || t.tipo !== tipo) continue;
    const pago = totalPago(t, baixas);
    const falta = arred2(Number(t.valor) - pago);
    if (falta <= 0.005) continue;
    const chave = chavePessoa(t);
    let g = grupos.get(chave);
    if (!g) {
      g = { chave, nome: nome(t), aberto: 0, vencido: 0, proximoVencimento: null, contas: [] };
      grupos.set(chave, g);
    }
    const situacao = situacaoTitulo(t, baixas, dataHoje);
    g.contas.push({ titulo: t, pago, falta, situacao });
    g.aberto = arred2(g.aberto + falta);
    if (String(t.vencimento) < dataHoje) g.vencido = arred2(g.vencido + falta);
    if (!g.proximoVencimento || String(t.vencimento) < g.proximoVencimento) g.proximoVencimento = String(t.vencimento);
  }
  for (const g of grupos.values()) g.contas.sort((a, b) => String(a.titulo.vencimento).localeCompare(String(b.titulo.vencimento)));
  return [...grupos.values()].sort((a, b) => b.vencido - a.vencido || (a.proximoVencimento ?? "").localeCompare(b.proximoVencimento ?? ""));
}

/**
 * Um pagamento quitando várias contas: um só movimento de caixa e uma baixa
 * por conta, cobrindo primeiro as que vencem antes. Valor menor = quitação parcial.
 */
export function montarQuitacao(p: {
  titulos: Registro[];
  baixas: Registro[];
  valor: number;
  forma: FormaPagamento;
  data: string;
  descricao: string;
}): Gravacao[] {
  const valor = arred2(p.valor);
  if (!(valor > 0)) throw new Error("Informe um valor maior que zero.");
  if (!p.titulos.length) throw new Error("Escolha ao menos uma conta.");
  const tipos = new Set(p.titulos.map((t) => t.tipo));
  if (tipos.size > 1) throw new Error("Não dá para misturar contas a pagar e a receber.");
  const ordem = [...p.titulos].sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
  const totalAberto = arred2(ordem.reduce((s, t) => s + Number(t.valor) - totalPago(t, p.baixas), 0));
  if (valor > totalAberto + 0.005) throw new Error("O valor é maior que o total em aberto.");
  const movimentoId = novoId();
  const g: Gravacao[] = [
    {
      tabela: "movimentos_caixa",
      dados: {
        id: movimentoId,
        data: p.data,
        tipo: ordem[0].tipo === "receber" ? "entrada" : "saida",
        natureza: "baixa",
        valor,
        forma: p.forma,
        descricao: p.descricao,
      },
    },
  ];
  let resto = valor;
  for (const t of ordem) {
    if (resto <= 0.005) break;
    const falta = arred2(Number(t.valor) - totalPago(t, p.baixas));
    if (falta <= 0.005) continue;
    const usa = arred2(Math.min(falta, resto));
    g.push({ tabela: "baixas", dados: { titulo_id: t.id, movimento_id: movimentoId, valor: usa } });
    resto = arred2(resto - usa);
  }
  return g;
}

// ---------------------------------------------------------------- margens

export interface LinhaMargem {
  chave: string;
  receita: number;
  custo: number;
  margem: number;
  percentual: number;
  quantidade: number;
}

/** Margem das vendas do período (pela data da venda), por produto, cliente e viagem. */
export function calcularMargens(p: { vendas: Registro[]; itens: Registro[]; movimentos: Registro[]; de: string; ate: string }) {
  const vendas = new Map(
    p.vendas.filter((v) => ativo(v) && String(v.data) >= p.de && String(v.data) <= p.ate).map((v) => [v.id, v]),
  );
  const custoSaida = new Map<string, number>();
  for (const m of p.movimentos) if (ativo(m) && m.tipo === "venda") custoSaida.set(String(m.origem_id), Number(m.custo_unitario ?? 0));
  const porProduto = new Map<string, LinhaMargem>();
  const porCliente = new Map<string, LinhaMargem>();
  const porViagem = new Map<string, LinhaMargem>();
  const total: LinhaMargem = { chave: "total", receita: 0, custo: 0, margem: 0, percentual: 0, quantidade: 0 };
  const somar = (mapa: Map<string, LinhaMargem>, chave: string, receita: number, custo: number, q: number) => {
    const l = mapa.get(chave) ?? { chave, receita: 0, custo: 0, margem: 0, percentual: 0, quantidade: 0 };
    l.receita += receita;
    l.custo += custo;
    l.quantidade += q;
    mapa.set(chave, l);
  };
  for (const i of p.itens) {
    if (!ativo(i)) continue;
    const v = vendas.get(String(i.venda_id));
    if (!v) continue;
    const q = Number(i.quantidade_acerto ?? i.quantidade);
    const receita = valorItem(i);
    const custo = q * (custoSaida.get(i.id) ?? 0);
    somar(porProduto, `${i.produto_id}|${i.classificacao_id ?? ""}`, receita, custo, q);
    somar(porCliente, String(v.cliente_id), receita, custo, q);
    if (v.viagem_id) somar(porViagem, String(v.viagem_id), receita, custo, q);
    total.receita += receita;
    total.custo += custo;
    total.quantidade += q;
  }
  const fechar = (l: LinhaMargem): LinhaMargem => {
    const receita = arred2(l.receita);
    const custo = arred2(l.custo);
    return { ...l, receita, custo, margem: arred2(receita - custo), percentual: receita > 0 ? (receita - custo) / receita : 0 };
  };
  const lista = (m: Map<string, LinhaMargem>) => [...m.values()].map(fechar).sort((a, b) => b.margem - a.margem);
  return { porProduto: lista(porProduto), porCliente: lista(porCliente), porViagem: lista(porViagem), total: fechar(total) };
}

// ---------------------------------------------------------------- períodos

export function inicioDoMes(data: string) {
  return `${data.slice(0, 7)}-01`;
}

export function fimDoMes(data: string) {
  const [a, m] = data.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${data.slice(0, 7)}-${String(ultimo).padStart(2, "0")}`;
}

export function mudarMes(data: string, delta: number) {
  const [a, m] = data.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function nomeMes(data: string) {
  const [a, m] = data.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}
