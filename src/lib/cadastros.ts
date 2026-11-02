// Definição das telas de cadastro: cada cadastro é uma lista + formulário
// gerados a partir desta configuração.
import type { NomeTabela, Registro } from "./tabelas";
import { formatarMoeda, formatarNumero } from "./formato";

export type TipoCampo =
  | "texto"
  | "telefone"
  | "cpfcnpj"
  | "inteiro"
  | "decimal"
  | "dinheiro"
  | "opcoes"
  | "referencia"
  | "data"
  | "textoLongo";

export interface Campo {
  nome: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  ajuda?: string;
  padrao?: unknown;
  opcoes?: { valor: string; rotulo: string }[];
  /** Para tipo "referencia": de qual tabela escolher. */
  referencia?: NomeTabela;
  /** Só mostra o campo quando a condição for verdadeira. */
  mostrarSe?: (r: Partial<Registro>) => boolean;
}

export interface Cadastro {
  rota: string;
  tabela: NomeTabela;
  titulo: string;
  singular: string;
  campos: Campo[];
  titulo_item: (r: Registro) => string;
  detalhe: (r: Registro, nomes: (tabela: NomeTabela, id: unknown) => string) => string;
  ordenar?: (a: Registro, b: Registro) => number;
}

export const UNIDADES = [
  { valor: "caixa", rotulo: "Caixa" },
  { valor: "bandeja", rotulo: "Bandeja / cumbuca" },
  { valor: "kg", rotulo: "Kg" },
  { valor: "saca", rotulo: "Saca" },
  { valor: "unidade", rotulo: "Unidade" },
];

export const CATEGORIAS_PRODUTO = [
  { valor: "in_natura", rotulo: "In natura" },
  { valor: "polpa", rotulo: "Polpa" },
  { valor: "outros", rotulo: "Outros" },
];

const rotuloDe = (lista: { valor: string; rotulo: string }[], v: unknown) =>
  lista.find((o) => o.valor === v)?.rotulo ?? "";

const juntar = (...partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(" · ");

const porNome = (a: Registro, b: Registro) => String(a.nome ?? "").localeCompare(String(b.nome ?? ""), "pt-BR");

export const CADASTROS: Cadastro[] = [
  {
    rota: "fornecedores",
    tabela: "fornecedores",
    titulo: "Produtores e fornecedores",
    singular: "fornecedor",
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true },
      {
        nome: "tipo",
        rotulo: "Tipo",
        tipo: "opcoes",
        padrao: "produtor",
        opcoes: [
          { valor: "produtor", rotulo: "Produtor rural" },
          { valor: "fornecedor_destino", rotulo: "Fornecedor de destino (polpa, CEASA)" },
        ],
      },
      { nome: "telefone", rotulo: "Telefone / WhatsApp", tipo: "telefone" },
      { nome: "chave_pix", rotulo: "Chave Pix", tipo: "texto" },
      { nome: "cpf_cnpj", rotulo: "CPF ou CNPJ", tipo: "cpfcnpj" },
      { nome: "localidade", rotulo: "Comunidade / localidade", tipo: "texto" },
      { nome: "cidade", rotulo: "Cidade", tipo: "texto", padrao: "Datas" },
      { nome: "observacao", rotulo: "Observação", tipo: "textoLongo" },
    ],
    titulo_item: (r) => String(r.nome),
    detalhe: (r) =>
      juntar(
        r.tipo === "fornecedor_destino" ? "Fornecedor de destino" : "Produtor",
        (r.localidade as string) || (r.cidade as string),
        r.telefone as string,
      ),
    ordenar: porNome,
  },
  {
    rota: "clientes",
    tabela: "clientes",
    titulo: "Clientes / parceiros",
    singular: "cliente",
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true },
      { nome: "cidade", rotulo: "Cidade", tipo: "texto" },
      { nome: "contato", rotulo: "Pessoa de contato", tipo: "texto" },
      { nome: "telefone", rotulo: "Telefone / WhatsApp", tipo: "telefone" },
      {
        nome: "prazo_dias",
        rotulo: "Prazo de pagamento (dias)",
        tipo: "inteiro",
        padrao: 0,
        ajuda: "0 = à vista",
      },
      { nome: "observacao", rotulo: "Observação", tipo: "textoLongo" },
    ],
    titulo_item: (r) => String(r.nome),
    detalhe: (r) =>
      juntar(
        r.cidade as string,
        Number(r.prazo_dias) > 0 ? `prazo ${r.prazo_dias} dias` : "à vista",
        r.telefone as string,
      ),
    ordenar: porNome,
  },
  {
    rota: "produtos",
    tabela: "produtos",
    titulo: "Produtos",
    singular: "produto",
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true },
      { nome: "categoria", rotulo: "Categoria", tipo: "opcoes", opcoes: CATEGORIAS_PRODUTO, padrao: "in_natura" },
      { nome: "unidade", rotulo: "Unidade", tipo: "opcoes", opcoes: UNIDADES, padrao: "caixa" },
      {
        nome: "kg_por_unidade",
        rotulo: "Kg por unidade",
        tipo: "decimal",
        ajuda: "Ex.: caixa de morango = 4. Deixe vazio se não souber.",
        mostrarSe: (r) => r.unidade !== "kg",
      },
      {
        nome: "dias_alerta",
        rotulo: "Alerta de parado após (dias)",
        tipo: "inteiro",
        padrao: 3,
        obrigatorio: true,
      },
    ],
    titulo_item: (r) => String(r.nome),
    detalhe: (r) =>
      juntar(
        rotuloDe(CATEGORIAS_PRODUTO, r.categoria),
        rotuloDe(UNIDADES, r.unidade),
        r.kg_por_unidade && r.unidade !== "kg" ? `${formatarNumero(Number(r.kg_por_unidade))} kg/un` : null,
      ),
    ordenar: porNome,
  },
  {
    rota: "classificacoes",
    tabela: "classificacoes",
    titulo: "Classificações",
    singular: "classificação",
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true, ajuda: "Ex.: Tipo 1, Tipo 2, Extra" },
      { nome: "ordem", rotulo: "Ordem na lista", tipo: "inteiro", padrao: 0 },
    ],
    titulo_item: (r) => String(r.nome),
    detalhe: (r) => `ordem ${r.ordem ?? 0}`,
    ordenar: (a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0),
  },
  {
    rota: "veiculos",
    tabela: "veiculos",
    titulo: "Veículos",
    singular: "veículo",
    campos: [
      { nome: "placa", rotulo: "Placa", tipo: "texto", obrigatorio: true },
      { nome: "descricao", rotulo: "Descrição", tipo: "texto", ajuda: "Ex.: Caminhão baú 3/4" },
      { nome: "capacidade", rotulo: "Capacidade", tipo: "texto" },
    ],
    titulo_item: (r) => String(r.placa).toUpperCase(),
    detalhe: (r) => juntar(r.descricao as string, r.capacidade as string),
    ordenar: (a, b) => String(a.placa).localeCompare(String(b.placa)),
  },
  {
    rota: "motoristas",
    tabela: "motoristas",
    titulo: "Motoristas e ajudantes",
    singular: "motorista",
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true },
      { nome: "telefone", rotulo: "Telefone / WhatsApp", tipo: "telefone" },
      {
        nome: "forma_pagamento",
        rotulo: "Forma de pagamento",
        tipo: "opcoes",
        padrao: "diaria",
        opcoes: [
          { valor: "diaria", rotulo: "Diária" },
          { valor: "mensal", rotulo: "Mensal" },
        ],
      },
      {
        nome: "valor_diaria",
        rotulo: "Valor da diária (R$)",
        tipo: "dinheiro",
        mostrarSe: (r) => r.forma_pagamento !== "mensal",
      },
      {
        nome: "usuario_id",
        rotulo: "Login no sistema (opcional)",
        tipo: "referencia",
        referencia: "usuarios",
      },
    ],
    titulo_item: (r) => String(r.nome),
    detalhe: (r) =>
      juntar(
        r.forma_pagamento === "mensal"
          ? "Mensal"
          : `Diária${r.valor_diaria ? ` ${formatarMoeda(Number(r.valor_diaria))}` : ""}`,
        r.telefone as string,
      ),
    ordenar: porNome,
  },
  {
    rota: "categorias-despesa",
    tabela: "categorias_despesa",
    titulo: "Categorias de despesa",
    singular: "categoria",
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true },
      {
        nome: "grupo",
        rotulo: "Grupo",
        tipo: "opcoes",
        padrao: "geral",
        opcoes: [
          { valor: "viagem", rotulo: "Viagem" },
          { valor: "producao", rotulo: "Produção própria" },
          { valor: "geral", rotulo: "Geral" },
          { valor: "retirada", rotulo: "Retirada de sócio" },
        ],
      },
    ],
    titulo_item: (r) => String(r.nome),
    detalhe: (r) =>
      ({ viagem: "Viagem", producao: "Produção própria", geral: "Geral", retirada: "Retirada de sócio" })[
        String(r.grupo)
      ] ?? "",
    ordenar: (a, b) => String(a.grupo).localeCompare(String(b.grupo)) || porNome(a, b),
  },
  {
    rota: "motivos-perda",
    tabela: "motivos_perda",
    titulo: "Motivos de perda",
    singular: "motivo",
    campos: [{ nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true }],
    titulo_item: (r) => String(r.nome),
    detalhe: () => "",
    ordenar: porNome,
  },
  {
    rota: "areas",
    tabela: "areas",
    titulo: "Áreas / talhões",
    singular: "área",
    campos: [
      { nome: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true },
      { nome: "tamanho_ha", rotulo: "Tamanho (hectares)", tipo: "decimal" },
      { nome: "observacao", rotulo: "Observação", tipo: "textoLongo" },
    ],
    titulo_item: (r) => String(r.nome),
    detalhe: (r) => (r.tamanho_ha ? `${formatarNumero(Number(r.tamanho_ha))} ha` : ""),
    ordenar: porNome,
  },
];

export function acharCadastro(rota: string): Cadastro | undefined {
  return CADASTROS.find((c) => c.rota === rota);
}

/** Valida e converte os valores do formulário para o formato do banco. */
export function validar(cadastro: Cadastro, valores: Record<string, unknown>) {
  const erros: Record<string, string> = {};
  for (const c of cadastro.campos) {
    if (c.mostrarSe && !c.mostrarSe(valores)) continue;
    const v = valores[c.nome];
    const vazio = v === null || v === undefined || (typeof v === "string" && v.trim() === "");
    if (c.obrigatorio && vazio) erros[c.nome] = "Preencha este campo";
    if (!vazio && (c.tipo === "inteiro" || c.tipo === "decimal" || c.tipo === "dinheiro")) {
      if (typeof v !== "number" || !Number.isFinite(v)) erros[c.nome] = "Número inválido";
      else if (v < 0) erros[c.nome] = "Não pode ser negativo";
      else if (c.tipo === "inteiro" && !Number.isInteger(v)) erros[c.nome] = "Use um número inteiro";
    }
  }
  return erros;
}
