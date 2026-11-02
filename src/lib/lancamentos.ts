// Regras dos lançamentos: cada lançamento vira o conjunto de registros que
// mantém estoque e financeiro corretos (sem ninguém lançar duas vezes).
import { formatarData } from "./formato";
import { novoId } from "./repo";
import type { NomeTabela, Registro } from "./tabelas";

export type Gravacao = { tabela: NomeTabela; dados: Partial<Registro> };
export type FormaPagamento = "pix" | "dinheiro" | "outro";
export type Pagamento = { tipo: "agora"; forma: FormaPagamento } | { tipo: "depois"; vencimento: string };

export const arred2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ativo = (r: Registro) => !r.cancelado_em;

// ---------------------------------------------------------------- pagamentos

/** Pagamento (ou recebimento) de um título: um movimento de caixa + a baixa. */
export function montarPagamento(p: {
  titulo: Registro;
  valor: number;
  forma: FormaPagamento;
  data: string;
  descricao?: string;
}): Gravacao[] {
  const valor = arred2(p.valor);
  if (valor <= 0) return [];
  const movimentoId = novoId();
  return [
    {
      tabela: "movimentos_caixa",
      dados: {
        id: movimentoId,
        data: p.data,
        tipo: p.titulo.tipo === "receber" ? "entrada" : "saida",
        natureza: "baixa",
        valor,
        forma: p.forma,
        descricao: p.descricao ?? (p.titulo.descricao as string) ?? null,
      },
    },
    { tabela: "baixas", dados: { titulo_id: p.titulo.id, movimento_id: movimentoId, valor } },
  ];
}

export type Situacao = "paga" | "parcial" | "pendente" | "vencida";

export function totalPago(titulo: Registro, baixas: Registro[]): number {
  return arred2(baixas.filter((b) => ativo(b) && b.titulo_id === titulo.id).reduce((s, b) => s + Number(b.valor), 0));
}

export function situacaoTitulo(titulo: Registro, baixas: Registro[], dataHoje: string): Situacao {
  const pago = totalPago(titulo, baixas);
  const valor = Number(titulo.valor);
  if (pago >= valor - 0.005) return "paga";
  if (pago > 0) return "parcial";
  return String(titulo.vencimento) < dataHoje ? "vencida" : "pendente";
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  paga: "Paga",
  parcial: "Parcial",
  pendente: "A pagar",
  vencida: "Vencida",
};

// ---------------------------------------------------------------- compras

export interface ItemCompra {
  produto_id: string;
  classificacao_id: string | null;
  quantidade: number;
  preco_unitario: number;
}

export interface EntradaCompra {
  data: string;
  fornecedor: Registro;
  origem: "regional" | "retorno";
  viagem_id: string | null;
  observacao: string | null;
  itens: ItemCompra[];
  pagamento: Pagamento;
}

export function totalItens(itens: { quantidade: number; preco_unitario: number }[]): number {
  return arred2(itens.reduce((s, i) => s + arred2(i.quantidade * i.preco_unitario), 0));
}

export function montarCompra(e: EntradaCompra, ids?: { compra: string; titulo?: string }): Gravacao[] {
  if (!e.itens.length) throw new Error("A compra precisa de pelo menos um item.");
  const compraId = ids?.compra ?? novoId();
  const g: Gravacao[] = [
    {
      tabela: "compras",
      dados: {
        id: compraId,
        data: e.data,
        fornecedor_id: e.fornecedor.id,
        origem: e.origem,
        viagem_id: e.origem === "retorno" ? e.viagem_id : null,
        observacao: e.observacao,
      },
    },
  ];
  for (const i of e.itens) {
    const itemId = novoId();
    g.push({
      tabela: "compra_itens",
      dados: {
        id: itemId,
        compra_id: compraId,
        produto_id: i.produto_id,
        classificacao_id: i.classificacao_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        total: arred2(i.quantidade * i.preco_unitario),
      },
    });
    g.push({
      tabela: "movimentos_estoque",
      dados: {
        data: e.data,
        produto_id: i.produto_id,
        classificacao_id: i.classificacao_id,
        tipo: e.origem === "retorno" ? "retorno" : "compra",
        quantidade: i.quantidade,
        custo_unitario: i.preco_unitario,
        origem_tabela: "compra_itens",
        origem_id: itemId,
      },
    });
  }
  const total = totalItens(e.itens);
  const titulo: Partial<Registro> = {
    id: ids?.titulo ?? novoId(),
    tipo: "pagar",
    origem_tabela: "compras",
    origem_id: compraId,
    fornecedor_id: e.fornecedor.id,
    favorecido: e.fornecedor.nome as string,
    descricao: `Compra de ${formatarData(e.data)} - ${e.fornecedor.nome}`,
    emissao: e.data,
    vencimento: e.pagamento.tipo === "depois" ? e.pagamento.vencimento : e.data,
    valor: total,
  };
  g.push({ tabela: "titulos", dados: titulo });
  if (e.pagamento.tipo === "agora") {
    g.push(...montarPagamento({ titulo: titulo as Registro, valor: total, forma: e.pagamento.forma, data: e.data }));
  }
  return g;
}

/**
 * Edição de compra: mantém a compra e a conta (com os pagamentos já feitos),
 * troca os itens e os movimentos de estoque, e ajusta valor e vencimento da conta.
 */
export function montarEdicaoCompra(p: {
  compra: Registro;
  titulo: Registro | undefined;
  itensAntigos: Registro[];
  movimentosAntigos: Registro[];
  entrada: Omit<EntradaCompra, "pagamento">;
  vencimento: string;
}): Gravacao[] {
  return [
    ...montarCancelamento([
      { tabela: "movimentos_estoque", lista: p.movimentosAntigos },
      { tabela: "compra_itens", lista: p.itensAntigos },
    ]),
    ...montarCompra({ ...p.entrada, pagamento: { tipo: "depois", vencimento: p.vencimento } }, { compra: p.compra.id, titulo: p.titulo?.id }),
  ];
}

/**
 * Cancela um lançamento e tudo o que ele gerou (itens, estoque, contas, pagamentos).
 * Recebe os registros relacionados já carregados.
 */
export function montarCancelamento(registros: { tabela: NomeTabela; lista: Registro[] }[]): Gravacao[] {
  const agora = new Date().toISOString();
  return registros.flatMap(({ tabela, lista }) =>
    lista.filter(ativo).map((r) => ({ tabela, dados: { id: r.id, cancelado_em: agora } })),
  );
}

// ---------------------------------------------------------------- despesas

export interface EntradaDespesa {
  data: string;
  categoria: Registro;
  descricao: string | null;
  valor: number;
  favorecido: string | null;
  motorista_id: string | null;
  viagem_id: string | null;
  ciclo_id: string | null;
  pagamento: Pagamento;
}

export function montarDespesa(e: EntradaDespesa): Gravacao[] {
  const despesaId = novoId();
  const valor = arred2(e.valor);
  const g: Gravacao[] = [
    {
      tabela: "despesas",
      dados: {
        id: despesaId,
        data: e.data,
        categoria_id: e.categoria.id,
        descricao: e.descricao,
        valor,
        favorecido: e.favorecido,
        motorista_id: e.motorista_id,
        viagem_id: e.viagem_id,
        ciclo_id: e.ciclo_id,
      },
    },
  ];
  const titulo: Partial<Registro> = {
    id: novoId(),
    tipo: "pagar",
    origem_tabela: "despesas",
    origem_id: despesaId,
    motorista_id: e.motorista_id,
    favorecido: e.favorecido,
    descricao: [e.categoria.nome, e.descricao, e.favorecido].filter(Boolean).join(" - "),
    emissao: e.data,
    vencimento: e.pagamento.tipo === "depois" ? e.pagamento.vencimento : e.data,
    valor,
  };
  g.push({ tabela: "titulos", dados: titulo });
  if (e.pagamento.tipo === "agora") {
    g.push(...montarPagamento({ titulo: titulo as Registro, valor, forma: e.pagamento.forma, data: e.data }));
  }
  return g;
}

// ---------------------------------------------------------------- produção própria

/** Quantos kg representa uma quantidade do produto (null se não houver conversão). */
export function emKg(produto: Registro | undefined, quantidade: number): number | null {
  if (!produto) return null;
  if (produto.unidade === "kg") return quantidade;
  const k = Number(produto.kg_por_unidade);
  return k > 0 ? quantidade * k : null;
}

export interface ResumoCiclo {
  custoTotal: number;
  kgColhidos: number;
  unidadesColhidas: number;
  custoPorKg: number | null;
}

/** Custo por kg do ciclo = despesas do ciclo ÷ kg colhidos. */
export function resumirCiclo(
  despesasCiclo: Registro[],
  itensColhidos: ReadonlyArray<Record<string, unknown>>,
  produtos: Map<string, Registro>,
): ResumoCiclo {
  const custoTotal = arred2(despesasCiclo.filter(ativo).reduce((s, d) => s + Number(d.valor), 0));
  let kgColhidos = 0;
  let unidadesColhidas = 0;
  for (const i of itensColhidos) {
    const q = Number(i.quantidade);
    unidadesColhidas += q;
    kgColhidos += emKg(produtos.get(String(i.produto_id)), q) ?? 0;
  }
  return {
    custoTotal,
    kgColhidos,
    unidadesColhidas,
    custoPorKg: kgColhidos > 0 ? custoTotal / kgColhidos : null,
  };
}

/** Custo de uma unidade do produto colhido, a partir do resumo do ciclo. */
export function custoUnitarioColheita(resumo: ResumoCiclo, produto: Registro | undefined): number {
  const kg = emKg(produto, 1);
  if (kg !== null && resumo.custoPorKg !== null) return Math.round(resumo.custoPorKg * kg * 10000) / 10000;
  if (resumo.unidadesColhidas > 0) return Math.round((resumo.custoTotal / resumo.unidadesColhidas) * 10000) / 10000;
  return 0;
}

export interface EntradaColheita {
  data: string;
  ciclo_id: string;
  observacao: string | null;
  itens: { produto_id: string; classificacao_id: string | null; quantidade: number }[];
  /** Custo unitário por produto, já considerando esta colheita. */
  custoUnitario: (produtoId: string) => number;
}

export function montarColheita(e: EntradaColheita): Gravacao[] {
  if (!e.itens.length) throw new Error("A colheita precisa de pelo menos um item.");
  const colheitaId = novoId();
  const g: Gravacao[] = [
    { tabela: "colheitas", dados: { id: colheitaId, data: e.data, ciclo_id: e.ciclo_id, observacao: e.observacao } },
  ];
  for (const i of e.itens) {
    const itemId = novoId();
    g.push({ tabela: "colheita_itens", dados: { id: itemId, colheita_id: colheitaId, ...i } });
    g.push({
      tabela: "movimentos_estoque",
      dados: {
        data: e.data,
        produto_id: i.produto_id,
        classificacao_id: i.classificacao_id,
        tipo: "colheita",
        quantidade: i.quantidade,
        custo_unitario: e.custoUnitario(i.produto_id),
        origem_tabela: "colheita_itens",
        origem_id: itemId,
      },
    });
  }
  return g;
}

// ---------------------------------------------------------------- estoque

export function montarPerda(p: {
  data: string;
  produto_id: string;
  classificacao_id: string | null;
  quantidade: number;
  custo_unitario: number | null;
  motivo_perda_id: string | null;
  observacao: string | null;
}): Gravacao[] {
  if (!(p.quantidade > 0)) throw new Error("Informe a quantidade perdida.");
  return [
    {
      tabela: "movimentos_estoque",
      dados: {
        data: p.data,
        produto_id: p.produto_id,
        classificacao_id: p.classificacao_id,
        tipo: "perda",
        quantidade: -p.quantidade,
        custo_unitario: p.custo_unitario,
        motivo_perda_id: p.motivo_perda_id,
        observacao: p.observacao,
      },
    },
  ];
}

/** Ajuste de contagem: lança a diferença entre o contado e o saldo do sistema. */
export function montarAjuste(p: {
  data: string;
  produto_id: string;
  classificacao_id: string | null;
  saldoSistema: number;
  contado: number;
  custoSaida: number;
}): Gravacao[] {
  const diferenca = Math.round((p.contado - p.saldoSistema) * 1000) / 1000;
  if (diferenca === 0) return [];
  return [
    {
      tabela: "movimentos_estoque",
      dados: {
        data: p.data,
        produto_id: p.produto_id,
        classificacao_id: p.classificacao_id,
        tipo: "ajuste",
        quantidade: diferenca,
        // Sobra entra pelo custo médio (null); falta sai pelo custo das entradas mais antigas.
        custo_unitario: diferenca > 0 ? null : p.custoSaida,
        observacao: `Contagem: ${p.contado} (sistema: ${p.saldoSistema})`,
      },
    },
  ];
}
