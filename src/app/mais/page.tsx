"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { Botao, Cartao, ItemLista } from "@/components/ui";
import { useSessao } from "@/lib/sessao";

export default function Mais() {
  const { perfil, ehSocio, sair } = useSessao();
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  const fazerSair = async () => {
    setSaindo(true);
    let r = await sair();
    if (r && confirm(`Há ${r.pendentes} lançamento(s) ainda não enviados. Se sair agora, eles serão perdidos. Sair mesmo assim?`)) {
      r = await sair(true);
    }
    setSaindo(false);
    if (!r) router.replace("/entrar/");
  };

  return (
    <Estrutura titulo="Mais">
      <Cartao>
        <div className="font-semibold">{perfil?.nome}</div>
        <div className="text-sm text-suave">
          {perfil?.email} · {ehSocio ? "Sócio" : "Campo"}
          {perfil?.letra ? ` · romaneio ${perfil.letra}` : ""}
        </div>
      </Cartao>
      <div className="overflow-hidden rounded-2xl border border-borda">
        {ehSocio ? <ItemLista href="/cadastros/" titulo="Cadastros" detalhe="Produtores, clientes, produtos e mais" /> : null}
        {ehSocio ? <ItemLista href="/usuarios/" titulo="Usuários" detalhe="Quem acessa o sistema e o que pode fazer" /> : null}
        <ItemLista href="/sincronizacao/" titulo="Sincronização" detalhe="Envio dos lançamentos e instalação do app" />
      </div>
      <Botao variante="perigo" onClick={fazerSair} disabled={saindo}>
        {saindo ? "Saindo…" : "Sair"}
      </Botao>
    </Estrutura>
  );
}
