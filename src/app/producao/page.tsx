"use client";
import Link from "next/link";
import { useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { Opcoes } from "@/components/lancamento";
import { Botao, Cartao, classeEntrada, Rotulo, Vazio } from "@/components/ui";
import { ativos, ordenarPorNome, useMapa, useTabela } from "@/lib/consultas";
import { formatarData, formatarMoeda, formatarNumero, hoje } from "@/lib/formato";
import { montarCancelamento } from "@/lib/lancamentos";
import { useCiclos, type DadosCiclo } from "@/lib/producao";
import { useSessao } from "@/lib/sessao";
import { db } from "@/lib/db";

export default function Producao() {
  const { ehSocio } = useSessao();
  const ciclos = useCiclos();
  const areas = useMapa("areas");
  const produtos = useMapa("produtos");
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [verEncerrados, setVerEncerrados] = useState(false);

  const nome = (d: DadosCiclo) =>
    `${areas?.get(String(d.ciclo.area_id))?.nome ?? ""} · ${produtos?.get(String(d.ciclo.produto_id))?.nome ?? ""}`;

  const selecionado = ciclos?.find((c) => c.ciclo.id === aberto);
  if (selecionado) {
    return (
      <Estrutura titulo="Ciclo de produção">
        <DetalheCiclo dados={selecionado} nome={nome(selecionado)} aoVoltar={() => setAberto(null)} />
      </Estrutura>
    );
  }

  const lista = (ciclos ?? [])
    .filter((c) => verEncerrados || c.ciclo.situacao === "ativo")
    .sort((a, b) => String(b.ciclo.data_plantio).localeCompare(String(a.ciclo.data_plantio)));

  return (
    <Estrutura titulo="Produção própria" voltar="/mais/">
      {novo ? <NovoCiclo aoFechar={() => setNovo(false)} /> : ehSocio ? <Botao onClick={() => setNovo(true)}>+ Novo ciclo / plantio</Botao> : null}
      {ciclos === undefined ? (
        <Vazio>Carregando…</Vazio>
      ) : !lista.length ? (
        <Vazio>Nenhum ciclo ativo. Cadastre as áreas em Mais → Cadastros → Áreas e depois crie um ciclo.</Vazio>
      ) : (
        lista.map((d) => (
          <button key={d.ciclo.id} type="button" onClick={() => setAberto(d.ciclo.id)} className="block w-full text-left">
            <Cartao className="space-y-2 active:bg-fundo">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{nome(d)}</div>
                  <div className="text-sm text-suave">Plantio {formatarData(String(d.ciclo.data_plantio))}</div>
                </div>
                {d.ciclo.situacao === "encerrado" ? <span className="rounded-full bg-borda px-2 text-xs font-bold">Encerrado</span> : null}
              </div>
              <Indicadores d={d} />
            </Cartao>
          </button>
        ))
      )}
      <label className="flex items-center gap-3 px-1 text-suave">
        <input type="checkbox" className="h-5 w-5" checked={verEncerrados} onChange={(e) => setVerEncerrados(e.target.checked)} />
        Mostrar ciclos encerrados
      </label>
    </Estrutura>
  );
}

function Indicadores({ d }: { d: DadosCiclo }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl bg-fundo p-2">
        <div className="text-xs text-suave">Custo</div>
        <div className="font-semibold">{formatarMoeda(d.resumo.custoTotal)}</div>
      </div>
      <div className="rounded-xl bg-fundo p-2">
        <div className="text-xs text-suave">Colhido</div>
        <div className="font-semibold">{formatarNumero(Math.round(d.resumo.kgColhidos))} kg</div>
      </div>
      <div className="rounded-xl bg-fundo p-2">
        <div className="text-xs text-suave">Custo/kg</div>
        <div className="font-semibold">{d.resumo.custoPorKg === null ? "–" : formatarMoeda(d.resumo.custoPorKg)}</div>
      </div>
    </div>
  );
}

function DetalheCiclo({ dados: d, nome, aoVoltar }: { dados: DadosCiclo; nome: string; aoVoltar: () => void }) {
  const { ehSocio, salvar, salvarVarios } = useSessao();
  const categorias = useMapa("categorias_despesa");
  const produtos = useMapa("produtos");
  const classes = useMapa("classificacoes");
  const ativo = d.ciclo.situacao === "ativo";

  return (
    <div className="space-y-4">
      <Cartao className="space-y-3">
        <div>
          <div className="font-marca text-xl font-bold">{nome}</div>
          <div className="text-sm text-suave">
            Plantio {formatarData(String(d.ciclo.data_plantio))}
            {d.ciclo.data_encerramento ? ` · encerrado ${formatarData(String(d.ciclo.data_encerramento))}` : ""}
          </div>
        </div>
        <Indicadores d={d} />
      </Cartao>

      {ativo ? (
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/producao/colheita/?ciclo=${d.ciclo.id}`}>
            <Botao>🍓 Colheita</Botao>
          </Link>
          <Link href={`/despesas/nova/?ciclo=${d.ciclo.id}`}>
            <Botao variante="secundario">+ Despesa</Botao>
          </Link>
        </div>
      ) : null}

      <Cartao className="space-y-2">
        <div className="font-semibold">Colheitas</div>
        {!d.colheitas.length ? <div className="text-sm text-suave">Nenhuma colheita ainda.</div> : null}
        {[...d.colheitas]
          .sort((a, b) => String(b.data).localeCompare(String(a.data)))
          .map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 border-b border-borda pb-2 text-sm last:border-0">
              <div>
                <div className="font-semibold">{formatarData(String(c.data))}</div>
                {d.itens
                  .filter((i) => i.colheita_id === c.id)
                  .map((i) => (
                    <div key={i.id} className="text-suave">
                      {formatarNumero(Number(i.quantidade))} {String(produtos?.get(String(i.produto_id))?.unidade ?? "")}{" "}
                      {String(produtos?.get(String(i.produto_id))?.nome ?? "")} {String(classes?.get(String(i.classificacao_id))?.nome ?? "")}
                    </div>
                  ))}
              </div>
              {ehSocio ? (
                <button
                  type="button"
                  className="text-morango"
                  onClick={async () => {
                    if (!confirm("Cancelar esta colheita? Ela sai do estoque.")) return;
                    const itens = d.itens.filter((i) => i.colheita_id === c.id);
                    const movs = await db.t("movimentos_estoque").where("origem_id").anyOf(itens.map((i) => i.id)).toArray();
                    await salvarVarios(
                      montarCancelamento([
                        { tabela: "movimentos_estoque", lista: movs },
                        { tabela: "colheita_itens", lista: itens },
                        { tabela: "colheitas", lista: [c] },
                      ]),
                    );
                  }}
                >
                  cancelar
                </button>
              ) : null}
            </div>
          ))}
      </Cartao>

      <Cartao className="space-y-2">
        <div className="font-semibold">Despesas e insumos</div>
        {!d.despesas.length ? <div className="text-sm text-suave">Nenhuma despesa ainda.</div> : null}
        {[...d.despesas]
          .sort((a, b) => String(b.data).localeCompare(String(a.data)))
          .map((x) => (
            <div key={x.id} className="flex justify-between gap-2 border-b border-borda pb-2 text-sm last:border-0">
              <div>
                <div className="font-semibold">{String(categorias?.get(String(x.categoria_id))?.nome ?? "")}</div>
                <div className="text-suave">
                  {formatarData(String(x.data))} {x.descricao ? `· ${x.descricao}` : ""}
                </div>
              </div>
              <div className="font-semibold">{formatarMoeda(Number(x.valor))}</div>
            </div>
          ))}
      </Cartao>

      {ehSocio ? (
        <Botao
          variante="secundario"
          onClick={() =>
            salvar(
              "ciclos",
              ativo
                ? { id: d.ciclo.id, situacao: "encerrado", data_encerramento: hoje() }
                : { id: d.ciclo.id, situacao: "ativo", data_encerramento: null },
            )
          }
        >
          {ativo ? "Encerrar ciclo" : "Reabrir ciclo"}
        </Botao>
      ) : null}
      <Botao variante="fantasma" onClick={aoVoltar}>
        Voltar
      </Botao>
    </div>
  );
}

function NovoCiclo({ aoFechar }: { aoFechar: () => void }) {
  const { salvar } = useSessao();
  const areas = useTabela("areas", ativos);
  const produtos = useTabela("produtos", (p) => ativos(p) && p.categoria === "in_natura");
  const [area, setArea] = useState<string>("");
  const [produto, setProduto] = useState<string>("");
  const [data, setData] = useState(hoje());
  const [obs, setObs] = useState("");
  return (
    <Cartao className="space-y-4">
      <h2 className="font-marca text-xl font-bold">Novo ciclo / plantio</h2>
      <Rotulo grupo texto="Área / talhão" obrigatorio>
        <Opcoes
          opcoes={[...(areas ?? [])].sort(ordenarPorNome).map((a) => ({ valor: a.id, rotulo: String(a.nome) }))}
          valor={area}
          aoMudar={setArea}
        />
      </Rotulo>
      <Rotulo grupo texto="Cultura" obrigatorio>
        <Opcoes
          opcoes={[...(produtos ?? [])].sort(ordenarPorNome).map((p) => ({ valor: p.id, rotulo: String(p.nome) }))}
          valor={produto}
          aoMudar={setProduto}
        />
      </Rotulo>
      <Rotulo texto="Data do plantio">
        <input type="date" className={classeEntrada} value={data} onChange={(e) => setData(e.target.value || hoje())} />
      </Rotulo>
      <Rotulo texto="Observação">
        <input className={classeEntrada} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: 5 mil mudas de San Andreas" />
      </Rotulo>
      <Botao
        disabled={!area || !produto}
        onClick={async () => {
          await salvar("ciclos", { area_id: area, produto_id: produto, data_plantio: data, situacao: "ativo", observacao: obs.trim() || null });
          aoFechar();
        }}
      >
        Criar ciclo
      </Botao>
      <Botao variante="fantasma" onClick={aoFechar}>
        Cancelar
      </Botao>
    </Cartao>
  );
}
