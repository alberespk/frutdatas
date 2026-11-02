"use client";
// Painel dos sócios: compras, vendas, margem, perdas, contas, estoque e rankings.
import Link from "next/link";
import { useMemo, useState } from "react";
import { useEstoque, useMapa, useTabela } from "@/lib/consultas";
import { agruparPorPessoa, inicioDoMes, saldoCaixa } from "@/lib/financeiro";
import { formatarMoeda, formatarNumero, hoje, somarDias } from "@/lib/formato";
import { arred2 } from "@/lib/lancamentos";
import { resumirPainel, type Ranking } from "@/lib/painel";
import type { Registro } from "@/lib/tabelas";
import { Opcoes } from "./lancamento";
import { Cartao } from "./ui";

type Periodo = "hoje" | "semana" | "mes";

export function Painel() {
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const d = hoje();
  const de = periodo === "hoje" ? d : periodo === "semana" ? somarDias(d, -6) : inicioDoMes(d);

  const compras = useTabela("compras");
  const compraItens = useTabela("compra_itens");
  const vendas = useTabela("vendas");
  const vendaItens = useTabela("venda_itens");
  const movimentos = useTabela("movimentos_estoque");
  const despesas = useTabela("despesas");
  const fornecedores = useMapa("fornecedores");
  const clientes = useMapa("clientes");
  const estoque = useEstoque(d);

  const r = useMemo(
    () =>
      compras && compraItens && vendas && vendaItens && movimentos && despesas
        ? resumirPainel({ compras, compraItens, vendas, vendaItens, movimentos, despesas, de, ate: d })
        : null,
    [compras, compraItens, vendas, vendaItens, movimentos, despesas, de, d],
  );
  const valorEstoque = [...(estoque?.values() ?? [])].reduce((s, x) => s + x.valor, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-marca text-xl font-bold">Painel</h2>
      </div>
      <Opcoes
        colunas={3}
        opcoes={[
          { valor: "hoje" as Periodo, rotulo: "Hoje" },
          { valor: "semana" as Periodo, rotulo: "7 dias" },
          { valor: "mes" as Periodo, rotulo: "Mês" },
        ]}
        valor={periodo}
        aoMudar={setPeriodo}
      />
      <div className="grid grid-cols-2 gap-3">
        <Numero rotulo="Vendas" valor={r?.vendas} detalhe={r ? `${r.qtdVendas} romaneio(s)` : ""} href="/vendas/" />
        <Numero rotulo="Compras" valor={r?.compras} detalhe={r ? `${r.qtdCompras} compra(s)` : ""} href="/compras/" />
        <Numero
          rotulo="Margem bruta"
          valor={r?.margem}
          detalhe={r && r.vendas ? `${formatarNumero(Math.round(r.percentual * 1000) / 10)}% das vendas` : "sem vendas"}
          href="/financeiro/?aba=margens"
          alerta={!!r && r.margem < 0}
        />
        <Numero rotulo="Perdas" valor={r?.perdas} detalhe="pelo custo" href="/estoque/" alerta={!!r && r.perdas > 0} />
        <Numero rotulo="Despesas" valor={r?.despesas} detalhe="viagem, produção e gerais" href="/despesas/" />
        <Numero rotulo="Estoque hoje" valor={estoque ? valorEstoque : undefined} detalhe="pelo custo médio" href="/estoque/" />
      </div>
      <Top titulo="Produtores que mais venderam para nós" lista={r?.produtores} nomes={fornecedores} />
      <Top titulo="Clientes que mais compraram" lista={r?.clientes} nomes={clientes} />
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  detalhe,
  href,
  alerta,
}: {
  rotulo: string;
  valor: number | undefined;
  detalhe: string;
  href: string;
  alerta?: boolean;
}) {
  return (
    <Link href={href} className="block rounded-2xl border border-borda bg-white p-3 active:bg-fundo">
      <div className="text-sm text-suave">{rotulo}</div>
      <div className={`font-marca text-xl font-bold ${alerta ? "text-morango" : "text-tinta"}`}>
        {valor === undefined ? "–" : formatarMoeda(valor)}
      </div>
      <div className="truncate text-xs text-suave">{detalhe}</div>
    </Link>
  );
}

function Top({ titulo, lista, nomes }: { titulo: string; lista: Ranking[] | undefined; nomes: Map<string, Registro> | undefined }) {
  const maior = Math.max(...(lista ?? []).map((l) => l.valor), 0);
  return (
    <Cartao className="space-y-3">
      <h3 className="font-semibold">{titulo}</h3>
      {!lista?.length ? (
        <p className="text-sm text-suave">Nada no período.</p>
      ) : (
        <ol className="space-y-2">
          {lista.map((l, n) => (
            <li key={l.id}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate">
                  {n + 1}. {String(nomes?.get(l.id)?.nome ?? "")}
                </span>
                <span className="shrink-0 font-semibold">{formatarMoeda(l.valor)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-fundo" aria-hidden>
                <div className="h-2 rounded-full bg-serra" style={{ width: `${maior ? Math.max(2, (l.valor / maior) * 100) : 0}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Cartao>
  );
}

/** Saldo, a receber e a pagar: em destaque no alto da tela inicial. */
export function Destaques() {
  const d = hoje();
  const titulos = useTabela("titulos");
  const baixas = useTabela("baixas");
  const caixa = useTabela("movimentos_caixa");
  const contas = useMemo(() => {
    if (!titulos || !baixas) return null;
    const soma = (tipo: "pagar" | "receber") => {
      const gs = agruparPorPessoa(titulos, baixas, tipo, d, () => "");
      return { aberto: arred2(gs.reduce((s, g) => s + g.aberto, 0)), vencido: arred2(gs.reduce((s, g) => s + g.vencido, 0)) };
    };
    return { pagar: soma("pagar"), receber: soma("receber") };
  }, [titulos, baixas, d]);
  const saldo = caixa ? saldoCaixa(caixa) : null;
  return (
    <div className="space-y-3">
      <Link href="/financeiro/?aba=caixa" className="block rounded-2xl bg-serra p-4 text-white active:bg-serra-escuro">
        <div className="text-sm opacity-80">Saldo da conta</div>
        <div className="font-marca text-4xl font-bold">{saldo ? formatarMoeda(saldo.total) : "–"}</div>
        <div className="text-sm opacity-80">
          {saldo ? `Pix/conta ${formatarMoeda(saldo.porForma.pix)} · Dinheiro ${formatarMoeda(saldo.porForma.dinheiro)}` : ""}
        </div>
      </Link>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/financeiro/?aba=receber" className="block rounded-2xl border-2 border-folha bg-white p-3 active:bg-fundo">
          <div className="text-sm text-suave">A receber</div>
          <div className="font-marca text-2xl font-bold text-serra">{contas ? formatarMoeda(contas.receber.aberto) : "–"}</div>
          <div className={`text-xs ${contas?.receber.vencido ? "font-semibold text-morango" : "text-suave"}`}>
            Vencido {contas ? formatarMoeda(contas.receber.vencido) : "–"}
          </div>
        </Link>
        <Link href="/financeiro/?aba=pagar" className="block rounded-2xl border-2 border-morango/40 bg-white p-3 active:bg-fundo">
          <div className="text-sm text-suave">A pagar</div>
          <div className="font-marca text-2xl font-bold text-morango">{contas ? formatarMoeda(contas.pagar.aberto) : "–"}</div>
          <div className={`text-xs ${contas?.pagar.vencido ? "font-semibold text-morango" : "text-suave"}`}>
            Vencido {contas ? formatarMoeda(contas.pagar.vencido) : "–"}
          </div>
        </Link>
      </div>
    </div>
  );
}
