import { describe, expect, it } from "vitest";
import {
  type Gravacao,
  custoUnitarioColheita,
  montarCancelamento,
  montarColheita,
  montarCompra,
  montarDespesa,
  montarPagamento,
  resumirCiclo,
  situacaoTitulo,
  totalPago,
} from "@/lib/lancamentos";
import type { Registro } from "@/lib/tabelas";

const reg = (r: Partial<Registro>) => ({ atualizado_em: "", ...r }) as Registro;
const jose = reg({ id: "f1", nome: "José" });
const morango = reg({ id: "p1", nome: "Morango", unidade: "bandeja", kg_por_unidade: 0.25 });
const caixa = reg({ id: "p2", nome: "Morango caixa", unidade: "caixa", kg_por_unidade: 4 });
const semPeso = reg({ id: "p3", nome: "Abacaxi", unidade: "unidade" });
const de = (g: Gravacao[], t: string) => g.filter((x) => x.tabela === t);

describe("compra", () => {
  const base = {
    data: "2026-11-02",
    fornecedor: jose,
    origem: "regional" as const,
    viagem_id: null,
    observacao: null,
    itens: [
      { produto_id: "p2", classificacao_id: "t1", quantidade: 10, preco_unitario: 20 },
      { produto_id: "p2", classificacao_id: "t2", quantidade: 5, preco_unitario: 12.5 },
    ],
  };

  it("gera itens, entrada no estoque e conta a pagar com vencimento", () => {
    const g = montarCompra({ ...base, pagamento: { tipo: "depois", vencimento: "2026-11-09" } });
    expect(de(g, "compras")).toHaveLength(1);
    expect(de(g, "compra_itens").map((i) => i.dados.total)).toEqual([200, 62.5]);
    const mov = de(g, "movimentos_estoque");
    expect(mov.map((m) => [m.dados.tipo, m.dados.quantidade, m.dados.custo_unitario])).toEqual([
      ["compra", 10, 20],
      ["compra", 5, 12.5],
    ]);
    const [t] = de(g, "titulos");
    expect(t.dados).toMatchObject({ tipo: "pagar", valor: 262.5, vencimento: "2026-11-09", fornecedor_id: "f1" });
    expect(de(g, "movimentos_caixa")).toHaveLength(0);
    // pai antes dos filhos
    expect(g[0].tabela).toBe("compras");
  });

  it("pago agora registra saída de caixa e baixa do valor total", () => {
    const g = montarCompra({ ...base, pagamento: { tipo: "agora", forma: "pix" } });
    const [m] = de(g, "movimentos_caixa");
    const [b] = de(g, "baixas");
    const [t] = de(g, "titulos");
    expect(m.dados).toMatchObject({ tipo: "saida", valor: 262.5, forma: "pix" });
    expect(b.dados).toMatchObject({ titulo_id: t.dados.id, movimento_id: m.dados.id, valor: 262.5 });
  });

  it("compra de retorno entra no estoque como retorno, ligada à viagem", () => {
    const g = montarCompra({ ...base, origem: "retorno", viagem_id: "v1", pagamento: { tipo: "agora", forma: "dinheiro" } });
    expect(de(g, "compras")[0].dados.viagem_id).toBe("v1");
    expect(de(g, "movimentos_estoque").every((m) => m.dados.tipo === "retorno")).toBe(true);
  });

  it("não aceita compra sem itens", () => {
    expect(() => montarCompra({ ...base, itens: [], pagamento: { tipo: "agora", forma: "pix" } })).toThrow();
  });

  it("cancelamento marca tudo, menos o que já estava cancelado", () => {
    const g = montarCancelamento([
      { tabela: "compras", lista: [reg({ id: "c1" })] },
      { tabela: "baixas", lista: [reg({ id: "b1", cancelado_em: "2026-01-01" }), reg({ id: "b2" })] },
    ]);
    expect(g.map((x) => x.dados.id)).toEqual(["c1", "b2"]);
    expect(g.every((x) => x.dados.cancelado_em)).toBe(true);
  });
});

describe("situação das contas", () => {
  const t = reg({ id: "t1", valor: 100, vencimento: "2026-11-05", tipo: "pagar" });
  it("pendente, vencida, parcial e paga", () => {
    expect(situacaoTitulo(t, [], "2026-11-02")).toBe("pendente");
    expect(situacaoTitulo(t, [], "2026-11-06")).toBe("vencida");
    const b1 = reg({ id: "b1", titulo_id: "t1", valor: 40 });
    expect(situacaoTitulo(t, [b1], "2026-11-06")).toBe("parcial");
    const b2 = reg({ id: "b2", titulo_id: "t1", valor: 60 });
    expect(situacaoTitulo(t, [b1, b2], "2026-11-06")).toBe("paga");
    expect(totalPago(t, [b1, reg({ id: "b3", titulo_id: "t1", valor: 60, cancelado_em: "x" })])).toBe(40);
  });
  it("pagamento parcial gera movimento do valor informado", () => {
    const g = montarPagamento({ titulo: t, valor: 30.456, forma: "dinheiro", data: "2026-11-03" });
    expect(g[0].dados).toMatchObject({ tipo: "saida", valor: 30.46 });
    expect(g[1].dados).toMatchObject({ titulo_id: "t1", valor: 30.46 });
  });
  it("conta a receber gera entrada de caixa", () => {
    const g = montarPagamento({ titulo: reg({ id: "t2", tipo: "receber" }), valor: 10, forma: "pix", data: "2026-11-03" });
    expect(g[0].dados.tipo).toBe("entrada");
  });
});

describe("despesa", () => {
  const adubo = reg({ id: "cat1", nome: "Adubo" });
  it("despesa de produção a pagar fica ligada ao ciclo", () => {
    const g = montarDespesa({
      data: "2026-11-02",
      categoria: adubo,
      descricao: "NPK 20 sacos",
      valor: 850,
      favorecido: "Agropecuária Datas",
      motorista_id: null,
      viagem_id: null,
      ciclo_id: "ci1",
      pagamento: { tipo: "depois", vencimento: "2026-12-02" },
    });
    expect(de(g, "despesas")[0].dados).toMatchObject({ ciclo_id: "ci1", valor: 850 });
    expect(de(g, "titulos")[0].dados).toMatchObject({ valor: 850, vencimento: "2026-12-02", origem_tabela: "despesas" });
    expect(de(g, "movimentos_caixa")).toHaveLength(0);
  });
});

describe("produção própria", () => {
  const produtos = new Map([morango, caixa, semPeso].map((p) => [p.id, p]));

  it("custo por kg = despesas do ciclo ÷ kg colhidos", () => {
    const despesas = [reg({ id: "d1", valor: 300 }), reg({ id: "d2", valor: 100 }), reg({ id: "d3", valor: 999, cancelado_em: "x" })];
    // 100 bandejas de 0,25 kg + 25 caixas de 4 kg = 25 + 100 = 125 kg
    const r = resumirCiclo(despesas, [
      { produto_id: "p1", quantidade: 100 },
      { produto_id: "p2", quantidade: 25 },
    ], produtos);
    expect(r.custoTotal).toBe(400);
    expect(r.kgColhidos).toBe(125);
    expect(r.custoPorKg).toBeCloseTo(3.2);
    expect(custoUnitarioColheita(r, morango)).toBeCloseTo(0.8); // bandeja = 0,25 kg × 3,20
    expect(custoUnitarioColheita(r, caixa)).toBeCloseTo(12.8); // caixa = 4 kg × 3,20
  });

  it("sem conversão para kg, divide o custo pelas unidades", () => {
    const r = resumirCiclo([reg({ id: "d", valor: 150 })], [{ produto_id: "p3", quantidade: 50 }], produtos);
    expect(r.custoPorKg).toBeNull();
    expect(custoUnitarioColheita(r, semPeso)).toBe(3);
  });

  it("colheita entra no estoque com origem produção própria e custo", () => {
    const g = montarColheita({
      data: "2026-11-02",
      ciclo_id: "ci1",
      observacao: null,
      itens: [{ produto_id: "p1", classificacao_id: "t1", quantidade: 80 }],
      custoUnitario: () => 0.8,
    });
    const [m] = de(g, "movimentos_estoque");
    expect(m.dados).toMatchObject({ tipo: "colheita", quantidade: 80, custo_unitario: 0.8 });
    expect(m.dados.origem_id).toBe(de(g, "colheita_itens")[0].dados.id);
  });
});
