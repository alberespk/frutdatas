"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Suspense, useMemo, useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { EntradaNumero, Opcoes, Selo } from "@/components/lancamento";
import { PagarTitulo } from "@/components/PagarTitulo";
import { Botao, Cartao, classeEntrada, Rotulo, Vazio } from "@/components/ui";
import { useMapa, useTabela } from "@/lib/consultas";
import { db } from "@/lib/db";
import { formatarData, formatarDataHora, formatarMoeda, formatarNumero, hoje, normalizar } from "@/lib/formato";
import { arred2, montarCancelamento, situacaoTitulo, totalPago, type Situacao } from "@/lib/lancamentos";
import { useSessao } from "@/lib/sessao";
import type { Registro } from "@/lib/tabelas";
import {
  margemVenda,
  montarAcerto,
  montarDesfazerAcerto,
  textoRomaneio,
  valorItem,
  type AcertoItem,
} from "@/lib/vendas";

type Filtro = "todas" | "abertas" | "receber";

export default function PaginaVendas() {
  return (
    <Suspense fallback={null}>
      <Vendas />
    </Suspense>
  );
}

function Vendas() {
  const params = useSearchParams();
  const router = useRouter();
  const aberta = params.get("id");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const vendas = useTabela("vendas");
  const titulos = useTabela("titulos", (t) => t.origem_tabela === "vendas");
  const baixas = useTabela("baixas");
  const itens = useTabela("venda_itens");
  const clientes = useMapa("clientes");

  const linhas = useMemo(() => {
    const d = hoje();
    const termo = normalizar(busca);
    return (vendas ?? [])
      .map((v) => {
        const titulo = titulos?.find((t) => t.origem_id === v.id);
        const total = (itens ?? []).filter((i) => i.venda_id === v.id).reduce((s, i) => s + valorItem(i), 0);
        const situacao: Situacao = titulo ? situacaoTitulo(titulo, baixas ?? [], d) : "pendente";
        return { v, total, situacao, nome: String(clientes?.get(String(v.cliente_id))?.nome ?? "") };
      })
      .filter((l) => !termo || normalizar(`${l.nome} ${l.v.numero}`).includes(termo))
      .filter((l) =>
        filtro === "todas" ? true : filtro === "abertas" ? l.v.situacao === "aberta" : l.situacao !== "paga",
      )
      .sort((a, b) => `${b.v.data}${b.v.criado_em}`.localeCompare(`${a.v.data}${a.v.criado_em}`));
  }, [vendas, titulos, baixas, itens, clientes, busca, filtro]);

  if (aberta) {
    return (
      <Estrutura titulo="Venda" apenasSocio>
        <DetalheVenda id={aberta} aoVoltar={() => router.push("/vendas/")} />
      </Estrutura>
    );
  }

  const porDia = new Map<string, typeof linhas>();
  for (const l of linhas) porDia.set(String(l.v.data), [...(porDia.get(String(l.v.data)) ?? []), l]);

  return (
    <Estrutura titulo="Vendas" voltar="/mais/" apenasSocio>
      <Link href="/vendas/nova/" className="block">
        <Botao>+ Nova venda</Botao>
      </Link>
      <input
        className={classeEntrada}
        type="search"
        placeholder="Buscar cliente ou nº…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <Opcoes
        colunas={3}
        opcoes={[
          { valor: "todas", rotulo: "Todas" },
          { valor: "abertas", rotulo: "Sem acerto" },
          { valor: "receber", rotulo: "A receber" },
        ]}
        valor={filtro}
        aoMudar={setFiltro}
      />
      {vendas === undefined ? (
        <Vazio>Carregando…</Vazio>
      ) : !linhas.length ? (
        <Vazio>Nenhuma venda encontrada.</Vazio>
      ) : (
        [...porDia.entries()].map(([dia, ls]) => (
          <div key={dia} className="space-y-2">
            <div className="flex justify-between px-1 text-sm font-semibold text-suave">
              <span>{formatarData(dia)}</span>
              <span>{formatarMoeda(ls.reduce((s, l) => s + l.total, 0))}</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-borda">
              {ls.map((l) => (
                <Link
                  key={l.v.id}
                  href={`/vendas/?id=${l.v.id}`}
                  className="flex min-h-16 w-full items-center gap-3 border-b border-borda bg-white px-4 py-3 text-left last:border-b-0 active:bg-fundo"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{l.nome}</div>
                    <div className="text-sm text-suave">
                      {String(l.v.numero)} · {l.v.situacao === "acertada" ? "acertada" : "sem acerto"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold">{formatarMoeda(l.total)}</span>
                    <Selo situacao={l.situacao} receber />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </Estrutura>
  );
}

function DetalheVenda({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const { salvarVarios } = useSessao();
  const [modo, setModo] = useState<"ver" | "receber" | "acerto">("ver");
  const [gerando, setGerando] = useState(false);
  const dados = useLiveQuery(async () => {
    const venda = await db.t("vendas").get(id);
    if (!venda) return null;
    const itens = (await db.t("venda_itens").where("venda_id").equals(id).toArray()).filter((i) => !i.cancelado_em);
    const titulos = (await db.t("titulos").where("origem_id").equals(id).toArray()).filter((t) => !t.cancelado_em);
    const baixas = (await db.t("baixas").where("titulo_id").anyOf(titulos.map((t) => t.id)).toArray()).filter(
      (b) => !b.cancelado_em,
    );
    const movCaixa = (await db.t("movimentos_caixa").bulkGet(baixas.map((b) => String(b.movimento_id)))).filter(
      (m): m is Registro => !!m,
    );
    const movEstoque = (await db.t("movimentos_estoque").where("origem_id").anyOf(itens.map((i) => i.id)).toArray()).filter(
      (m) => !m.cancelado_em,
    );
    const cliente = await db.t("clientes").get(String(venda.cliente_id));
    const viagem = venda.viagem_id ? await db.t("viagens").get(String(venda.viagem_id)) : undefined;
    const produtos = new Map((await db.t("produtos").toArray()).map((p) => [p.id, p]));
    const classes = new Map((await db.t("classificacoes").toArray()).map((p) => [p.id, p]));
    const motivo = (await db.t("motivos_perda").toArray()).find((m) => normalizar(String(m.nome)).startsWith("devolucao"));
    return { venda, itens, titulos, baixas, movCaixa, movEstoque, cliente, viagem, produtos, classes, motivo };
  }, [id]);

  if (dados === undefined) return <Vazio>Carregando…</Vazio>;
  if (!dados) return <Vazio>Venda não encontrada.</Vazio>;
  const { venda, itens, titulos, baixas, cliente, produtos, classes } = dados;
  const titulo = titulos[0];
  const cancelada = !!venda.cancelado_em;
  const acertada = venda.situacao === "acertada";
  const situacao = titulo ? situacaoTitulo(titulo, baixas, hoje()) : "pendente";
  const pago = titulo ? totalPago(titulo, baixas) : 0;
  const falta = titulo ? arred2(Number(titulo.valor) - pago) : 0;
  const total = itens.reduce((s, i) => s + valorItem(i), 0);
  const m = margemVenda(itens, dados.movEstoque);
  const nomeItem = (i: Registro) =>
    `${produtos.get(String(i.produto_id))?.nome ?? ""} ${classes.get(String(i.classificacao_id))?.nome ?? ""}`.trim();
  const unidade = (i: Registro) => String(produtos.get(String(i.produto_id))?.unidade ?? "");

  const enviarPdf = async () => {
    setGerando(true);
    try {
      const { gerarRomaneioPdf, compartilharArquivo } = await import("@/lib/romaneio-pdf");
      const blob = await gerarRomaneioPdf({ venda, cliente, itens, nomeItem, unidade });
      await compartilharArquivo(blob, `romaneio-${venda.numero}.pdf`, `Romaneio ${venda.numero}`);
    } finally {
      setGerando(false);
    }
  };
  const texto = textoRomaneio({ venda, cliente, itens, nomeItem, unidade });
  const digitos = String(cliente?.telefone ?? "").replace(/\D/g, "");
  const linkZap = `https://wa.me/${digitos.length >= 10 ? `55${digitos}` : ""}?text=${encodeURIComponent(texto)}`;

  if (modo === "acerto") {
    return (
      <FormAcerto
        itens={itens}
        movimentos={dados.movEstoque}
        nomeItem={nomeItem}
        unidade={unidade}
        aoCancelar={() => setModo("ver")}
        aoSalvar={async (lista, data) => {
          await salvarVarios(
            montarAcerto({ venda, titulo, data, itens: lista, motivoPerdaId: dados.motivo?.id ?? null }),
          );
          setModo("ver");
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Cartao className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-marca text-xl font-bold">{String(cliente?.nome ?? "")}</div>
            <div className="text-sm text-suave">
              Romaneio {String(venda.numero)} · {formatarData(String(venda.data))}
            </div>
            {dados.viagem ? <div className="text-sm text-suave">Viagem: {String(dados.viagem.destino)}</div> : null}
          </div>
          {cancelada ? (
            <span className="rounded-full bg-morango/15 px-2 text-sm font-bold text-morango">Cancelada</span>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <Selo situacao={situacao} receber />
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${acertada ? "bg-folha/30 text-serra" : "bg-borda"}`}>
                {acertada ? `Acertada ${formatarData(String(venda.data_acerto))}` : "Sem acerto"}
              </span>
            </div>
          )}
        </div>
        {venda.observacao ? <p className="pt-2 text-sm">{String(venda.observacao)}</p> : null}
      </Cartao>

      <Cartao className="space-y-2">
        {itens.map((i) => {
          const q = Number(i.quantidade_acerto ?? i.quantidade);
          const p = Number(i.preco_acerto ?? i.preco_unitario);
          const mudou = acertada && (q !== Number(i.quantidade) || p !== Number(i.preco_unitario));
          return (
            <div key={i.id} className="flex justify-between gap-2 border-b border-borda pb-2 last:border-0">
              <div>
                <div className="font-semibold">{nomeItem(i)}</div>
                <div className="text-sm text-suave">
                  {formatarNumero(q)} {unidade(i)} × {formatarMoeda(p)}
                </div>
                {mudou ? (
                  <div className="text-xs text-suave">
                    Saiu {formatarNumero(Number(i.quantidade))} × {formatarMoeda(Number(i.preco_unitario))}
                    {Number(i.quantidade_devolvida) > 0
                      ? ` · voltou ${formatarNumero(Number(i.quantidade_devolvida))} (${i.destino_devolucao === "perda" ? "perda" : "estoque"})`
                      : ""}
                  </div>
                ) : null}
              </div>
              <div className="font-semibold">{formatarMoeda(valorItem(i))}</div>
            </div>
          );
        })}
        <div className="flex justify-between font-marca text-xl font-bold">
          <span>Total</span>
          <span>{formatarMoeda(total)}</span>
        </div>
        <div className="flex justify-between text-sm text-suave">
          <span>Custo (médio PEPS)</span>
          <span>{formatarMoeda(m.custo)}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span>Margem</span>
          <span className={m.margem < 0 ? "text-morango" : "text-serra"}>
            {formatarMoeda(m.margem)} ({formatarNumero(Math.round(m.percentual * 1000) / 10)}%)
          </span>
        </div>
        {titulo ? (
          <div className="space-y-1 pt-2 text-sm text-suave">
            <div>Vencimento: {formatarData(String(titulo.vencimento))}</div>
            {baixas.map((b) => {
              const mc = dados.movCaixa.find((x) => x.id === b.movimento_id);
              return (
                <div key={b.id}>
                  Recebido {formatarMoeda(Number(b.valor))} em {formatarData(String(mc?.data ?? ""))} ({String(mc?.forma ?? "")})
                </div>
              );
            })}
            {falta >= 0 ? (
              <div className="font-semibold text-tinta">Falta receber: {formatarMoeda(falta)}</div>
            ) : (
              <div className="font-semibold text-morango">Cliente pagou {formatarMoeda(-falta)} a mais (devolver ou abater).</div>
            )}
          </div>
        ) : null}
        <div className="pt-1 text-xs text-suave">Lançada em {formatarDataHora(String(venda.criado_em))}</div>
      </Cartao>

      {!cancelada ? (
        <div className="grid grid-cols-2 gap-2">
          <Botao variante="secundario" onClick={enviarPdf} disabled={gerando}>
            {gerando ? "Gerando…" : "Romaneio PDF"}
          </Botao>
          <a href={linkZap} target="_blank" rel="noopener noreferrer" className="block">
            <Botao variante="secundario" tabIndex={-1}>
              WhatsApp
            </Botao>
          </a>
        </div>
      ) : null}

      {modo === "receber" && titulo ? (
        <PagarTitulo titulo={titulo} baixas={baixas} aoFechar={() => setModo("ver")} />
      ) : null}
      {modo === "ver" && !cancelada && !acertada ? <Botao onClick={() => setModo("acerto")}>Fazer acerto</Botao> : null}
      {modo === "ver" && !cancelada && !acertada ? (
        <Link href={`/vendas/nova/?editar=${venda.id}`} className="block">
          <Botao variante="secundario">Editar venda</Botao>
        </Link>
      ) : null}
      {modo === "ver" && !cancelada && titulo && falta > 0.005 ? (
        <Botao variante={acertada ? "primario" : "secundario"} onClick={() => setModo("receber")}>
          Registrar recebimento
        </Botao>
      ) : null}
      <Botao variante="secundario" onClick={aoVoltar}>
        Voltar
      </Botao>
      {!cancelada && acertada ? (
        <Botao
          variante="fantasma"
          onClick={async () => {
            if (!confirm("Desfazer o acerto? As devoluções saem do estoque de novo e o valor volta ao da venda.")) return;
            await salvarVarios(
              montarDesfazerAcerto({ venda, titulo, itens, movimentos: dados.movEstoque.filter((x) => x.tipo !== "venda") }),
            );
          }}
        >
          Desfazer acerto
        </Botao>
      ) : null}
      {!cancelada ? (
        <Botao
          variante="perigo"
          onClick={async () => {
            if (!confirm("Cancelar esta venda? A mercadoria volta ao estoque e a conta a receber (com recebimentos) é cancelada.")) return;
            await salvarVarios(
              montarCancelamento([
                { tabela: "baixas", lista: baixas },
                { tabela: "movimentos_caixa", lista: dados.movCaixa },
                { tabela: "titulos", lista: titulos },
                { tabela: "movimentos_estoque", lista: dados.movEstoque },
                { tabela: "venda_itens", lista: itens },
                { tabela: "vendas", lista: [venda] },
              ]),
            );
          }}
        >
          Cancelar venda
        </Botao>
      ) : null}
    </div>
  );
}

function FormAcerto({
  itens,
  movimentos,
  nomeItem,
  unidade,
  aoCancelar,
  aoSalvar,
}: {
  itens: Registro[];
  movimentos: Registro[];
  nomeItem: (i: Registro) => string;
  unidade: (i: Registro) => string;
  aoCancelar: () => void;
  aoSalvar: (lista: AcertoItem[], data: string) => Promise<void>;
}) {
  const [data, setData] = useState(hoje());
  const [linhas, setLinhas] = useState(() =>
    itens.map((i) => ({
      quantidade: Number(i.quantidade) as number | null,
      preco: Number(i.preco_unitario) as number | null,
      destino: "estoque" as "estoque" | "perda",
    })),
  );
  const [erro, setErro] = useState<string | null>(null);
  const muda = (n: number, parte: Partial<(typeof linhas)[number]>) =>
    setLinhas(linhas.map((l, k) => (k === n ? { ...l, ...parte } : l)));
  const total = linhas.reduce((s, l) => s + arred2((l.quantidade ?? 0) * (l.preco ?? 0)), 0);

  return (
    <div className="space-y-4">
      <h2 className="font-marca text-xl font-bold">Acerto com o cliente</h2>
      <p className="text-sm text-suave">
        Confira o que o cliente ficou e o preço final. O que voltou entra de novo no estoque, ou vira perda se não tiver condição.
      </p>
      {itens.map((i, n) => {
        const l = linhas[n];
        const voltou = Number(i.quantidade) - (l.quantidade ?? 0);
        return (
          <Cartao key={i.id} className="space-y-3">
            <div className="flex justify-between">
              <div className="font-semibold">{nomeItem(i)}</div>
              <div className="text-sm text-suave">
                saiu {formatarNumero(Number(i.quantidade))} × {formatarMoeda(Number(i.preco_unitario))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Rotulo texto="Ficou com o cliente">
                <EntradaNumero valor={l.quantidade} aoMudar={(v) => muda(n, { quantidade: v })} sufixo={unidade(i)} />
              </Rotulo>
              <Rotulo texto="Preço final">
                <EntradaNumero valor={l.preco} aoMudar={(v) => muda(n, { preco: v })} dinheiro />
              </Rotulo>
            </div>
            {voltou > 1e-6 ? (
              <Rotulo grupo texto={`Voltaram ${formatarNumero(voltou)} ${unidade(i)}. Para onde vão?`}>
                <Opcoes
                  opcoes={[
                    { valor: "estoque" as const, rotulo: "Voltam ao estoque" },
                    { valor: "perda" as const, rotulo: "Perda (sem condição)" },
                  ]}
                  valor={l.destino}
                  aoMudar={(v) => muda(n, { destino: v })}
                />
              </Rotulo>
            ) : null}
            {voltou < -1e-6 ? <p className="text-sm font-semibold text-morango">Maior que a quantidade que saiu.</p> : null}
          </Cartao>
        );
      })}
      <Cartao className="space-y-3">
        <Rotulo texto="Data do acerto">
          <input type="date" className={classeEntrada} value={data} max={hoje()} onChange={(e) => setData(e.target.value || hoje())} />
        </Rotulo>
        <div className="flex justify-between font-marca text-xl font-bold">
          <span>Total acertado</span>
          <span>{formatarMoeda(total)}</span>
        </div>
        {erro ? <p className="font-semibold text-morango">{erro}</p> : null}
      </Cartao>
      <Botao
        onClick={async () => {
          if (linhas.some((l) => l.quantidade === null || l.preco === null)) return setErro("Preencha quantidade e preço de todos os itens.");
          try {
            await aoSalvar(
              itens.map((i, n) => ({
                item: i,
                movimento: movimentos.find((m) => m.origem_id === i.id && m.tipo === "venda"),
                quantidade_acerto: linhas[n].quantidade!,
                preco_acerto: linhas[n].preco!,
                destino_devolucao: linhas[n].destino,
              })),
              data,
            );
          } catch (e) {
            setErro((e as Error).message);
          }
        }}
      >
        Confirmar acerto · {formatarMoeda(total)}
      </Botao>
      <Botao variante="secundario" onClick={aoCancelar}>
        Voltar
      </Botao>
    </div>
  );
}
