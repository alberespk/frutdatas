// Regras de venda, acerto (com devolução) e romaneio.
import { formatarData, formatarMoeda, formatarNumero, somarDias } from "./formato";
import { arred2, montarPagamento, type FormaPagamento, type Gravacao } from "./lancamentos";
import { novoId } from "./repo";
import type { Registro } from "./tabelas";

export const EMPRESA = {
  nome: "FrutDatas",
  endereco: "Rua Vereador Pedro Rosa, 87 - Datas/MG",
  telefones: "(38) 99979-5639 · (38) 99916-1390",
};

/** Próximo número de romaneio do usuário: letra + sequência (A-0001, A-0002…). */
export function proximoNumero(letra: string, numerosExistentes: string[]): string {
  const prefixo = `${letra}-`;
  const maior = numerosExistentes
    .filter((n) => n.startsWith(prefixo))
    .map((n) => Number(n.slice(prefixo.length)))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefixo}${String(maior + 1).padStart(4, "0")}`;
}

export interface ItemVenda {
  produto_id: string;
  classificacao_id: string | null;
  quantidade: number;
  preco_unitario: number;
  /** Custo de saída do estoque (PEPS) no momento da venda. */
  custo_unitario: number;
}

export interface EntradaVenda {
  numero: string;
  data: string;
  cliente: Registro;
  viagem_id: string | null;
  prazo_dias: number;
  observacao: string | null;
  itens: ItemVenda[];
  recebimento: { tipo: "agora"; forma: FormaPagamento } | { tipo: "prazo" };
}

export function totalVenda(itens: { quantidade: number; preco_unitario: number }[]) {
  return arred2(itens.reduce((s, i) => s + arred2(i.quantidade * i.preco_unitario), 0));
}

export function montarVenda(e: EntradaVenda): Gravacao[] {
  if (!e.itens.length) throw new Error("A venda precisa de pelo menos um item.");
  const vendaId = novoId();
  const vencimento = somarDias(e.data, e.prazo_dias);
  const g: Gravacao[] = [
    {
      tabela: "vendas",
      dados: {
        id: vendaId,
        numero: e.numero,
        data: e.data,
        cliente_id: e.cliente.id,
        viagem_id: e.viagem_id,
        prazo_dias: e.prazo_dias,
        vencimento,
        situacao: "aberta",
        observacao: e.observacao,
      },
    },
  ];
  for (const i of e.itens) {
    const itemId = novoId();
    g.push({
      tabela: "venda_itens",
      dados: {
        id: itemId,
        venda_id: vendaId,
        produto_id: i.produto_id,
        classificacao_id: i.classificacao_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        quantidade_devolvida: 0,
      },
    });
    g.push({
      tabela: "movimentos_estoque",
      dados: {
        data: e.data,
        produto_id: i.produto_id,
        classificacao_id: i.classificacao_id,
        tipo: "venda",
        quantidade: -i.quantidade,
        custo_unitario: Math.round(i.custo_unitario * 10000) / 10000,
        origem_tabela: "venda_itens",
        origem_id: itemId,
      },
    });
  }
  const total = totalVenda(e.itens);
  const titulo: Partial<Registro> = {
    id: novoId(),
    tipo: "receber",
    origem_tabela: "vendas",
    origem_id: vendaId,
    cliente_id: e.cliente.id,
    favorecido: e.cliente.nome as string,
    descricao: `Venda ${e.numero} - ${e.cliente.nome}`,
    emissao: e.data,
    vencimento: e.recebimento.tipo === "agora" ? e.data : vencimento,
    valor: total,
  };
  g.push({ tabela: "titulos", dados: titulo });
  if (e.recebimento.tipo === "agora") {
    g.push(...montarPagamento({ titulo: titulo as Registro, valor: total, forma: e.recebimento.forma, data: e.data }));
  }
  return g;
}

export interface AcertoItem {
  item: Registro;
  /** Movimento de saída original (para devolver ao mesmo custo). */
  movimento: Registro | undefined;
  quantidade_acerto: number;
  preco_acerto: number;
  destino_devolucao: "estoque" | "perda";
}

/** Valor do item depois do acerto (ou o original, se ainda não acertado). */
export function valorItem(i: Registro): number {
  const q = i.quantidade_acerto ?? i.quantidade;
  const p = i.preco_acerto ?? i.preco_unitario;
  return arred2(Number(q) * Number(p));
}

/**
 * Acerto: ajusta quantidade e preço de cada item. O que voltou entra de novo
 * no estoque (ao custo da saída) ou fica registrado como perda.
 */
export function montarAcerto(p: {
  venda: Registro;
  titulo: Registro | undefined;
  data: string;
  itens: AcertoItem[];
  motivoPerdaId: string | null;
}): Gravacao[] {
  const g: Gravacao[] = [];
  let total = 0;
  for (const a of p.itens) {
    const original = Number(a.item.quantidade);
    if (a.quantidade_acerto < 0 || a.quantidade_acerto > original) {
      throw new Error("A quantidade do acerto não pode ser maior que a vendida.");
    }
    const devolvida = Math.round((original - a.quantidade_acerto) * 1000) / 1000;
    total += arred2(a.quantidade_acerto * a.preco_acerto);
    g.push({
      tabela: "venda_itens",
      dados: {
        id: a.item.id,
        quantidade_acerto: a.quantidade_acerto,
        preco_acerto: a.preco_acerto,
        quantidade_devolvida: devolvida,
        destino_devolucao: devolvida > 0 ? a.destino_devolucao : null,
      },
    });
    if (devolvida > 0) {
      const base = {
        data: p.data,
        produto_id: a.item.produto_id,
        classificacao_id: a.item.classificacao_id ?? null,
        origem_tabela: "venda_itens",
        origem_id: a.item.id,
      };
      const custo = a.movimento?.custo_unitario ?? null;
      g.push({ tabela: "movimentos_estoque", dados: { ...base, tipo: "devolucao", quantidade: devolvida, custo_unitario: custo } });
      if (a.destino_devolucao === "perda") {
        g.push({
          tabela: "movimentos_estoque",
          dados: {
            ...base,
            tipo: "perda",
            quantidade: -devolvida,
            custo_unitario: custo,
            motivo_perda_id: p.motivoPerdaId,
            observacao: `Devolução da venda ${p.venda.numero}`,
          },
        });
      }
    }
  }
  g.push({ tabela: "vendas", dados: { id: p.venda.id, situacao: "acertada", data_acerto: p.data } });
  if (p.titulo) g.push({ tabela: "titulos", dados: { id: p.titulo.id, valor: arred2(total) } });
  return g;
}

/** Margem: valor (acertado ou da venda) menos o custo das mercadorias que ficaram com o cliente. */
export function margemVenda(itens: Registro[], movimentos: Registro[]) {
  let receita = 0;
  let custo = 0;
  for (const i of itens) {
    receita += valorItem(i);
    const m = movimentos.find((x) => x.origem_id === i.id && x.tipo === "venda");
    const q = Number(i.quantidade_acerto ?? i.quantidade);
    custo += q * Number(m?.custo_unitario ?? 0);
  }
  return { receita: arred2(receita), custo: arred2(custo), margem: arred2(receita - custo), percentual: receita > 0 ? (receita - custo) / receita : 0 };
}

/** Texto do romaneio para mandar no WhatsApp. */
export function textoRomaneio(p: {
  venda: Registro;
  cliente: Registro | undefined;
  itens: Registro[];
  nomeItem: (i: Registro) => string;
  unidade: (i: Registro) => string;
}): string {
  const acertada = p.venda.situacao === "acertada";
  const linhas = p.itens.map((i) => {
    const q = Number(i.quantidade_acerto ?? i.quantidade);
    const preco = Number(i.preco_acerto ?? i.preco_unitario);
    return `• ${formatarNumero(q)} ${p.unidade(i)} ${p.nomeItem(i)} x ${formatarMoeda(preco)} = ${formatarMoeda(q * preco)}`;
  });
  const total = p.itens.reduce((s, i) => s + valorItem(i), 0);
  return [
    `*${EMPRESA.nome} - ${acertada ? "Acerto" : "Romaneio"} ${p.venda.numero}*`,
    `Data: ${formatarData(String(p.venda.data))}`,
    `Cliente: ${p.cliente?.nome ?? ""}`,
    "",
    ...linhas,
    "",
    `*Total: ${formatarMoeda(total)}*`,
    `Vencimento: ${formatarData(String(p.venda.vencimento))}`,
    "",
    `${EMPRESA.endereco}`,
    `${EMPRESA.telefones}`,
  ].join("\n");
}

/** Desfaz o acerto: tira devoluções/perdas lançadas nele e volta a venda para "aberta". */
export function montarDesfazerAcerto(p: {
  venda: Registro;
  titulo: Registro | undefined;
  itens: Registro[];
  movimentos: Registro[];
}): Gravacao[] {
  const agora = new Date().toISOString();
  const g: Gravacao[] = p.movimentos
    .filter((m) => !m.cancelado_em && (m.tipo === "devolucao" || m.tipo === "perda"))
    .map((m) => ({ tabela: "movimentos_estoque" as const, dados: { id: m.id, cancelado_em: agora } }));
  for (const i of p.itens) {
    g.push({
      tabela: "venda_itens",
      dados: { id: i.id, quantidade_acerto: null, preco_acerto: null, quantidade_devolvida: 0, destino_devolucao: null },
    });
  }
  g.push({ tabela: "vendas", dados: { id: p.venda.id, situacao: "aberta", data_acerto: null } });
  if (p.titulo) {
    g.push({
      tabela: "titulos",
      dados: { id: p.titulo.id, valor: totalVenda(p.itens.map((i) => ({ quantidade: Number(i.quantidade), preco_unitario: Number(i.preco_unitario) }))) },
    });
  }
  return g;
}
