"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { Opcoes, Selo } from "@/components/lancamento";
import { PagarTitulo } from "@/components/PagarTitulo";
import { Botao, Cartao, classeEntrada, Vazio, Carregando } from "@/components/ui";
import { useMapa, useTabela } from "@/lib/consultas";
import { db } from "@/lib/db";
import { formatarData, formatarDataHora, formatarMoeda, formatarNumero, hoje, normalizar } from "@/lib/formato";
import { montarCancelamento, situacaoTitulo, totalPago, type Situacao } from "@/lib/lancamentos";
import { useSessao } from "@/lib/sessao";
import type { Registro } from "@/lib/tabelas";

type Filtro = "todas" | "abertas" | "pagas";

export default function Compras() {
  const [aberta, setAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const compras = useTabela("compras");
  const titulos = useTabela("titulos", (t) => t.origem_tabela === "compras");
  const baixas = useTabela("baixas");
  const itens = useTabela("compra_itens");
  const fornecedores = useMapa("fornecedores");

  const linhas = useMemo(() => {
    const d = hoje();
    const termo = normalizar(busca);
    return (compras ?? [])
      .map((c) => {
        const titulo = titulos?.find((t) => t.origem_id === c.id);
        const total = (itens ?? []).filter((i) => i.compra_id === c.id).reduce((s, i) => s + Number(i.total), 0);
        const situacao: Situacao = titulo ? situacaoTitulo(titulo, baixas ?? [], d) : "pendente";
        return { c, total, situacao, nome: String(fornecedores?.get(String(c.fornecedor_id))?.nome ?? "") };
      })
      .filter((l) => !termo || normalizar(l.nome).includes(termo))
      .filter((l) => (filtro === "todas" ? true : filtro === "pagas" ? l.situacao === "paga" : l.situacao !== "paga"))
      .sort((a, b) => `${b.c.data}${b.c.criado_em}`.localeCompare(`${a.c.data}${a.c.criado_em}`));
  }, [compras, titulos, baixas, itens, fornecedores, busca, filtro]);

  if (aberta) {
    return (
      <Estrutura titulo="Compra">
        <DetalheCompra id={aberta} aoVoltar={() => setAberta(null)} />
      </Estrutura>
    );
  }

  const porDia = new Map<string, typeof linhas>();
  for (const l of linhas) porDia.set(String(l.c.data), [...(porDia.get(String(l.c.data)) ?? []), l]);

  return (
    <Estrutura titulo="Compras" voltar="/mais/">
      <Link href="/compras/nova/" className="block">
        <Botao>+ Nova compra</Botao>
      </Link>
      <input className={classeEntrada} type="search" placeholder="Buscar produtor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <Opcoes
        colunas={3}
        opcoes={[
          { valor: "todas", rotulo: "Todas" },
          { valor: "abertas", rotulo: "A pagar" },
          { valor: "pagas", rotulo: "Pagas" },
        ]}
        valor={filtro}
        aoMudar={setFiltro}
      />
      {compras === undefined ? (
        <Carregando />
      ) : !linhas.length ? (
        <Vazio>Nenhuma compra encontrada.</Vazio>
      ) : (
        [...porDia.entries()].map(([dia, ls]) => (
          <div key={dia} className="space-y-2">
            <div className="flex justify-between px-1 text-sm font-semibold text-suave">
              <span>{formatarData(dia)}</span>
              <span>{formatarMoeda(ls.reduce((s, l) => s + l.total, 0))}</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-borda">
              {ls.map((l) => (
                <button
                  key={l.c.id}
                  type="button"
                  onClick={() => setAberta(l.c.id)}
                  className="flex min-h-16 w-full items-center gap-3 border-b border-borda bg-white px-4 py-3 text-left last:border-b-0 active:bg-fundo"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{l.nome}</div>
                    <div className="text-sm text-suave">{l.c.origem === "retorno" ? "Volta de viagem" : "Região"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold">{formatarMoeda(l.total)}</span>
                    <Selo situacao={l.situacao} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </Estrutura>
  );
}

function DetalheCompra({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const { perfil, ehSocio, salvarVarios } = useSessao();
  const [pagando, setPagando] = useState(false);
  const dados = useLiveQuery(async () => {
    const compra = await db.t("compras").get(id);
    if (!compra) return null;
    const itens = (await db.t("compra_itens").where("compra_id").equals(id).toArray()).filter((i) => !i.cancelado_em);
    const titulos = (await db.t("titulos").where("origem_id").equals(id).toArray()).filter((t) => !t.cancelado_em);
    const baixas = (await db.t("baixas").where("titulo_id").anyOf(titulos.map((t) => t.id)).toArray()).filter((b) => !b.cancelado_em);
    const movCaixa = (await db.t("movimentos_caixa").bulkGet(baixas.map((b) => String(b.movimento_id)))).filter(
      (m): m is Registro => !!m,
    );
    const movEstoque = await db.t("movimentos_estoque").where("origem_id").anyOf(itens.map((i) => i.id)).toArray();
    const fornecedor = await db.t("fornecedores").get(String(compra.fornecedor_id));
    const produtos = new Map((await db.t("produtos").toArray()).map((p) => [p.id, p]));
    const classes = new Map((await db.t("classificacoes").toArray()).map((p) => [p.id, p]));
    return { compra, itens, titulos, baixas, movCaixa, movEstoque, fornecedor, produtos, classes };
  }, [id]);

  if (dados === undefined) return <Carregando />;
  if (!dados) return <Vazio>Compra não encontrada.</Vazio>;
  const { compra, itens, titulos, baixas, fornecedor, produtos, classes } = dados;
  const titulo = titulos[0];
  const total = itens.reduce((s, i) => s + Number(i.total), 0);
  const situacao = titulo ? situacaoTitulo(titulo, baixas, hoje()) : "pendente";
  const cancelada = !!compra.cancelado_em;
  const recente = Date.now() - new Date(String(compra.criado_em)).getTime() < 24 * 3600 * 1000;
  const podeCancelar = !cancelada && (ehSocio || (compra.criado_por === perfil?.id && recente));

  return (
    <div className="space-y-4">
      <Cartao className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-marca text-xl font-bold">{String(fornecedor?.nome ?? "")}</div>
            <div className="text-sm text-suave">
              {formatarData(String(compra.data))} · {compra.origem === "retorno" ? "Volta de viagem" : "Região"}
            </div>
          </div>
          {cancelada ? <span className="rounded-full bg-morango/15 px-2 text-sm font-bold text-morango">Cancelada</span> : <Selo situacao={situacao} />}
        </div>
        {compra.observacao ? <p className="pt-2 text-sm">{String(compra.observacao)}</p> : null}
      </Cartao>

      <Cartao className="space-y-2">
        {itens.map((i) => (
          <div key={i.id} className="flex justify-between gap-2 border-b border-borda pb-2 last:border-0">
            <div>
              <div className="font-semibold">
                {String(produtos.get(String(i.produto_id))?.nome ?? "")} {String(classes.get(String(i.classificacao_id))?.nome ?? "")}
              </div>
              <div className="text-sm text-suave">
                {formatarNumero(Number(i.quantidade))} {String(produtos.get(String(i.produto_id))?.unidade ?? "")} ×{" "}
                {formatarMoeda(Number(i.preco_unitario))}
              </div>
            </div>
            <div className="font-semibold">{formatarMoeda(Number(i.total))}</div>
          </div>
        ))}
        <div className="flex justify-between font-marca text-xl font-bold">
          <span>Total</span>
          <span>{formatarMoeda(total)}</span>
        </div>
        {titulo ? (
          <div className="space-y-1 pt-2 text-sm text-suave">
            <div>Vencimento: {formatarData(String(titulo.vencimento))}</div>
            {baixas.map((b) => {
              const m = dados.movCaixa.find((x) => x.id === b.movimento_id);
              return (
                <div key={b.id}>
                  Pago {formatarMoeda(Number(b.valor))} em {formatarData(String(m?.data ?? ""))} ({String(m?.forma ?? "")})
                </div>
              );
            })}
            <div className="font-semibold text-tinta">Falta pagar: {formatarMoeda(Number(titulo.valor) - totalPago(titulo, baixas))}</div>
          </div>
        ) : null}
        <div className="pt-1 text-xs text-suave">Lançada em {formatarDataHora(String(compra.criado_em))}</div>
      </Cartao>

      {pagando && titulo ? <PagarTitulo titulo={titulo} baixas={baixas} aoFechar={() => setPagando(false)} /> : null}
      {!pagando && !cancelada && titulo && situacao !== "paga" ? <Botao onClick={() => setPagando(true)}>Registrar pagamento</Botao> : null}
      {!pagando && podeCancelar ? (
        <Link href={`/compras/nova/?editar=${compra.id}`} className="block">
          <Botao variante="secundario">Editar compra</Botao>
        </Link>
      ) : null}
      <Botao variante="secundario" onClick={aoVoltar}>
        Voltar
      </Botao>
      {podeCancelar ? (
        <Botao
          variante="perigo"
          onClick={async () => {
            if (!confirm("Cancelar esta compra? Ela sai do estoque e das contas (inclusive pagamentos já lançados).")) return;
            await salvarVarios(
              montarCancelamento([
                { tabela: "baixas", lista: baixas },
                { tabela: "movimentos_caixa", lista: dados.movCaixa },
                { tabela: "titulos", lista: titulos },
                { tabela: "movimentos_estoque", lista: dados.movEstoque },
                { tabela: "compra_itens", lista: itens },
                { tabela: "compras", lista: [compra] },
              ]),
            );
          }}
        >
          Cancelar compra
        </Botao>
      ) : null}
    </div>
  );
}
