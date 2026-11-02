"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { Botao, Cartao, ItemLista } from "@/components/ui";
import { useInstalar } from "@/lib/instalar";
import { useSessao } from "@/lib/sessao";

export default function Mais() {
  const { perfil, ehSocio, sair } = useSessao();
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);
  const { modo, instalar } = useInstalar();
  const [ajuda, setAjuda] = useState(false);

  const tocarInstalar = async () => {
    if (modo === "pronto") await instalar();
    else setAjuda(true);
  };

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
      {modo !== "instalado" ? (
        <div className="overflow-hidden rounded-2xl border-2 border-serra">
          <ItemLista
            onClick={tocarInstalar}
            titulo="📲 Instalar app"
            detalhe="Cria o atalho do FrutDatas na tela do celular"
          />
        </div>
      ) : null}
      {ajuda ? (
        <Cartao className="space-y-2 text-sm">
          <div className="font-semibold">Instalar o FrutDatas</div>
          {modo === "iphone" ? (
            <ol className="list-decimal space-y-1 pl-5 text-suave">
              <li>Abra este endereço no <strong>Safari</strong>.</li>
              <li>
                Toque no botão <strong>Compartilhar</strong> (quadrado com a seta para cima).
              </li>
              <li>
                Escolha <strong>“Adicionar à Tela de Início”</strong> e toque em <strong>Adicionar</strong>.
              </li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-suave">
              <li>Abra este endereço no <strong>Chrome</strong>.</li>
              <li>
                Toque no menu <strong>⋮</strong> (três pontinhos, no alto à direita).
              </li>
              <li>
                Escolha <strong>“Instalar app”</strong> ou <strong>“Adicionar à tela inicial”</strong>.
              </li>
            </ol>
          )}
          <button type="button" className="text-sm font-semibold text-serra" onClick={() => setAjuda(false)}>
            Fechar
          </button>
        </Cartao>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-borda">
        {ehSocio ? <ItemLista href="/vendas/" titulo="Vendas" detalhe="Romaneios, acertos e recebimentos" /> : null}
        {ehSocio ? <ItemLista href="/viagens/" titulo="Viagens" detalhe="Carga de ida, despesas, volta e resultado" /> : null}
        <ItemLista href="/compras/" titulo="Compras" detalhe={ehSocio ? "Compras de produtores e de retorno" : "As compras que você lançou"} />
        <ItemLista href="/producao/" titulo="Produção própria" detalhe="Ciclos, despesas, colheitas e custo por kg" />
        <ItemLista href="/despesas/" titulo="Despesas" detalhe={ehSocio ? "Todas as despesas" : "As despesas que você lançou"} />
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
