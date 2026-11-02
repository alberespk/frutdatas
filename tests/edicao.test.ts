import { describe, expect, it } from "vitest";
import { montarEdicaoCompra } from "@/lib/lancamentos";
import type { Registro } from "@/lib/tabelas";
import { montarEdicaoVenda } from "@/lib/vendas";

const reg = (r: Partial<Registro>) => ({ atualizado_em: "", ...r }) as Registro;

describe("editar compra", () => {
  it("mantém compra e conta, troca itens e estoque, ajusta valor sem mexer nos pagamentos", () => {
    const g = montarEdicaoCompra({
      compra: reg({ id: "c1" }),
      titulo: reg({ id: "t1" }),
      itensAntigos: [reg({ id: "i1" })],
      movimentosAntigos: [reg({ id: "m1" })],
      entrada: {
        data: "2026-11-02",
        fornecedor: reg({ id: "f2", nome: "Outro" }),
        origem: "regional",
        viagem_id: null,
        observacao: null,
        itens: [{ produto_id: "p1", classificacao_id: null, quantidade: 12, preco_unitario: 20 }],
      },
      vencimento: "2026-11-09",
    });
    const canc = g.filter((x) => x.dados.cancelado_em).map((x) => x.dados.id);
    expect(canc).toEqual(["m1", "i1"]);
    expect(g.find((x) => x.tabela === "compras")?.dados).toMatchObject({ id: "c1", fornecedor_id: "f2" });
    expect(g.find((x) => x.tabela === "titulos")?.dados).toMatchObject({ id: "t1", valor: 240, vencimento: "2026-11-09", fornecedor_id: "f2" });
    expect(g.find((x) => x.tabela === "compra_itens" && !x.dados.cancelado_em)?.dados).toMatchObject({ compra_id: "c1", total: 240 });
    expect(g.some((x) => x.tabela === "movimentos_caixa" || x.tabela === "baixas")).toBe(false);
  });
});

describe("editar venda", () => {
  const base = {
    venda: reg({ id: "v1", numero: "A-0007", situacao: "aberta" }),
    titulo: reg({ id: "t9" }),
    itensAntigos: [reg({ id: "i1" })],
    movimentosAntigos: [reg({ id: "m1", tipo: "venda" })],
    entrada: {
      data: "2026-11-02",
      cliente: reg({ id: "k1", nome: "Box" }),
      viagem_id: null,
      prazo_dias: 10,
      observacao: null,
      itens: [{ produto_id: "p1", classificacao_id: null, quantidade: 5, preco_unitario: 40, custo_unitario: 20 }],
    },
  };
  it("mantém número e conta, troca itens e saídas", () => {
    const g = montarEdicaoVenda(base);
    expect(g.find((x) => x.tabela === "vendas")?.dados).toMatchObject({ id: "v1", numero: "A-0007", vencimento: "2026-11-12" });
    expect(g.find((x) => x.tabela === "titulos")?.dados).toMatchObject({ id: "t9", valor: 200 });
    expect(g.filter((x) => x.dados.cancelado_em).map((x) => x.dados.id)).toEqual(["m1", "i1"]);
    expect(g.find((x) => x.tabela === "movimentos_estoque" && !x.dados.cancelado_em)?.dados).toMatchObject({ quantidade: -5, custo_unitario: 20 });
  });
  it("não edita venda acertada", () => {
    expect(() => montarEdicaoVenda({ ...base, venda: reg({ id: "v1", situacao: "acertada" }) })).toThrow();
  });
});
