import { describe, expect, it } from "vitest";
import {
  formatarData,
  formatarMoeda,
  hoje,
  lerNumero,
  linkWhatsApp,
  mascararCpfCnpj,
  mascararTelefone,
  normalizar,
  somarDias,
} from "@/lib/formato";

describe("formato brasileiro", () => {
  it("moeda em reais", () => {
    expect(formatarMoeda(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });
  it("datas dd/mm/aaaa", () => {
    expect(formatarData("2026-11-02")).toBe("02/11/2026");
    expect(hoje(new Date(2026, 10, 2))).toBe("2026-11-02");
    expect(somarDias("2026-11-25", 7)).toBe("2026-12-02");
  });
  it("lê números digitados com vírgula", () => {
    expect(lerNumero("1.234,56")).toBe(1234.56);
    expect(lerNumero("20,5")).toBe(20.5);
    expect(lerNumero("20.5")).toBe(20.5);
    expect(lerNumero("")).toBeNull();
    expect(lerNumero("abc")).toBeNull();
  });
  it("máscaras", () => {
    expect(mascararCpfCnpj("12345678900")).toBe("123.456.789-00");
    expect(mascararCpfCnpj("12345678000190")).toBe("12.345.678/0001-90");
    expect(mascararTelefone("38999795639")).toBe("(38) 99979-5639");
    expect(mascararTelefone("3832210000")).toBe("(38) 3221-0000");
    expect(linkWhatsApp("(38) 99979-5639")).toBe("https://wa.me/5538999795639");
  });
  it("busca sem acento", () => {
    expect(normalizar("Maracujá")).toBe("maracuja");
  });
});
