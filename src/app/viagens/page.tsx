"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { Estrutura } from "@/components/Estrutura";
import { EntradaNumero, Opcoes } from "@/components/lancamento";
import { Botao, Cartao, classeEntrada, Rotulo, Vazio, Carregando } from "@/components/ui";
import { ativos, ordenarPorNome, useMapa, useTabela } from "@/lib/consultas";
import { db } from "@/lib/db";
import { formatarData, formatarMoeda, formatarNumero, hoje } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import type { Registro } from "@/lib/tabelas";
import { valorItem } from "@/lib/vendas";
import { diasViagem, montarEncerramento, resultadoViagem, ROTULO_SITUACAO_VIAGEM } from "@/lib/viagens";

const COR_SITUACAO: Record<string, string> = {
  planejada: "bg-borda",
  em_viagem: "bg-maracuja/30",
  encerrada: "bg-folha/30 text-serra",
};

export default function PaginaViagens() {
  return (
    <Suspense fallback={null}>
      <Viagens />
    </Suspense>
  );
}

function Viagens() {
  const params = useSearchParams();
  const router = useRouter();
  const aberta = params.get("id");
  const [criando, setCriando] = useState(false);
  const [filtro, setFiltro] = useState<"abertas" | "todas">("abertas");
  const viagens = useTabela("viagens");
  const veiculos = useMapa("veiculos");
  const motoristas = useMapa("motoristas");

  const lista = useMemo(
    () =>
      (viagens ?? [])
        .filter((v) => filtro === "todas" || v.situacao !== "encerrada")
        .sort((a, b) => `${b.data_saida}${b.criado_em}`.localeCompare(`${a.data_saida}${a.criado_em}`)),
    [viagens, filtro],
  );

  if (aberta) {
    return (
      <Estrutura titulo="Viagem" apenasSocio>
        <DetalheViagem id={aberta} aoVoltar={() => router.push("/viagens/")} />
      </Estrutura>
    );
  }
  if (criando) {
    return (
      <Estrutura titulo="Nova viagem" apenasSocio>
        <NovaViagem
          aoFechar={(id) => {
            setCriando(false);
            if (id) router.push(`/viagens/?id=${id}`);
          }}
        />
      </Estrutura>
    );
  }

  return (
    <Estrutura titulo="Viagens" voltar="/mais/" apenasSocio>
      <Botao onClick={() => setCriando(true)}>+ Nova viagem</Botao>
      <Opcoes
        opcoes={[
          { valor: "abertas" as const, rotulo: "Em aberto" },
          { valor: "todas" as const, rotulo: "Todas" },
        ]}
        valor={filtro}
        aoMudar={setFiltro}
      />
      {viagens === undefined ? (
        <Carregando />
      ) : !lista.length ? (
        <Vazio>Nenhuma viagem {filtro === "abertas" ? "em aberto" : "lançada"}.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borda">
          {lista.map((v) => (
            <Link
              key={v.id}
              href={`/viagens/?id=${v.id}`}
              className="flex min-h-16 w-full items-center gap-3 border-b border-borda bg-white px-4 py-3 text-left last:border-b-0 active:bg-fundo"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{String(v.destino)}</div>
                <div className="truncate text-sm text-suave">
                  {formatarData(String(v.data_saida))}
                  {v.veiculo_id ? ` · ${veiculos?.get(String(v.veiculo_id))?.placa ?? ""}` : ""}
                  {v.motorista_id ? ` · ${motoristas?.get(String(v.motorista_id))?.nome ?? ""}` : ""}
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${COR_SITUACAO[String(v.situacao)]}`}>
                {ROTULO_SITUACAO_VIAGEM[String(v.situacao)]}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Estrutura>
  );
}

function NovaViagem({ aoFechar }: { aoFechar: (id?: string) => void }) {
  const { salvar } = useSessao();
  const veiculos = useTabela("veiculos", ativos);
  const motoristas = useTabela("motoristas", ativos);
  const [destino, setDestino] = useState("");
  const [data, setData] = useState(hoje());
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const [motoristaId, setMotoristaId] = useState<string | null>(null);
  const [km, setKm] = useState<number | null>(null);
  const [obs, setObs] = useState("");
  return (
    <>
      <Cartao className="space-y-5">
        <Rotulo texto="Destino" obrigatorio>
          <input className={classeEntrada} value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ex.: CEASA BH" autoFocus />
        </Rotulo>
        <Rotulo texto="Data de saída">
          <input type="date" className={classeEntrada} value={data} onChange={(e) => setData(e.target.value || hoje())} />
        </Rotulo>
        {veiculos?.length ? (
          <Rotulo grupo texto="Veículo">
            <Opcoes
              opcoes={[...veiculos.map((v) => ({ valor: v.id as string | null, rotulo: `${v.placa}${v.descricao ? ` · ${v.descricao}` : ""}` })), { valor: null, rotulo: "Outro / frete" }]}
              valor={veiculoId}
              aoMudar={setVeiculoId}
            />
          </Rotulo>
        ) : null}
        {motoristas?.length ? (
          <Rotulo grupo texto="Motorista">
            <Opcoes
              opcoes={[...[...motoristas].sort(ordenarPorNome).map((m) => ({ valor: m.id as string | null, rotulo: String(m.nome) })), { valor: null, rotulo: "Nenhum" }]}
              valor={motoristaId}
              aoMudar={setMotoristaId}
            />
          </Rotulo>
        ) : null}
        <Rotulo texto="Km na saída">
          <EntradaNumero valor={km} aoMudar={setKm} inteiro sufixo="km" />
        </Rotulo>
        <Rotulo texto="Observação">
          <textarea className={classeEntrada} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Rotulo>
      </Cartao>
      <Botao
        disabled={!destino.trim()}
        onClick={async () => {
          const r = await salvar("viagens", {
            destino: destino.trim(),
            data_saida: data,
            veiculo_id: veiculoId,
            motorista_id: motoristaId,
            km_inicial: km === null ? null : Math.round(km),
            situacao: "planejada",
            observacao: obs.trim() || null,
          });
          aoFechar(r.id);
        }}
      >
        Criar viagem
      </Botao>
      <Botao variante="secundario" onClick={() => aoFechar()}>
        Voltar
      </Botao>
    </>
  );
}

function DetalheViagem({ id, aoVoltar }: { id: string; aoVoltar: () => void }) {
  const { salvar, salvarVarios } = useSessao();
  const [encerrando, setEncerrando] = useState(false);
  const dados = useLiveQuery(async () => {
    const viagem = await db.t("viagens").get(id);
    if (!viagem) return null;
    const vendas = (await db.t("vendas").where("viagem_id").equals(id).toArray()).filter((v) => !v.cancelado_em);
    const vendaItens = (await db.t("venda_itens").where("venda_id").anyOf(vendas.map((v) => v.id)).toArray()).filter(
      (i) => !i.cancelado_em,
    );
    const movimentos = await db.t("movimentos_estoque").where("origem_id").anyOf(vendaItens.map((i) => i.id)).toArray();
    const despesas = (await db.t("despesas").where("viagem_id").equals(id).toArray()).filter((d) => !d.cancelado_em);
    const comprasVolta = (await db.t("compras").where("viagem_id").equals(id).toArray()).filter((c) => !c.cancelado_em);
    const compraItens = await db.t("compra_itens").where("compra_id").anyOf(comprasVolta.map((c) => c.id)).toArray();
    const clientes = new Map((await db.t("clientes").toArray()).map((c) => [c.id, c]));
    const fornecedores = new Map((await db.t("fornecedores").toArray()).map((c) => [c.id, c]));
    const categorias = await db.t("categorias_despesa").toArray();
    const veiculo = viagem.veiculo_id ? await db.t("veiculos").get(String(viagem.veiculo_id)) : undefined;
    const motorista = viagem.motorista_id ? await db.t("motoristas").get(String(viagem.motorista_id)) : undefined;
    return { viagem, vendas, vendaItens, movimentos, despesas, comprasVolta, compraItens, clientes, fornecedores, categorias, veiculo, motorista };
  }, [id]);

  if (dados === undefined) return <Carregando />;
  if (!dados) return <Vazio>Viagem não encontrada.</Vazio>;
  const { viagem, vendas, vendaItens, despesas, comprasVolta, compraItens, clientes, fornecedores, categorias } = dados;
  const r = resultadoViagem(dados);
  const encerrada = viagem.situacao === "encerrada";
  const nomeCategoria = (cid: unknown) => String(categorias.find((c) => c.id === cid)?.nome ?? "");

  if (encerrando) {
    return (
      <Encerrar
        viagem={viagem}
        motorista={dados.motorista}
        categoriaDiaria={categorias.find((c) => /di[aá]ria/i.test(String(c.nome)) && !c.cancelado_em)}
        jaTemDiaria={despesas.some((d) => /di[aá]ria/i.test(nomeCategoria(d.categoria_id)))}
        aoCancelar={() => setEncerrando(false)}
        aoConfirmar={async (g) => {
          await salvarVarios(g);
          setEncerrando(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Cartao className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-marca text-xl font-bold">{String(viagem.destino)}</div>
            <div className="text-sm text-suave">
              Saída {formatarData(String(viagem.data_saida))}
              {viagem.data_volta ? ` · volta ${formatarData(String(viagem.data_volta))}` : ""}
            </div>
            <div className="text-sm text-suave">
              {[dados.veiculo?.placa, dados.motorista?.nome].filter(Boolean).join(" · ")}
              {r.km !== null ? ` · ${formatarNumero(r.km)} km` : viagem.km_inicial != null ? ` · saiu com ${formatarNumero(Number(viagem.km_inicial))} km` : ""}
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${COR_SITUACAO[String(viagem.situacao)]}`}>
            {ROTULO_SITUACAO_VIAGEM[String(viagem.situacao)]}
          </span>
        </div>
        {viagem.observacao ? <p className="pt-2 text-sm">{String(viagem.observacao)}</p> : null}
      </Cartao>

      <Cartao className="space-y-2">
        <h3 className="font-marca text-lg font-bold">Resultado da viagem</h3>
        <Linha rotulo="Vendas da carga de ida" valor={r.receita} />
        <Linha rotulo="Custo da mercadoria" valor={-r.cmv} />
        <Linha rotulo="Despesas da viagem" valor={-r.despesas} />
        <div className="flex justify-between border-t border-borda pt-2 font-marca text-xl font-bold">
          <span>Resultado</span>
          <span className={r.resultado < 0 ? "text-morango" : "text-serra"}>{formatarMoeda(r.resultado)}</span>
        </div>
        {r.custoPorKm !== null ? <div className="text-sm text-suave">Despesa por km: {formatarMoeda(r.custoPorKm)}</div> : null}
        {vendas.some((v) => v.situacao !== "acertada") ? (
          <div className="text-sm text-suave">Há vendas sem acerto: o resultado pode mudar depois do acerto.</div>
        ) : null}
      </Cartao>

      <Secao titulo={`Carga de ida · ${vendas.length} venda(s)`} acao={!encerrada ? { href: `/vendas/nova/?viagem=${id}`, texto: "+ Venda" } : undefined}>
        {vendas.map((v) => (
          <Link key={v.id} href={`/vendas/?id=${v.id}`} className="flex justify-between gap-2 border-b border-borda py-2 last:border-0">
            <span>
              <span className="font-semibold">{String(clientes.get(String(v.cliente_id))?.nome ?? "")}</span>
              <span className="block text-sm text-suave">
                {String(v.numero)} · {v.situacao === "acertada" ? "acertada" : "sem acerto"}
              </span>
            </span>
            <span className="font-semibold">
              {formatarMoeda(vendaItens.filter((i) => i.venda_id === v.id).reduce((s, i) => s + valorItem(i), 0))}
            </span>
          </Link>
        ))}
      </Secao>

      <Secao titulo={`Despesas · ${formatarMoeda(r.despesas)}`} acao={{ href: `/despesas/nova/?viagem=${id}`, texto: "+ Despesa" }}>
        {despesas.map((d) => (
          <div key={d.id} className="flex justify-between gap-2 border-b border-borda py-2 last:border-0">
            <span>
              <span className="font-semibold">{nomeCategoria(d.categoria_id)}</span>
              <span className="block text-sm text-suave">{[d.descricao, d.favorecido].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="font-semibold">{formatarMoeda(Number(d.valor))}</span>
          </div>
        ))}
      </Secao>

      <Secao
        titulo={`Carga de volta · ${formatarMoeda(r.volta.valor)}`}
        ajuda="Compras feitas no destino. Entram no estoque; não contam como custo da viagem."
        acao={!encerrada ? { href: `/compras/nova/?viagem=${id}`, texto: "+ Compra" } : undefined}
      >
        {comprasVolta.map((c) => (
          <div key={c.id} className="flex justify-between gap-2 border-b border-borda py-2 last:border-0">
            <span className="font-semibold">{String(fornecedores.get(String(c.fornecedor_id))?.nome ?? "")}</span>
            <span className="font-semibold">
              {formatarMoeda(compraItens.filter((i) => i.compra_id === c.id && !i.cancelado_em).reduce((s, i) => s + Number(i.total), 0))}
            </span>
          </div>
        ))}
      </Secao>

      {viagem.situacao === "planejada" ? (
        <Botao onClick={() => salvar("viagens", { id, situacao: "em_viagem" })}>Saiu para a viagem</Botao>
      ) : null}
      {!encerrada ? <Botao variante={viagem.situacao === "em_viagem" ? "primario" : "secundario"} onClick={() => setEncerrando(true)}>Encerrar viagem</Botao> : null}
      {encerrada ? (
        <Botao variante="fantasma" onClick={() => salvar("viagens", { id, situacao: "em_viagem" })}>
          Reabrir viagem
        </Botao>
      ) : null}
      <Botao variante="secundario" onClick={aoVoltar}>
        Voltar
      </Botao>
      {!encerrada && !vendas.length && !despesas.length && !comprasVolta.length ? (
        <Botao
          variante="perigo"
          onClick={async () => {
            if (!confirm("Excluir esta viagem?")) return;
            await salvar("viagens", { id, cancelado_em: new Date().toISOString() });
            aoVoltar();
          }}
        >
          Excluir viagem
        </Botao>
      ) : null}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-suave">{rotulo}</span>
      <span className="font-semibold">{formatarMoeda(valor)}</span>
    </div>
  );
}

function Secao({
  titulo,
  ajuda,
  acao,
  children,
}: {
  titulo: string;
  ajuda?: string;
  acao?: { href: string; texto: string };
  children: ReactNode[];
}) {
  return (
    <Cartao className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-marca text-lg font-bold">{titulo}</h3>
        {acao ? (
          <Link href={acao.href} className="shrink-0 font-semibold text-serra underline">
            {acao.texto}
          </Link>
        ) : null}
      </div>
      {ajuda ? <p className="text-sm text-suave">{ajuda}</p> : null}
      {children.length ? children : <p className="py-2 text-sm text-suave">Nada lançado.</p>}
    </Cartao>
  );
}

function Encerrar({
  viagem,
  motorista,
  categoriaDiaria,
  jaTemDiaria,
  aoCancelar,
  aoConfirmar,
}: {
  viagem: Registro;
  motorista: Registro | undefined;
  categoriaDiaria: Registro | undefined;
  jaTemDiaria: boolean;
  aoCancelar: () => void;
  aoConfirmar: (g: ReturnType<typeof montarEncerramento>) => Promise<void>;
}) {
  const [volta, setVolta] = useState(hoje() < String(viagem.data_saida) ? String(viagem.data_saida) : hoje());
  const [km, setKm] = useState<number | null>(null);
  const porDiaria = motorista?.forma_pagamento === "diaria" && !!categoriaDiaria && !jaTemDiaria;
  const dias = diasViagem(String(viagem.data_saida), volta);
  const [lancar, setLancar] = useState(porDiaria);
  const [valorDia, setValorDia] = useState<number | null>(motorista?.valor_diaria != null ? Number(motorista.valor_diaria) : null);
  const [qtdDias, setQtdDias] = useState<number | null>(dias);
  const [ultimoDias, setUltimoDias] = useState(dias);
  if (dias !== ultimoDias) {
    setUltimoDias(dias);
    setQtdDias(dias);
  }
  const kmInvalido = km !== null && viagem.km_inicial != null && km < Number(viagem.km_inicial);

  return (
    <div className="space-y-4">
      <h2 className="font-marca text-xl font-bold">Encerrar viagem</h2>
      <Cartao className="space-y-5">
        <Rotulo texto="Data da volta">
          <input type="date" className={classeEntrada} value={volta} min={String(viagem.data_saida)} onChange={(e) => setVolta(e.target.value || hoje())} />
        </Rotulo>
        <Rotulo
          texto="Km na chegada"
          ajuda={viagem.km_inicial != null ? `Saiu com ${formatarNumero(Number(viagem.km_inicial))} km.` : undefined}
          erro={kmInvalido ? "Menor que o km da saída." : undefined}
        >
          <EntradaNumero valor={km} aoMudar={setKm} inteiro sufixo="km" />
        </Rotulo>
        {porDiaria ? (
          <>
            <Rotulo grupo texto={`Lançar diária de ${motorista!.nome}?`}>
              <Opcoes
                opcoes={[
                  { valor: "sim", rotulo: "Sim, a pagar" },
                  { valor: "nao", rotulo: "Não" },
                ]}
                valor={lancar ? "sim" : "nao"}
                aoMudar={(v) => setLancar(v === "sim")}
              />
            </Rotulo>
            {lancar ? (
              <div className="grid grid-cols-2 gap-2">
                <Rotulo texto="Dias">
                  <EntradaNumero valor={qtdDias} aoMudar={setQtdDias} />
                </Rotulo>
                <Rotulo texto="Valor da diária">
                  <EntradaNumero valor={valorDia} aoMudar={setValorDia} dinheiro />
                </Rotulo>
              </div>
            ) : null}
            {lancar && qtdDias && valorDia ? (
              <div className="text-right font-semibold">Diárias a pagar: {formatarMoeda(qtdDias * valorDia)}</div>
            ) : null}
          </>
        ) : null}
      </Cartao>
      <Botao
        disabled={kmInvalido}
        onClick={() =>
          aoConfirmar(
            montarEncerramento({
              viagem,
              data_volta: volta,
              km_final: km === null ? null : Math.round(km),
              diaria:
                porDiaria && lancar && qtdDias && valorDia
                  ? { categoria: categoriaDiaria!, motorista: motorista!, dias: qtdDias, valorDia, vencimento: volta }
                  : null,
            }),
          )
        }
      >
        Encerrar viagem
      </Botao>
      <Botao variante="secundario" onClick={aoCancelar}>
        Voltar
      </Botao>
    </div>
  );
}
