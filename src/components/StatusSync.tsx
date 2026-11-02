"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ouvirSync, type StatusSync as Status } from "@/lib/sincronizador";

export function useStatusSync() {
  const [s, setS] = useState<Status>({ estado: "ocioso", pendentes: 0 });
  useEffect(() => ouvirSync(setS), []);
  return s;
}

export function textoStatus(s: Status): { texto: string; cor: string } {
  if (s.estado === "sincronizando") return { texto: "Sincronizando…", cor: "bg-maracuja" };
  if (s.estado === "erro") return { texto: "Erro ao sincronizar", cor: "bg-morango" };
  if (s.estado === "offline")
    return { texto: s.pendentes ? `Sem internet · ${s.pendentes} pendente(s)` : "Sem internet", cor: "bg-suave" };
  if (s.pendentes) return { texto: `${s.pendentes} pendente(s)`, cor: "bg-maracuja" };
  return { texto: "Sincronizado", cor: "bg-folha" };
}

const NUVEM = "M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-.5 9.5H7Z";

/** Ícone de nuvem conforme o estado da sincronização. */
function IconeSync({ s }: { s: Status }) {
  const comum = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 ${s.estado === "sincronizando" ? "animate-pulse" : ""}`} aria-hidden>
      <path d={NUVEM} {...comum} />
      {s.estado === "offline" ? <path d="M4 4l16 16" {...comum} /> : null}
      {s.estado === "erro" ? <path d="M12 10v3M12 15.5v.01" {...comum} /> : null}
      {s.estado === "sincronizando" ? <path d="M9.5 13.5l2.5-2.5 2.5 2.5M12 11v5" {...comum} /> : null}
      {s.estado === "ocioso" && !s.pendentes ? <path d="M9.5 13l2 2 3.5-3.5" {...comum} /> : null}
      {s.estado === "ocioso" && s.pendentes ? <path d="M9.5 13.5l2.5-2.5 2.5 2.5M12 11v5" {...comum} /> : null}
    </svg>
  );
}

/** Ícone no cabeçalho; tocar abre os detalhes da sincronização. */
export function StatusSync() {
  const s = useStatusSync();
  const { cor, texto } = textoStatus(s);
  return (
    <Link
      href="/sincronizacao/"
      aria-label={`${texto}. Ver detalhes da sincronização`}
      title={texto}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/25"
    >
      <IconeSync s={s} />
      <span className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-serra ${cor}`} />
      {s.pendentes ? (
        <span className="absolute -bottom-1 -right-1 min-w-5 rounded-full bg-maracuja px-1 text-center text-xs font-bold leading-5 text-tinta">
          {s.pendentes > 99 ? "99+" : s.pendentes}
        </span>
      ) : null}
    </Link>
  );
}
