// Cálculo do estoque a partir dos movimentos (nunca guardado como número solto).
// Saídas consomem as entradas mais antigas primeiro (PEPS), o que dá:
//   - saldo por produto + classificação
//   - custo médio = média ponderada das entradas que ainda estão em estoque
//   - dias parado = idade da entrada mais antiga ainda em estoque
import type { Registro } from "./tabelas";

export interface Camada {
  data: string;
  quantidade: number;
  custo: number;
}

export interface Saldo {
  chave: string;
  produto_id: string;
  classificacao_id: string | null;
  saldo: number;
  custoMedio: number;
  valor: number;
  entradaMaisAntiga: string | null;
  diasParado: number;
  ultimoMovimento: string;
  camadas: Camada[];
}

export const chaveEstoque = (produtoId: unknown, classificacaoId: unknown) => `${produtoId}|${classificacaoId ?? ""}`;

const EPS = 1e-6;

function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

function media(camadas: Camada[]): number {
  const q = camadas.reduce((s, c) => s + c.quantidade, 0);
  return q > EPS ? camadas.reduce((s, c) => s + c.quantidade * c.custo, 0) / q : 0;
}

export function ordenarMovimentos(movs: Registro[]): Registro[] {
  // Por data; no mesmo dia, entradas antes das saídas; depois pela hora do lançamento.
  return [...movs].sort(
    (a, b) =>
      String(a.data).localeCompare(String(b.data)) ||
      Number(Number(b.quantidade) > 0) - Number(Number(a.quantidade) > 0) ||
      String(a.criado_em ?? "").localeCompare(String(b.criado_em ?? "")),
  );
}

/** Calcula o saldo de cada produto + classificação. */
export function calcularEstoque(movimentos: Registro[], dataHoje: string): Map<string, Saldo> {
  const estado = new Map<string, { camadas: Camada[]; negativo: number; ultimo: string; ultimoCusto: number; p: string; c: string | null }>();
  for (const m of ordenarMovimentos(movimentos.filter((x) => !x.cancelado_em))) {
    const chave = chaveEstoque(m.produto_id, m.classificacao_id);
    let e = estado.get(chave);
    if (!e) {
      e = { camadas: [], negativo: 0, ultimo: String(m.data), ultimoCusto: 0, p: String(m.produto_id), c: (m.classificacao_id as string) ?? null };
      estado.set(chave, e);
    }
    e.ultimo = String(m.data);
    const q = Number(m.quantidade);
    if (q > 0) {
      const custo =
        m.custo_unitario !== null && m.custo_unitario !== undefined ? Number(m.custo_unitario) : media(e.camadas) || e.ultimoCusto;
      e.ultimoCusto = custo;
      // Entrada primeiro cobre o que ficou negativo (saída lançada antes da entrada).
      let resto = q;
      if (e.negativo > EPS) {
        const cobre = Math.min(e.negativo, resto);
        e.negativo -= cobre;
        resto -= cobre;
      }
      if (resto > EPS) e.camadas.push({ data: String(m.data), quantidade: resto, custo });
    } else if (q < 0) {
      let falta = -q;
      while (falta > EPS && e.camadas.length) {
        const c = e.camadas[0];
        const usa = Math.min(c.quantidade, falta);
        c.quantidade -= usa;
        falta -= usa;
        if (c.quantidade <= EPS) e.camadas.shift();
      }
      if (falta > EPS) e.negativo += falta;
    }
  }

  const resultado = new Map<string, Saldo>();
  for (const [chave, e] of estado) {
    const positivo = e.camadas.reduce((s, c) => s + c.quantidade, 0);
    const saldo = Math.round((positivo - e.negativo) * 1000) / 1000;
    const custoMedio = e.camadas.length ? media(e.camadas) : e.ultimoCusto;
    const entradaMaisAntiga = e.camadas[0]?.data ?? null;
    resultado.set(chave, {
      chave,
      produto_id: e.p,
      classificacao_id: e.c,
      saldo,
      custoMedio,
      valor: Math.max(saldo, 0) * custoMedio,
      entradaMaisAntiga,
      diasParado: entradaMaisAntiga && saldo > EPS ? diasEntre(entradaMaisAntiga, dataHoje) : 0,
      ultimoMovimento: e.ultimo,
      camadas: e.camadas.map((c) => ({ ...c })),
    });
  }
  return resultado;
}

/** Custo de saída de uma quantidade, consumindo as entradas mais antigas (para venda e perda). */
export function custoDeSaida(saldo: Saldo | undefined, quantidade: number): number {
  if (!saldo) return 0;
  let falta = quantidade;
  let total = 0;
  for (const c of saldo.camadas) {
    const usa = Math.min(c.quantidade, falta);
    total += usa * c.custo;
    falta -= usa;
    if (falta <= EPS) break;
  }
  if (falta > EPS) total += falta * saldo.custoMedio;
  return quantidade > 0 ? total / quantidade : 0;
}

export function estaParado(s: Saldo, diasAlerta: number): boolean {
  return s.saldo > EPS && s.diasParado >= diasAlerta;
}

export const ROTULO_TIPO: Record<string, string> = {
  compra: "Compra",
  colheita: "Colheita",
  retorno: "Compra de volta",
  venda: "Venda",
  devolucao: "Devolução",
  perda: "Perda",
  ajuste: "Ajuste de contagem",
};
