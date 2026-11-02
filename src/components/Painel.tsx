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
  const titulos = useTabela("titulos");
  const baixas = useTabela("baixas");
  const caixa = useTabela("movimentos_caixa");
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
  const contas = useMemo(() => {
    if (!titulos || !baixas) return null;
    const soma = (tipo: "pagar" | "receber") => {
      const gs = agruparPorPessoa(titulos, baixas, tipo, d, () => "");
      return { aberto: arred2(gs.reduce((s, g) => s + g.aberto, 0)), vencido: arred2(gs.reduce((s, g) => s + g.vencido, 0)) };
    };
    return { pagar: soma("pagar"), receber: soma("receber") };
  }, [titulos, baixas, d]);
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
        <Numero rotulo="Perdas" valor={r?.perdas} detalhe={r ? `Despesas ${formatarMoeda(r.despesas)}` : ""} href="/estoque/" alerta={!!r && r.perdas > 0} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Numero
          rotulo="A receber"
          valor={contas?.receber.aberto}
          detalhe={contas ? `Vencido ${formatarMoeda(contas.receber.vencido)}` : ""}
          href="/financeiro/?aba=receber"
          alerta={!!contas && contas.receber.vencido > 0}
        />
        <Numero
          rotulo="A pagar"
          valor={contas?.pagar.aberto}
          detalhe={contas ? `Vencido ${formatarMoeda(contas.pagar.vencido)}` : ""}
          href="/financeiro/?aba=pagar"
          alerta={!!contas && contas.pagar.vencido > 0}
        />
        <Numero rotulo="Saldo em caixa" valor={caixa ? saldoCaixa(caixa).total : undefined} detalhe="Pix + dinheiro" href="/financeiro/" />
        <Numero rotulo="Estoque" valor={estoque ? valorEstoque : undefined} detalhe="pelo custo médio" href="/estoque/" />
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
