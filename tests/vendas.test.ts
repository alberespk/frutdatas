import { describe, expect, it } from "vitest";
import type { Gravacao } from "@/lib/lancamentos";
import type { Registro } from "@/lib/tabelas";
import { margemVenda, montarAcerto, montarDesfazerAcerto, montarVenda, proximoNumero, textoRomaneio } from "@/lib/vendas";

const reg = (r: Partial<Registro>) => ({ atualizado_em: "", ...r }) as Registro;
const de = (g: Gravacao[], t: string) => g.filter((x) => x.tabela === t);
const cliente = reg({ id: "cl1", nome: "Box 17 CEASA", prazo_dias: 10 });

describe("número do romaneio", () => {
  it("sequência por letra do usuário", () => {
    expect(proximoNumero("A", [])).toBe("A-0001");
    expect(proximoNumero("A", ["A-0001", "A-0009", "B-0050"])).toBe("A-0010");
    expect(proximoNumero("B", ["A-0001", "B-0050"])).toBe("B-0051");
  });
});

describe("venda", () => {
  const base = {
    numero: "A-0001",
    data: "2026-11-02",
    cliente,
    viagem_id: null,
    prazo_dias: 10,
    observacao: null,
    itens: [{ produto_id: "p1", classificacao_id: "t1", quantidade: 20, preco_unitario: 30, custo_unitario: 20 }],
  };

  it("a prazo: saída do estoque e conta a receber com vencimento pelo prazo", () => {
    const g = montarVenda({ ...base, recebimento: { tipo: "prazo" } });
    expect(de(g, "vendas")[0].dados).toMatchObject({ numero: "A-0001", vencimento: "2026-11-12", situacao: "aberta" });
    expect(de(g, "movimentos_estoque")[0].dados).toMatchObject({ tipo: "venda", quantidade: -20, custo_unitario: 20 });
    expect(de(g, "titulos")[0].dados).toMatchObject({ tipo: "receber", valor: 600, vencimento: "2026-11-12", cliente_id: "cl1" });
    expect(de(g, "movimentos_caixa")).toHaveLength(0);
  });

  it("à vista: entrada no caixa", () => {
    const g = montarVenda({ ...base, recebimento: { tipo: "agora", forma: "pix" } });
    expect(de(g, "movimentos_caixa")[0].dados).toMatchObject({ tipo: "entrada", valor: 600 });
  });
});

describe("acerto", () => {
  const venda = reg({ id: "v1", numero: "A-0001" });
  const titulo = reg({ id: "t1", valor: 600 });
  const item = reg({ id: "i1", produto_id: "p1", classificacao_id: "t1", quantidade: 20, preco_unitario: 30 });
  const movimento = reg({ id: "m1", origem_id: "i1", tipo: "venda", custo_unitario: 20 });

  it("devolução volta ao estoque ao custo da saída e a conta passa ao valor acertado", () => {
    const g = montarAcerto({
      venda,
      titulo,
      data: "2026-11-05",
      motivoPerdaId: null,
      itens: [{ item, movimento, quantidade_acerto: 18, preco_acerto: 28, destino_devolucao: "estoque" }],
    });
    expect(de(g, "venda_itens")[0].dados).toMatchObject({ quantidade_acerto: 18, preco_acerto: 28, quantidade_devolvida: 2 });
    expect(de(g, "movimentos_estoque").map((m) => [m.dados.tipo, m.dados.quantidade, m.dados.custo_unitario])).toEqual([
      ["devolucao", 2, 20],
    ]);
    expect(de(g, "titulos")[0].dados).toMatchObject({ id: "t1", valor: 504 });
    expect(de(g, "vendas")[0].dados).toMatchObject({ situacao: "acertada", data_acerto: "2026-11-05" });
  });

  it("devolução sem condição vira perda (volta e sai)", () => {
    const g = montarAcerto({
      venda,
      titulo,
      data: "2026-11-05",
      motivoPerdaId: "mp4",
      itens: [{ item, movimento, quantidade_acerto: 17, preco_acerto: 30, destino_devolucao: "perda" }],
    });
    expect(de(g, "movimentos_estoque").map((m) => [m.dados.tipo, m.dados.quantidade])).toEqual([
      ["devolucao", 3],
      ["perda", -3],
    ]);
  });

  it("não aceita acerto maior que o vendido", () => {
    expect(() =>
      montarAcerto({ venda, titulo, data: "2026-11-05", motivoPerdaId: null, itens: [{ item, movimento, quantidade_acerto: 21, preco_acerto: 30, destino_devolucao: "estoque" }] }),
    ).toThrow();
  });

  it("margem usa o valor acertado e o custo do que ficou com o cliente", () => {
    const acertado = reg({ ...item, quantidade_acerto: 18, preco_acerto: 28 });
    expect(margemVenda([acertado], [movimento])).toMatchObject({ receita: 504, custo: 360, margem: 144 });
    expect(margemVenda([item], [movimento])).toMatchObject({ receita: 600, custo: 400, margem: 200 });
  });

  it("texto do romaneio para WhatsApp", () => {
    const t = textoRomaneio({
      venda: reg({ numero: "A-0001", data: "2026-11-02", vencimento: "2026-11-12", situacao: "aberta" }),
      cliente,
      itens: [item],
      nomeItem: () => "Morango Tipo 1",
      unidade: () => "cx",
    });
    expect(t).toContain("Romaneio A-0001");
    expect(t).toContain("20 cx Morango Tipo 1");
    expect(t.replace(/\s/g, " ")).toContain("Total: R$ 600,00");
    expect(t).toContain("Rua Vereador Pedro Rosa, 87");
  });
});

describe("desfazer acerto", () => {
  it("cancela devolução e perda, limpa os itens e volta o valor da venda", () => {
    const venda = reg({ id: "v1", numero: "A-0001", situacao: "acertada" });
    const titulo = reg({ id: "t1", valor: 360 });
    const itens = [reg({ id: "i1", quantidade: 20, preco_unitario: 30, quantidade_acerto: 12, preco_acerto: 30 })];
    const movimentos = [
      reg({ id: "m1", tipo: "venda", origem_id: "i1" }),
      reg({ id: "m2", tipo: "devolucao", origem_id: "i1" }),
      reg({ id: "m3", tipo: "perda", origem_id: "i1" }),
    ];
    const g = montarDesfazerAcerto({ venda, titulo, itens, movimentos });
    const cancelados = de(g, "movimentos_estoque").map((x) => x.dados.id);
    expect(cancelados).toEqual(["m2", "m3"]);
    expect(de(g, "venda_itens")[0].dados).toMatchObject({ quantidade_acerto: null, quantidade_devolvida: 0 });
    expect(de(g, "vendas")[0].dados).toMatchObject({ situacao: "aberta", data_acerto: null });
    expect(de(g, "titulos")[0].dados).toMatchObject({ valor: 600 });
  });
});
