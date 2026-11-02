// Lista única das tabelas sincronizadas (mesmos nomes do banco no Supabase).
export const TABELAS = [
  "usuarios",
  "fornecedores",
  "clientes",
  "produtos",
  "classificacoes",
  "veiculos",
  "motoristas",
  "categorias_despesa",
  "motivos_perda",
  "areas",
  "ciclos",
  "colheitas",
  "colheita_itens",
  "viagens",
  "compras",
  "compra_itens",
  "vendas",
  "venda_itens",
  "movimentos_estoque",
  "despesas",
  "titulos",
  "movimentos_caixa",
  "baixas",
] as const;

export type NomeTabela = (typeof TABELAS)[number];

/** Tabelas que o perfil "campo" não consegue ler no servidor (RLS); não adianta baixar. */
export const SO_SOCIO: NomeTabela[] = ["clientes", "vendas", "venda_itens"];

export interface Registro {
  id: string;
  criado_por?: string | null;
  criado_em?: string;
  atualizado_em: string;
  sincronizado_em?: string | null;
  cancelado_em?: string | null;
  [campo: string]: unknown;
}
