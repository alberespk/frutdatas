import { describe, expect, it } from "vitest";
import type { Registro } from "@/lib/tabelas";
import { diasViagem, montarEncerramento, resultadoViagem } from "@/lib/viagens";

const reg = (r: Partial<Registro>) => ({ atualizado_em: "", ...r }) as Registro;

describe("viagem", () => {
  it("conta os dias incluindo saída e volta", () => {
    expect(diasViagem("2026-11-02", "2026-11-04")).toBe(3);
    expect(diasViagem("2026-11-02", null)).toBe(1);
  });

  it("resultado = receita − CMV − despesas; volta aparece à parte", () => {
    const viagem = reg({ id: "vg1", km_inicial: 1000, km_final: 1600, destino: "CEASA BH" });
    const r = resultadoViagem({
      viagem,
      vendas: [reg({ id: "v1", viagem_id: "vg1" }), reg({ id: "v2", viagem_id: "outra" }), reg({ id: "v3", viagem_id: "vg1", cancelado_em: "x" })],
      vendaItens: [
        reg({ id: "i1", venda_id: "v1", quantidade: 10, preco_unitario: 30, quantidade_acerto: 8, preco_acerto: 30 }),
        reg({ id: "i2", venda_id: "v2", quantidade: 5, preco_unitario: 30 }),
      ],
      movimentos: [reg({ id: "m1", origem_id: "i1", tipo: "venda", custo_unitario: 20 })],
      despesas: [reg({ id: "d1", viagem_id: "vg1", valor: 300 }), reg({ id: "d2", viagem_id: "vg1", valor: 60 })],
      comprasVolta: [reg({ id: "c1", viagem_id: "vg1" })],
      compraItens: [reg({ id: "ci1", compra_id: "c1", total: 450 })],
    });
    expect(r).toMatchObject({ receita: 240, cmv: 160, despesas: 360, resultado: -280, km: 600, custoPorKm: 0.6, vendas: 1 });
    expect(r.volta).toEqual({ compras: 1, valor: 450 });
  });

  it("encerrar lança a diária do motorista como conta a pagar", () => {
    const g = montarEncerramento({
      viagem: reg({ id: "vg1", destino: "CEASA BH" }),
      data_volta: "2026-11-04",
      km_final: 1600,
      diaria: { categoria: reg({ id: "k1", nome: "Diária motorista" }), motorista: reg({ id: "mo1", nome: "Zé" }), dias: 3, valorDia: 120, vencimento: "2026-11-04" },
    });
    expect(g[0].dados).toMatchObject({ situacao: "encerrada", km_final: 1600 });
    expect(g.find((x) => x.tabela === "despesas")?.dados).toMatchObject({ valor: 360, motorista_id: "mo1", viagem_id: "vg1" });
    expect(g.find((x) => x.tabela === "titulos")?.dados).toMatchObject({ tipo: "pagar", valor: 360 });
    expect(g.some((x) => x.tabela === "movimentos_caixa")).toBe(false);
  });
});
