import { describe, expect, it } from "vitest";
import { resumirPainel } from "@/lib/painel";
import type { Registro } from "@/lib/tabelas";

const reg = (r: Partial<Registro>) => ({ atualizado_em: "", ...r }) as Registro;

describe("painel", () => {
  it("soma o período e ranqueia produtores e clientes", () => {
    const r = resumirPainel({
      compras: [
        reg({ id: "c1", data: "2026-11-02", fornecedor_id: "f1" }),
        reg({ id: "c2", data: "2026-11-02", fornecedor_id: "f2" }),
        reg({ id: "c3", data: "2026-10-01", fornecedor_id: "f2" }),
      ],
      compraItens: [
        reg({ id: "ci1", compra_id: "c1", total: 100 }),
        reg({ id: "ci2", compra_id: "c2", total: 300 }),
        reg({ id: "ci3", compra_id: "c3", total: 999 }),
      ],
      vendas: [reg({ id: "v1", data: "2026-11-02", cliente_id: "k1" })],
      vendaItens: [reg({ id: "i1", venda_id: "v1", quantidade: 10, preco_unitario: 30 })],
      movimentos: [
        reg({ id: "m1", tipo: "venda", origem_id: "i1", custo_unitario: 20, data: "2026-11-02", quantidade: -10 }),
        reg({ id: "m2", tipo: "perda", data: "2026-11-02", quantidade: -2, custo_unitario: 20 }),
      ],
      despesas: [reg({ id: "d1", data: "2026-11-02", valor: 50 })],
      de: "2026-11-01",
      ate: "2026-11-02",
    });
    expect(r).toMatchObject({ compras: 400, qtdCompras: 2, vendas: 300, margem: 100, perdas: 40, despesas: 50 });
    expect(r.produtores.map((p) => p.id)).toEqual(["f2", "f1"]);
    expect(r.clientes).toEqual([{ id: "k1", valor: 300 }]);
  });
});
