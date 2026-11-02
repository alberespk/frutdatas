"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { EntradaNumero, Opcoes } from "@/components/lancamento";
import { Botao, Cartao, classeEntrada, Rotulo, Vazio } from "@/components/ui";
import { useEstoque, useMapa } from "@/lib/consultas";
import { db } from "@/lib/db";
import { custoDeSaida, estaParado, ordenarMovimentos, ROTULO_TIPO, type Saldo } from "@/lib/estoque";
import { formatarData, formatarMoeda, formatarNumero, hoje, normalizar } from "@/lib/formato";
import { montarAjuste } from "@/lib/lancamentos";
import { useSessao } from "@/lib/sessao";

export default function Estoque() {
  const dataHoje = hoje();
  const estoque = useEstoque(dataHoje);
  const produtos = useMapa("produtos");
  const classes = useMapa("classificacoes");
  const [filtro, setFiltro] = useState<"com" | "parados" | "todos">("com");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  const nome = (s: Saldo) =>
    `${produtos?.get(s.produto_id)?.nome ?? ""} ${s.classificacao_id ? (classes?.get(s.classificacao_id)?.nome ?? "") : ""}`.trim();
  const unidade = (s: Saldo) => String(produtos?.get(s.produto_id)?.unidade ?? "");
  const diasAlerta = (s: Saldo) => Number(produtos?.get(s.produto_id)?.dias_alerta ?? 3);

  const linhas = useMemo(() => {
    const termo = normalizar(busca);
    return [...(estoque?.values() ?? [])]
      .filter((s) => (filtro === "todos" ? true : filtro === "parados" ? estaParado(s, diasAlerta(s)) : Math.abs(s.saldo) > 0.0005))
      .filter((s) => !termo || normalizar(nome(s)).includes(termo))
      .sort(
        (a, b) =>
          Number(estaParado(b, diasAlerta(b))) - Number(estaParado(a, diasAlerta(a))) || nome(a).localeCompare(nome(b), "pt-BR"),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estoque, produtos, classes, filtro, busca]);

  const todos = [...(estoque?.values() ?? [])];
  const valorTotal = todos.reduce((s, x) => s + x.valor, 0);
  const parados = todos.filter((s) => estaParado(s, diasAlerta(s))).length;

  const selecionado = aberto ? estoque?.get(aberto) : undefined;
  if (selecionado) {
    return (
      <Estrutura titulo="Estoque" apenasSocio>
        <DetalheItem saldo={selecionado} nome={nome(selecionado)} unidade={unidade(selecionado)} aoVoltar={() => setAberto(null)} />
      </Estrutura>
    );
  }

  return (
    <Estrutura titulo="Estoque" apenasSocio>
      <div className="grid grid-cols-2 gap-3">
        <Cartao>
          <div className="text-sm text-suave">Valor em estoque</div>
          <div className="font-marca text-2xl font-bold text-serra">{formatarMoeda(valorTotal)}</div>
        </Cartao>
        <button type="button" onClick={() => setFiltro("parados")} className="text-left">
          <Cartao className={parados ? "border-morango" : ""}>
            <div className="text-sm text-suave">Parados</div>
            <div className={`font-marca text-2xl font-bold ${parados ? "text-morango" : "text-serra"}`}>{parados}</div>
          </Cartao>
        </button>
      </div>
      <Link href="/estoque/perda/" className="block">
        <Botao variante="secundario">🗑️ Lançar perda / descarte</Botao>
      </Link>
      <input className={classeEntrada} type="search" placeholder="Buscar produto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <Opcoes
        colunas={3}
        opcoes={[
          { valor: "com", rotulo: "Com saldo" },
          { valor: "parados", rotulo: "Parados" },
          { valor: "todos", rotulo: "Todos" },
        ]}
        valor={filtro}
        aoMudar={setFiltro}
      />
      {estoque === undefined ? (
        <Vazio>Carregando…</Vazio>
      ) : !linhas.length ? (
        <Vazio>{filtro === "parados" ? "Nenhum produto parado. 👍" : "Estoque vazio. As compras e colheitas entram aqui."}</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borda">
          {linhas.map((s) => {
            const parado = estaParado(s, diasAlerta(s));
            return (
              <button
                key={s.chave}
                type="button"
                onClick={() => setAberto(s.chave)}
                className="flex min-h-16 w-full items-center gap-3 border-b border-borda bg-white px-4 py-3 text-left last:border-b-0 active:bg-fundo"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{nome(s)}</div>
                  <div className="text-sm text-suave">
                    custo médio {formatarMoeda(s.custoMedio)}
                    {s.saldo > 0 ? ` · ${s.diasParado} dia(s)` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`font-semibold ${s.saldo < 0 ? "text-morango" : ""}`}>
                    {formatarNumero(s.saldo)} {unidade(s)}
                  </span>
                  {parado ? <span className="rounded-full bg-morango/15 px-2 text-xs font-bold text-morango">Parado</span> : null}
                  {s.saldo < 0 ? <span className="rounded-full bg-morango/15 px-2 text-xs font-bold text-morango">Negativo</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Estrutura>
  );
}

function DetalheItem({ saldo: s, nome, unidade, aoVoltar }: { saldo: Saldo; nome: string; unidade: string; aoVoltar: () => void }) {
  const { salvarVarios } = useSessao();
  const [ajustando, setAjustando] = useState(false);
  const [contado, setContado] = useState<number | null>(null);
  const motivos = useMapa("motivos_perda");
  const historico = useLiveQuery(
    async () =>
      ordenarMovimentos(
        (await db.t("movimentos_estoque").where("produto_id").equals(s.produto_id).toArray()).filter(
          (m) => !m.cancelado_em && (m.classificacao_id ?? null) === s.classificacao_id,
        ),
      )
        .reverse()
        .slice(0, 50),
    [s.produto_id, s.classificacao_id],
  );

  return (
    <div className="space-y-4">
      <Cartao className="space-y-3">
        <div className="font-marca text-xl font-bold">{nome}</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-fundo p-2">
            <div className="text-xs text-suave">Saldo</div>
            <div className="font-semibold">{formatarNumero(s.saldo)} {unidade}</div>
          </div>
          <div className="rounded-xl bg-fundo p-2">
            <div className="text-xs text-suave">Custo médio</div>
            <div className="font-semibold">{formatarMoeda(s.custoMedio)}</div>
          </div>
          <div className="rounded-xl bg-fundo p-2">
            <div className="text-xs text-suave">Parado há</div>
            <div className="font-semibold">{s.saldo > 0 ? `${s.diasParado} dia(s)` : "–"}</div>
          </div>
        </div>
        {s.entradaMaisAntiga && s.saldo > 0 ? (
          <div className="text-sm text-suave">Entrada mais antiga ainda em estoque: {formatarData(s.entradaMaisAntiga)}</div>
        ) : null}
      </Cartao>

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/estoque/perda/?produto=${s.produto_id}&classe=${s.classificacao_id ?? ""}`}>
          <Botao variante="perigo">Perda</Botao>
        </Link>
        <Botao variante="secundario" onClick={() => setAjustando(true)}>
          Ajustar contagem
        </Botao>
      </div>

      {ajustando ? (
        <Cartao className="space-y-4">
          <Rotulo texto={`Quantidade contada (${unidade})`} ajuda={`O sistema mostra ${formatarNumero(s.saldo)}. A diferença vira um ajuste.`}>
            <EntradaNumero valor={contado} aoMudar={setContado} sufixo={unidade} autoFocus />
          </Rotulo>
          <Botao
            disabled={contado === null || contado < 0}
            onClick={async () => {
              await salvarVarios(
                montarAjuste({
                  data: hoje(),
                  produto_id: s.produto_id,
                  classificacao_id: s.classificacao_id,
                  saldoSistema: s.saldo,
                  contado: contado!,
                  custoSaida: custoDeSaida(s, Math.max(s.saldo - contado!, 0)),
                }),
              );
              setAjustando(false);
              setContado(null);
            }}
          >
            Salvar contagem
          </Botao>
          <Botao variante="fantasma" onClick={() => setAjustando(false)}>
            Cancelar
          </Botao>
        </Cartao>
      ) : null}

      <Cartao className="space-y-2">
        <div className="font-semibold">Últimos movimentos</div>
        {(historico ?? []).map((m) => (
          <div key={m.id} className="flex justify-between gap-2 border-b border-borda pb-2 text-sm last:border-0">
            <div>
              <div className="font-semibold">{ROTULO_TIPO[String(m.tipo)] ?? String(m.tipo)}</div>
              <div className="text-suave">
                {formatarData(String(m.data))}
                {m.motivo_perda_id ? ` · ${motivos?.get(String(m.motivo_perda_id))?.nome ?? ""}` : ""}
                {m.observacao ? ` · ${m.observacao}` : ""}
              </div>
            </div>
            <div className={`font-semibold ${Number(m.quantidade) < 0 ? "text-morango" : "text-serra"}`}>
              {Number(m.quantidade) > 0 ? "+" : ""}
              {formatarNumero(Number(m.quantidade))}
            </div>
          </div>
        ))}
      </Cartao>
      <Botao variante="fantasma" onClick={aoVoltar}>
        Voltar
      </Botao>
    </div>
  );
}
