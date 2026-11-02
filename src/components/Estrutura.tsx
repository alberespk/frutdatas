"use client";
// Moldura das telas: cabeçalho com status de sincronização e barra inferior.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSessao } from "@/lib/sessao";
import { StatusSync } from "./StatusSync";

const ABAS_SOCIO = [
  { href: "/", rotulo: "Início", icone: "⌂" },
  { href: "/estoque/", rotulo: "Estoque", icone: "▦" },
  { href: "/lancar/", rotulo: "Lançar", icone: "+", destaque: true },
  { href: "/financeiro/", rotulo: "Financeiro", icone: "R$" },
  { href: "/mais/", rotulo: "Mais", icone: "☰" },
];

const ABAS_CAMPO = [
  { href: "/", rotulo: "Início", icone: "⌂" },
  { href: "/lancar/", rotulo: "Lançar", icone: "+", destaque: true },
  { href: "/mais/", rotulo: "Mais", icone: "☰" },
];

export function Estrutura({
  titulo,
  voltar,
  children,
  apenasSocio,
}: {
  titulo: string;
  voltar?: string;
  children: ReactNode;
  apenasSocio?: boolean;
}) {
  const { carregando, perfil, ehSocio } = useSessao();
  const router = useRouter();
  const caminho = usePathname();

  useEffect(() => {
    if (!carregando && !perfil) router.replace("/entrar/");
  }, [carregando, perfil, router]);

  if (carregando || !perfil) {
    return <div className="flex min-h-dvh items-center justify-center text-suave">Carregando…</div>;
  }

  const abas = ehSocio ? ABAS_SOCIO : ABAS_CAMPO;
  const ativa = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href.replace(/\/$/, "")));

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-10 bg-serra px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2">
            <img src="/icones/icone-192.png" alt="" className="h-9 w-9 rounded-lg" />
            <span className="font-marca text-2xl font-bold leading-none">FrutDatas</span>
          </Link>
          <StatusSync />
        </div>
        <div className="mt-3 flex items-center gap-2">
          {voltar ? (
            <Link href={voltar} aria-label="Voltar" className="-ml-1 px-1 text-3xl leading-none">
              ‹
            </Link>
          ) : null}
          <h1 className="font-marca text-xl font-semibold">{titulo}</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-28 pt-4">
        {apenasSocio && !ehSocio ? (
          <div className="rounded-2xl bg-white p-6 text-center text-suave">
            Esta tela é só para os sócios.
          </div>
        ) : (
          children
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-borda bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl">
          {abas.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`flex flex-1 flex-col items-center justify-center py-2 text-xs font-semibold ${
                ativa(a.href) ? "text-serra" : "text-suave"
              }`}
            >
              {a.destaque ? (
                <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-morango text-3xl text-white shadow-lg">
                  {a.icone}
                </span>
              ) : (
                <span className="text-xl leading-6">{a.icone}</span>
              )}
              <span>{a.rotulo}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
