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

/** Versão curta para o cabeçalho. */
function textoCurto(s: Status): string {
  if (s.estado === "sincronizando") return "Sincronizando";
  if (s.estado === "erro") return "Erro";
  if (s.estado === "offline") return s.pendentes ? `Offline · ${s.pendentes}` : "Offline";
  if (s.pendentes) return `${s.pendentes} a enviar`;
  return "Sincronizado";
}

export function StatusSync() {
  const s = useStatusSync();
  const { cor } = textoStatus(s);
  const texto = textoCurto(s);
  return (
    <Link
      href="/sincronizacao/"
      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${cor}`} />
      {texto}
    </Link>
  );
}
