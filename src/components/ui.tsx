"use client";
// Peças de interface reutilizadas: botões grandes, campos e cartões.
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const estilos: Record<Variante, string> = {
  primario: "bg-serra text-white active:bg-serra-escuro disabled:opacity-50",
  secundario: "bg-white text-serra border-2 border-serra active:bg-fundo disabled:opacity-50",
  perigo: "bg-white text-morango border-2 border-morango active:bg-red-50 disabled:opacity-50",
  fantasma: "text-serra active:bg-white/60",
};

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={`min-h-14 w-full rounded-2xl px-5 font-marca text-lg font-semibold transition ${estilos[variante]} ${className}`}
    />
  );
}

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-borda bg-white p-4 ${className}`}>{children}</div>;
}

export function ItemLista({
  href,
  onClick,
  titulo,
  detalhe,
  direita,
  apagado,
}: {
  href?: string;
  onClick?: () => void;
  titulo: ReactNode;
  detalhe?: ReactNode;
  direita?: ReactNode;
  apagado?: boolean;
}) {
  const conteudo = (
    <>
      <div className="min-w-0 flex-1">
        <div className={`truncate font-semibold ${apagado ? "text-suave line-through" : ""}`}>{titulo}</div>
        {detalhe ? <div className="truncate text-sm text-suave">{detalhe}</div> : null}
      </div>
      {direita ?? <span className="text-2xl text-suave">›</span>}
    </>
  );
  const classe =
    "flex min-h-16 w-full items-center gap-3 border-b border-borda bg-white px-4 py-3 text-left last:border-b-0 active:bg-fundo";
  if (href)
    return (
      <Link href={href} className={classe}>
        {conteudo}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={classe}>
      {conteudo}
    </button>
  );
}

/**
 * Título de um campo. Com `grupo`, vira um grupo (para conjuntos de botões),
 * porque um <label> em volta de botões faria o toque no título apertar o 1º botão.
 */
export function Rotulo({ texto, obrigatorio, children, ajuda, erro, grupo }: {
  texto: string;
  obrigatorio?: boolean;
  children: ReactNode;
  ajuda?: string;
  erro?: string;
  grupo?: boolean;
}) {
  const Tag = grupo ? "div" : "label";
  return (
    <Tag className="block" {...(grupo ? { role: "group", "aria-label": texto } : {})}>
      <span className="mb-1 block font-semibold">
        {texto}
        {obrigatorio ? <span className="text-morango"> *</span> : null}
      </span>
      {children}
      {erro ? (
        <span className="mt-1 block text-sm font-semibold text-morango">{erro}</span>
      ) : ajuda ? (
        <span className="mt-1 block text-sm text-suave">{ajuda}</span>
      ) : null}
    </Tag>
  );
}

export const classeEntrada =
  "block min-h-14 w-full rounded-xl border-2 border-borda bg-white px-4 py-3 outline-none focus:border-serra";

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border-2 border-dashed border-borda p-8 text-center text-suave">{children}</div>;
}

export function EmBreve({ etapa, titulo, itens }: { etapa: number; titulo: string; itens: string[] }) {
  return (
    <Cartao className="space-y-3">
      <div className="inline-block rounded-full bg-maracuja/20 px-3 py-1 text-sm font-semibold text-tinta">
        Chega na Etapa {etapa}
      </div>
      <h2 className="font-marca text-2xl font-bold">{titulo}</h2>
      <ul className="list-disc space-y-1 pl-5 text-suave">
        {itens.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </Cartao>
  );
}

/** Rodinha girando, para mostrar que algo ainda está carregando. */
export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Bloco de "Carregando dados…" com a rodinha, no lugar de listas e telas. */
export function Carregando({ texto = "Carregando dados…" }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 rounded-2xl border border-borda bg-white p-8 text-suave">
      <Spinner className="h-6 w-6 text-serra" />
      <span>{texto}</span>
    </div>
  );
}

/** Barra pulsando no lugar de um número que ainda não chegou. */
export function Esqueleto({ className = "h-6 w-24" }: { className?: string }) {
  return <span aria-label="Carregando" className={`inline-block animate-pulse rounded-md bg-current opacity-15 align-middle ${className}`} />;
}
