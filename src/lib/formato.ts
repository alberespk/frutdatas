// Formatação no padrão brasileiro: R$, dd/mm/aaaa, CPF/CNPJ e telefone.

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export function formatarMoeda(valor: number | null | undefined): string {
  return moeda.format(Number(valor ?? 0));
}

export function formatarNumero(valor: number | null | undefined): string {
  return numero.format(Number(valor ?? 0));
}

/** "2026-11-02" ou ISO completo -> "02/11/2026" */
export function formatarData(valor: string | null | undefined): string {
  if (!valor) return "";
  const [a, m, d] = valor.slice(0, 10).split("-");
  if (!a || !m || !d) return "";
  return `${d}/${m}/${a}`;
}

/** ISO completo -> "02/11/2026 14:35" no horário do aparelho */
export function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return "";
  const dt = new Date(valor);
  if (Number.isNaN(dt.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

/** Data de hoje no fuso do aparelho, no formato do banco (aaaa-mm-dd). */
export function hoje(agora: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

/** Soma dias a uma data aaaa-mm-dd. */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  return hoje(new Date(a, m - 1, d + dias));
}

/** Aceita "1.234,56", "1234,56", "1234.56" e devolve número (ou null se vazio/inválido). */
export function lerNumero(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : null;
  let t = texto.trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Número -> texto para campo de digitação ("12,5"). */
export function numeroParaCampo(valor: number | null | undefined, casas?: number): string {
  if (valor === null || valor === undefined || valor === ("" as unknown)) return "";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "";
  const t = casas === undefined ? String(n) : n.toFixed(casas);
  return t.replace(".", ",");
}

const soDigitos = (t: string) => t.replace(/\D/g, "");

export function mascararCpfCnpj(texto: string): string {
  const d = soDigitos(texto).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function mascararTelefone(texto: string): string {
  const d = soDigitos(texto).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Link de WhatsApp a partir de um telefone brasileiro. */
export function linkWhatsApp(telefone: string | null | undefined): string | null {
  const d = soDigitos(telefone ?? "");
  if (d.length < 10) return null;
  return `https://wa.me/55${d}`;
}

/** Busca sem acento e sem diferenciar maiúsculas. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
