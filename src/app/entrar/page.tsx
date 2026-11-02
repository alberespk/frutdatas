"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Botao, classeEntrada, Rotulo } from "@/components/ui";
import { useSessao } from "@/lib/sessao";

export default function Entrar() {
  const { entrar, perfil, carregando } = useSessao();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!carregando && perfil) router.replace("/");
  }, [carregando, perfil, router]);

  return (
    <div className="flex min-h-dvh flex-col bg-serra px-6 pb-10 pt-16 text-white">
      <div className="mx-auto w-full max-w-sm flex-1">
        <img src="/icones/icone-512.png" alt="" className="mx-auto h-28 w-28 rounded-3xl" />
        <h1 className="mt-4 text-center font-marca text-5xl font-bold">FrutDatas</h1>
        <p className="mt-1 text-center text-white/80">Hortifrúti · Datas/MG</p>

        <form
          className="mt-10 space-y-5 rounded-3xl bg-white p-6 text-tinta"
          onSubmit={async (e) => {
            e.preventDefault();
            setErro(null);
            setEnviando(true);
            const msg = await entrar(email.trim(), senha);
            setEnviando(false);
            if (msg) setErro(msg);
            else router.replace("/");
          }}
        >
          <Rotulo texto="E-mail">
            <input
              className={classeEntrada}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Rotulo>
          <Rotulo texto="Senha">
            <input
              className={classeEntrada}
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </Rotulo>
          {erro ? <p className="font-semibold text-morango">{erro}</p> : null}
          <Botao type="submit" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </Botao>
          <p className="text-center text-sm text-suave">
            Depois do primeiro acesso, o app funciona mesmo sem internet.
          </p>
        </form>
      </div>
    </div>
  );
}
