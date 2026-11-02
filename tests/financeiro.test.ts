import { describe, expect, it } from "vitest";
import type { Registro } from "@/lib/tabelas";
import {
  agruparPorPessoa,
  calcularMargens,
  fimDoMes,
  fluxoCaixa,
  montarMovimentoAvulso,
  montarQuitacao,
  mudarMes,
  saldoCaixa,
} from "@/lib/financeiro";

const reg = (r: Partial<Registro>) => ({ atualizado_em: "", criado_em: "", ...r }) as Registro;

const titulos = [
  reg({ id: "t1", tipo: "pagar", fornecedor_id: "f1", valor: 100, vencimento: "2026-10-30" }),
  reg({ id: "t2", tipo: "pagar", fornecedor_id: "f1", valor: 200, vencimento: "2026-11-05" }),
  reg({ id: "t3", tipo: "pagar", fornecedor_id: "f2", valor: 50, vencimento: "2026-11-10" }),
  reg({ id: "t4", tipo: "receber", cliente_id: "c1", valor: 300, vencimento: "2026-11-01" }),
  reg({ id: "t5", tipo: "pagar", fornecedor_id: "f2", valor: 80, vencimento: "2026-11-01", cancelado_em: "x" }),
];
const baixas = [reg({ id: "b1", titulo_id: "t1", valor: 40 })];

describe("contas por pessoa", () => {
  it("agrupa o que falta pagar, com o vencido separado", () => {
    const g = agruparPorPessoa(titulos, baixas, "pagar", "2026-11-02", (t) => String(t.fornecedor_id));
    expect(g.map((x) => x.chave)).toEqual(["f:f1", "f:f2"]);
    expect(g[0]).toMatchObject({ aberto: 260, vencido: 60, proximoVencimento: "2026-10-30" });
    expect(g[0].contas.map((c) => c.falta)).toEqual([60, 200]);
    expect(g[1].aberto).toBe(50);
  });

  it("um pagamento quita várias contas, as mais antigas primeiro", () => {
    const g = montarQuitacao({ titulos: [titulos[1], titulos[0]], baixas, valor: 150, forma: "pix", data: "2026-11-02", descricao: "Pgto" });
    expect(g[0]).toMatchObject({ tabela: "movimentos_caixa", dados: { tipo: "saida", valor: 150 } });
    const bs = g.filter((x) => x.tabela === "baixas").map((x) => [x.dados.titulo_id, x.dados.valor]);
    expect(bs).toEqual([["t1", 60], ["t2", 90]]);
    expect(new Set(g.slice(1).map((x) => x.dados.movimento_id)).size).toBe(1);
  });

  it("não aceita valor maior que o aberto nem misturar pagar e receber", () => {
    expect(() => montarQuitacao({ titulos: [titulos[0]], baixas, valor: 61, forma: "pix", data: "2026-11-02", descricao: "" })).toThrow();
    expect(() => montarQuitacao({ titulos: [titulos[0], titulos[3]], baixas, valor: 10, forma: "pix", data: "2026-11-02", descricao: "" })).toThrow();
  });
});

describe("caixa", () => {
  const movs = [
    reg({ id: "m0", data: "2026-10-01", tipo: "entrada", valor: 1000, forma: "dinheiro", natureza: "saldo_inicial" }),
    reg({ id: "m1", data: "2026-11-01", tipo: "saida", valor: 200, forma: "pix" }),
    reg({ id: "m2", data: "2026-11-02", tipo: "entrada", valor: 500, forma: "pix" }),
    reg({ id: "m3", data: "2026-11-02", tipo: "saida", valor: 999, forma: "pix", cancelado_em: "x" }),
  ];
  it("saldo total e por forma", () => {
    expect(saldoCaixa(movs)).toEqual({ total: 1300, porForma: { pix: 300, dinheiro: 1000, outro: 0 } });
  });
  it("fluxo do período com saldo anterior e saldo correndo", () => {
    const f = fluxoCaixa(movs, "2026-11-01", "2026-11-30");
    expect(f).toMatchObject({ saldoAnterior: 1000, entradas: 500, saidas: 200, saldoFinal: 1300 });
    expect(f.linhas.map((l) => l.saldo)).toEqual([800, 1300]);
  });
  it("retirada sempre sai do caixa", () => {
    const g = montarMovimentoAvulso({ natureza: "retirada", tipo: "entrada", valor: 300, forma: "pix", data: "2026-11-02", descricao: null });
    expect(g[0].dados).toMatchObject({ tipo: "saida", natureza: "retirada", valor: 300 });
  });
});

describe("margens", () => {
  it("por produto, cliente e viagem no período", () => {
    const r = calcularMargens({
      vendas: [
        reg({ id: "v1", data: "2026-11-02", cliente_id: "c1", viagem_id: "vg1" }),
        reg({ id: "v2", data: "2026-11-03", cliente_id: "c2" }),
        reg({ id: "v3", data: "2026-10-03", cliente_id: "c2" }),
      ],
      itens: [
        reg({ id: "i1", venda_id: "v1", produto_id: "p1", classificacao_id: null, quantidade: 10, preco_unitario: 30, quantidade_acerto: 8, preco_acerto: 30 }),
        reg({ id: "i2", venda_id: "v2", produto_id: "p1", classificacao_id: null, quantidade: 5, preco_unitario: 40 }),
        reg({ id: "i3", venda_id: "v3", produto_id: "p1", classificacao_id: null, quantidade: 5, preco_unitario: 40 }),
      ],
      movimentos: [
        reg({ id: "m1", origem_id: "i1", tipo: "venda", custo_unitario: 20 }),
        reg({ id: "m2", origem_id: "i2", tipo: "venda", custo_unitario: 20 }),
      ],
      de: "2026-11-01",
      ate: "2026-11-30",
    });
    expect(r.total).toMatchObject({ receita: 440, custo: 260, margem: 180, quantidade: 13 });
    expect(r.porProduto).toHaveLength(1);
    expect(r.porCliente.map((c) => [c.chave, c.margem])).toEqual([["c2", 100], ["c1", 80]]);
    expect(r.porViagem.map((c) => c.chave)).toEqual(["vg1"]);
  });
});

describe("períodos", () => {
  it("fim do mês e troca de mês", () => {
    expect(fimDoMes("2026-02-10")).toBe("2026-02-28");
    expect(mudarMes("2026-01-15", -1)).toBe("2025-12-01");
  });
});
