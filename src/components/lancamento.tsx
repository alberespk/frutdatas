"use client";
// Peças das telas de lançamento: escolher da lista, número, pagamento.
import { useState, type ReactNode } from "react";
import { formatarData, lerNumero, normalizar, numeroParaCampo, somarDias } from "@/lib/formato";
import type { FormaPagamento, Pagamento } from "@/lib/lancamentos";
import type { Registro } from "@/lib/tabelas";
import { classeEntrada, Rotulo, Vazio } from "./ui";

/** Lista com busca para escolher um registro com um toque. */
export function EscolherDaLista({
  itens,
  titulo,
  detalhe,
  aoEscolher,
  selecionado,
  vazio = "Nada cadastrado.",
  extra,
}: {
  itens: Registro[] | undefined;
  titulo: (r: Registro) => string;
  detalhe?: (r: Registro) => string;
  aoEscolher: (r: Registro) => void;
  selecionado?: string | null;
  vazio?: string;
  extra?: ReactNode;
}) {
  const [busca, setBusca] = useState("");
  const termo = normalizar(busca);
  const lista = (itens ?? []).filter(
    (r) => !termo || normalizar(`${titulo(r)} ${detalhe?.(r) ?? ""}`).includes(termo),
  );
  return (
    <div className="space-y-3">
      {(itens?.length ?? 0) > 6 ? (
        <input className={classeEntrada} type="search" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      ) : null}
      {extra}
      {lista.length === 0 ? (
        <Vazio>{busca ? "Nada encontrado." : vazio}</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borda">
          {lista.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => aoEscolher(r)}
              className={`flex min-h-16 w-full items-center gap-3 border-b border-borda px-4 py-3 text-left last:border-b-0 ${
                selecionado === r.id ? "bg-serra/10" : "bg-white active:bg-fundo"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{titulo(r)}</div>
                {detalhe?.(r) ? <div className="truncate text-sm text-suave">{detalhe(r)}</div> : null}
              </div>
              {selecionado === r.id ? <span className="text-xl text-serra">✓</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Botões grandes para escolher uma opção curta. */
export function Opcoes<T extends string | null>({
  opcoes,
  valor,
  aoMudar,
  colunas = 2,
}: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  aoMudar: (v: T) => void;
  colunas?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          onClick={() => aoMudar(o.valor)}
          className={`min-h-14 rounded-xl border-2 px-3 font-semibold ${
            valor === o.valor ? "border-serra bg-serra text-white" : "border-borda bg-white"
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Campo numérico no padrão brasileiro (vírgula), com teclado numérico. */
export function EntradaNumero({
  valor,
  aoMudar,
  dinheiro,
  inteiro,
  sufixo,
  autoFocus,
}: {
  valor: number | null;
  aoMudar: (v: number | null) => void;
  dinheiro?: boolean;
  inteiro?: boolean;
  sufixo?: string;
  autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState(() => numeroParaCampo(valor, dinheiro && valor != null ? 2 : undefined));
  const [ultimo, setUltimo] = useState(valor);
  // Valor trocado por fora (ex.: preço sugerido): atualiza o texto.
  if (valor !== ultimo) {
    setUltimo(valor);
    if (valor !== lerNumero(texto)) setTexto(numeroParaCampo(valor, dinheiro && valor != null ? 2 : undefined));
  }
  return (
    <div className="relative">
      {dinheiro ? <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-suave">R$</span> : null}
      <input
        autoFocus={autoFocus}
        className={`${classeEntrada} text-xl ${dinheiro ? "pl-12" : ""} ${sufixo ? "pr-24" : ""}`}
        inputMode={inteiro ? "numeric" : "decimal"}
        value={texto}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, "");
          setTexto(t);
          const n = lerNumero(t);
          setUltimo(n);
          aoMudar(n);
        }}
      />
      {sufixo ? (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-suave">{sufixo}</span>
      ) : null}
    </div>
  );
}

const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "pix", rotulo: "Pix" },
  { valor: "dinheiro", rotulo: "Dinheiro" },
];

/** Pagar agora (Pix/dinheiro) ou deixar a pagar com vencimento. */
export function EscolherPagamento({
  valor,
  aoMudar,
  data,
  textoDepois = "Pagar depois",
}: {
  valor: Pagamento;
  aoMudar: (p: Pagamento) => void;
  data: string;
  textoDepois?: string;
}) {
  return (
    <div className="space-y-3">
      <Opcoes
        colunas={3}
        opcoes={[
          { valor: "pix", rotulo: "Pago no Pix" },
          { valor: "dinheiro", rotulo: "Pago em dinheiro" },
          { valor: "depois", rotulo: textoDepois },
        ]}
        valor={valor.tipo === "agora" ? valor.forma : "depois"}
        aoMudar={(v) =>
          aoMudar(v === "depois" ? { tipo: "depois", vencimento: somarDias(data, 7) } : { tipo: "agora", forma: v as FormaPagamento })
        }
      />
      {valor.tipo === "depois" ? (
        <Rotulo texto="Vencimento" ajuda={`Fica em contas a pagar até ${formatarData(valor.vencimento)}.`}>
          <input
            type="date"
            className={classeEntrada}
            value={valor.vencimento}
            onChange={(e) => aoMudar({ tipo: "depois", vencimento: e.target.value || data })}
          />
        </Rotulo>
      ) : null}
    </div>
  );
}

export { FORMAS };

export function Selo({ situacao, receber }: { situacao: "paga" | "parcial" | "pendente" | "vencida"; receber?: boolean }) {
  const cores = {
    paga: "bg-folha/30 text-serra",
    parcial: "bg-maracuja/25 text-tinta",
    pendente: "bg-borda text-tinta",
    vencida: "bg-morango/15 text-morango",
  };
  const textos = receber
    ? { paga: "Recebido", parcial: "Parcial", pendente: "A receber", vencida: "Vencido" }
    : { paga: "Pago", parcial: "Parcial", pendente: "A pagar", vencida: "Vencido" };
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${cores[situacao]}`}>{textos[situacao]}</span>;
}

export function Passos({ atual, total }: { atual: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Passo ${atual} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i < atual ? "bg-serra" : "bg-borda"}`} />
      ))}
    </div>
  );
}
