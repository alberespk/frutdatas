"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Estrutura } from "@/components/Estrutura";
import { textoStatus, useStatusSync } from "@/components/StatusSync";
import { Cartao, EmBreve } from "@/components/ui";
import { useEstoque, useMapa } from "@/lib/consultas";
import { db } from "@/lib/db";
import { estaParado } from "@/lib/estoque";
import { formatarData, formatarDataHora, hoje } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";

export default function Inicio() {
  const { perfil, ehSocio } = useSessao();
  const sync = useStatusSync();
  const contagem = useLiveQuery(async () => {
    const conta = (t: "fornecedores" | "clientes" | "produtos") =>
      db.t(t).filter((r) => !r.cancelado_em && r.ativo !== false).count();
    return { fornecedores: await conta("fornecedores"), clientes: await conta("clientes"), produtos: await conta("produtos") };
  }, []);
  const primeiroNome = perfil?.nome.split(" ")[0] ?? "";
  const estoque = useEstoque(hoje());
  const produtos = useMapa("produtos");
  const parados = [...(estoque?.values() ?? [])].filter((s) =>
    estaParado(s, Number(produtos?.get(s.produto_id)?.dias_alerta ?? 3)),
  ).length;

  return (
    <Estrutura titulo={`Olá, ${primeiroNome}!`}>
      <p className="text-suave">Hoje é {formatarData(hoje())}.</p>

      <Cartao className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{textoStatus(sync).texto}</div>
          <div className="text-sm text-suave">
            {sync.ultima ? `Última sincronização: ${formatarDataHora(sync.ultima)}` : "Ainda não sincronizou"}
          </div>
        </div>
        <Link href="/sincronizacao/" className="font-semibold text-serra underline">
          Detalhes
        </Link>
      </Cartao>

      {ehSocio && parados > 0 ? (
        <Link href="/estoque/" className="block rounded-2xl border-2 border-morango bg-white p-4">
          <div className="font-semibold text-morango">⚠️ {parados} produto(s) parado(s) no estoque</div>
          <div className="text-sm text-suave">Toque para ver e decidir: vender, baixar preço ou lançar perda.</div>
        </Link>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        {[
          { rotulo: "Fornecedores", n: contagem?.fornecedores, href: "/cadastros/fornecedores/" },
          ...(ehSocio ? [{ rotulo: "Clientes", n: contagem?.clientes, href: "/cadastros/clientes/" }] : []),
          { rotulo: "Produtos", n: contagem?.produtos, href: "/cadastros/produtos/" },
        ].map((c) => (
          <Link key={c.rotulo} href={c.href} className="rounded-2xl border border-borda bg-white p-3 text-center">
            <div className="font-marca text-3xl font-bold text-serra">{c.n ?? "–"}</div>
            <div className="text-sm text-suave">{c.rotulo}</div>
          </Link>
        ))}
      </div>

      {ehSocio ? (
        <EmBreve
          etapa={7}
          titulo="Painel"
          itens={[
            "Compras e vendas do dia, semana e mês",
            "A pagar e a receber, com vencidos em destaque",
            "Estoque atual, margem média e perdas do período",
            "Ranking de produtores e clientes",
          ]}
        />
      ) : (
        <Cartao>
          <p>
            Use o botão <strong className="text-morango">+ Lançar</strong> para registrar compras, colheitas, perdas e
            despesas de viagem, mesmo sem internet.
          </p>
        </Cartao>
      )}
    </Estrutura>
  );
}
