import { describe, expect, it } from "vitest";
import { calcularEstoque, chaveEstoque, custoDeSaida, estaParado } from "@/lib/estoque";
import type { Registro } from "@/lib/tabelas";

let n = 0;
const mov = (data: string, quantidade: number, custo?: number, extra: Partial<Registro> = {}) =>
  ({
    id: `m${++n}`,
    atualizado_em: "",
    criado_em: `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`,
    data,
    produto_id: "p1",
    classificacao_id: "t1",
    quantidade,
    custo_unitario: custo ?? null,
    ...extra,
  }) as Registro;

const K = chaveEstoque("p1", "t1");

describe("estoque", () => {
  it("saldo e custo médio das entradas que ainda estão em estoque", () => {
    const e = calcularEstoque([mov("2026-11-01", 10, 20), mov("2026-11-02", 10, 25), mov("2026-11-02", -12)], "2026-11-02");
    const s = e.get(K)!;
    // Saíram as 10 de R$ 20 e 2 das de R$ 25: sobram 8 a R$ 25.
    expect(s.saldo).toBe(8);
    expect(s.custoMedio).toBe(25);
    expect(s.valor).toBe(200);
  });

  it("dias parado conta a entrada mais antiga que sobrou", () => {
    const e = calcularEstoque([mov("2026-10-28", 10, 20), mov("2026-11-01", 5, 22), mov("2026-11-01", -4)], "2026-11-02");
    const s = e.get(K)!;
    expect(s.entradaMaisAntiga).toBe("2026-10-28");
    expect(s.diasParado).toBe(5);
    expect(estaParado(s, 3)).toBe(true);
    expect(estaParado(s, 7)).toBe(false);
  });

  it("classificações têm saldos separados", () => {
    const e = calcularEstoque([mov("2026-11-01", 10, 20), mov("2026-11-01", 6, 12, { classificacao_id: "t2" })], "2026-11-01");
    expect(e.get(K)!.saldo).toBe(10);
    expect(e.get(chaveEstoque("p1", "t2"))!.saldo).toBe(6);
  });

  it("cancelados não contam", () => {
    const e = calcularEstoque([mov("2026-11-01", 10, 20), mov("2026-11-01", -10, undefined, { cancelado_em: "x" })], "2026-11-01");
    expect(e.get(K)!.saldo).toBe(10);
  });

  it("saída maior que o saldo fica negativa e a próxima entrada cobre", () => {
    let e = calcularEstoque([mov("2026-11-01", 5, 10), mov("2026-11-01", -8)], "2026-11-01");
    expect(e.get(K)!.saldo).toBe(-3);
    e = calcularEstoque([mov("2026-11-01", 5, 10), mov("2026-11-01", -8), mov("2026-11-02", 10, 12)], "2026-11-02");
    expect(e.get(K)!.saldo).toBe(7);
    expect(e.get(K)!.custoMedio).toBe(12);
  });

  it("ajuste positivo sem custo entra pelo custo médio", () => {
    const e = calcularEstoque([mov("2026-11-01", 10, 20), mov("2026-11-02", 2)], "2026-11-02");
    expect(e.get(K)!.saldo).toBe(12);
    expect(e.get(K)!.custoMedio).toBe(20);
  });

  it("custo de saída usa as entradas mais antigas", () => {
    const e = calcularEstoque([mov("2026-11-01", 10, 20), mov("2026-11-02", 10, 30)], "2026-11-02");
    expect(custoDeSaida(e.get(K), 15)).toBeCloseTo((10 * 20 + 5 * 30) / 15);
  });
});
