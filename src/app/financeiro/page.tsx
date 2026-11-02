"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { EntradaNumero, Opcoes, Selo } from "@/components/lancamento";
import { Botao, Cartao, classeEntrada, Rotulo, Vazio, Carregando } from "@/components/ui";
import { useMapa, useTabela } from "@/lib/consultas";
import { exportarExcel, exportarPdf, type TabelaRelatorio } from "@/lib/exportar";
import {
  agruparPorPessoa,
  calcularMargens,
  fimDoMes,
  fluxoCaixa,
  inicioDoMes,
  montarMovimentoAvulso,
  montarQuitacao,
  mudarMes,
  nomeMes,
  ROTULO_NATUREZA,
  saldoCaixa,
  type GrupoPessoa,
  type LinhaMargem,
  type Natureza,
} from "@/lib/financeiro";
import { formatarData, formatarMoeda, formatarNumero, hoje, somarDias } from "@/lib/formato";
import { arred2, type FormaPagamento } from "@/lib/lancamentos";
import { useSessao } from "@/lib/sessao";
import type { Registro } from "@/lib/tabelas";

type Aba = "resumo" | "pagar" | "receber" | "caixa" | "margens";
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "resumo", rotulo: "Resumo" },
  { valor: "pagar", rotulo: "A pagar" },
  { valor: "receber", rotulo: "A receber" },
  { valor: "caixa", rotulo: "Caixa" },
  { valor: "margens", rotulo: "Margens" },
];

const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "pix", rotulo: "Pix" },
  { valor: "dinheiro", rotulo: "Dinheiro" },
  { valor: "outro", rotulo: "Outro" },
];

const pct = (n: number) => `${formatarNumero(Math.round(n * 1000) / 10)}%`;

export default function PaginaFinanceiro() {
  return (
    <Suspense fallback={null}>
      <Financeiro />
    </Suspense>
  );
}

function useNomes() {
  const fornecedores = useMapa("fornecedores");
  const clientes = useMapa("clientes");
  const motoristas = useMapa("motoristas");
  return (t: Registro) =>
    String(
      (t.fornecedor_id && fornecedores?.get(String(t.fornecedor_id))?.nome) ||
        (t.cliente_id && clientes?.get(String(t.cliente_id))?.nome) ||
        (t.motorista_id && motoristas?.get(String(t.motorista_id))?.nome) ||
        t.favorecido ||
        "Sem nome",
    );
}

function Financeiro() {
  const params = useSearchParams();
  const router = useRouter();
  const aba = (ABAS.find((a) => a.valor === params.get("aba"))?.valor ?? "resumo") as Aba;
  return (
    <Estrutura titulo="Financeiro" apenasSocio>
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {ABAS.map((a) => (
            <button
              key={a.valor}
              type="button"
              onClick={() => router.replace(`/financeiro/?aba=${a.valor}`)}
              className={`min-h-11 shrink-0 rounded-full border-2 px-4 font-semibold ${
                aba === a.valor ? "border-serra bg-serra text-white" : "border-borda bg-white"
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>
      {aba === "resumo" ? <Resumo /> : null}
      {aba === "pagar" ? <Contas key="pagar" tipo="pagar" /> : null}
      {aba === "receber" ? <Contas key="receber" tipo="receber" /> : null}
      {aba === "caixa" ? <Caixa /> : null}
      {aba === "margens" ? <Margens /> : null}
    </Estrutura>
  );
}

// ---------------------------------------------------------------- resumo

function Resumo() {
  const router = useRouter();
  const movs = useTabela("movimentos_caixa");
  const titulos = useTabela("titulos");
  const baixas = useTabela("baixas");
  const nome = useNomes();
  const [avulso, setAvulso] = useState<Natureza | null>(null);
  const d = hoje();

  if (!movs || !titulos || !baixas) return <Carregando />;
  const saldo = saldoCaixa(movs);
  const temInicial = movs.some((m) => m.natureza === "saldo_inicial");
  const pagar = agruparPorPessoa(titulos, baixas, "pagar", d, nome);
  const receber = agruparPorPessoa(titulos, baixas, "receber", d, nome);
  const soma = (gs: GrupoPessoa[], f: (g: GrupoPessoa) => number) => arred2(gs.reduce((s, g) => s + f(g), 0));
  const semana = somarDias(d, 7);
  const ate7 = (gs: GrupoPessoa[]) =>
    arred2(gs.flatMap((g) => g.contas).filter((c) => String(c.titulo.vencimento) <= semana).reduce((s, c) => s + c.falta, 0));

  if (avulso) return <MovimentoAvulso natureza={avulso} aoFechar={() => setAvulso(null)} />;

  return (
    <>
      <Cartao className="space-y-1">
        <div className="text-sm text-suave">Saldo em caixa</div>
        <div className={`font-marca text-3xl font-bold ${saldo.total < 0 ? "text-morango" : ""}`}>{formatarMoeda(saldo.total)}</div>
        <div className="text-sm text-suave">
          Pix/conta {formatarMoeda(saldo.porForma.pix)} · Dinheiro {formatarMoeda(saldo.porForma.dinheiro)}
          {saldo.porForma.outro ? ` · Outro ${formatarMoeda(saldo.porForma.outro)}` : ""}
        </div>
      </Cartao>
      {!temInicial ? (
        <Cartao className="space-y-3 border-maracuja bg-maracuja/10">
          <p className="text-sm">
            Para o saldo bater com o real, informe quanto havia em caixa (Pix/conta e dinheiro) no dia em que começaram a usar o sistema.
          </p>
          <Botao onClick={() => setAvulso("saldo_inicial")}>Informar saldo inicial</Botao>
        </Cartao>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => router.replace("/financeiro/?aba=receber")} className="text-left">
          <Cartao className="h-full space-y-1">
            <div className="text-sm text-suave">A receber</div>
            <div className="font-marca text-xl font-bold text-serra">{formatarMoeda(soma(receber, (g) => g.aberto))}</div>
            <div className="text-xs text-suave">Vencido {formatarMoeda(soma(receber, (g) => g.vencido))}</div>
            <div className="text-xs text-suave">Até 7 dias {formatarMoeda(ate7(receber))}</div>
          </Cartao>
        </button>
        <button type="button" onClick={() => router.replace("/financeiro/?aba=pagar")} className="text-left">
          <Cartao className="h-full space-y-1">
            <div className="text-sm text-suave">A pagar</div>
            <div className="font-marca text-xl font-bold text-morango">{formatarMoeda(soma(pagar, (g) => g.aberto))}</div>
            <div className="text-xs text-suave">Vencido {formatarMoeda(soma(pagar, (g) => g.vencido))}</div>
            <div className="text-xs text-suave">Até 7 dias {formatarMoeda(ate7(pagar))}</div>
          </Cartao>
        </button>
      </div>
      <Cartao className="space-y-1">
        <div className="text-sm text-suave">Saldo previsto (caixa + receber − pagar)</div>
        <div className="font-marca text-xl font-bold">
          {formatarMoeda(saldo.total + soma(receber, (g) => g.aberto) - soma(pagar, (g) => g.aberto))}
        </div>
      </Cartao>
      <div className="grid grid-cols-2 gap-2">
        <Botao variante="secundario" onClick={() => setAvulso("retirada")}>
          Retirada
        </Botao>
        <Botao variante="secundario" onClick={() => setAvulso("aporte")}>
          Aporte
        </Botao>
      </div>
      <Botao variante="fantasma" onClick={() => setAvulso(temInicial ? "ajuste" : "saldo_inicial")}>
        {temInicial ? "Ajustar caixa (conferência)" : "Saldo inicial"}
      </Botao>
    </>
  );
}

function MovimentoAvulso({ natureza, aoFechar }: { natureza: Natureza; aoFechar: () => void }) {
  const { salvarVarios, perfil } = useSessao();
  const [valor, setValor] = useState<number | null>(null);
  const [dinheiro, setDinheiro] = useState<number | null>(null);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [data, setData] = useState(hoje());
  const [descricao, setDescricao] = useState(natureza === "retirada" ? `Retirada - ${perfil?.nome ?? ""}` : "");
  const [erro, setErro] = useState<string | null>(null);
  const inicial = natureza === "saldo_inicial";

  return (
    <>
      <h2 className="font-marca text-xl font-bold">{ROTULO_NATUREZA[natureza]}</h2>
      <Cartao className="space-y-5">
        {inicial ? (
          <>
            <Rotulo texto="Saldo em Pix / conta">
              <EntradaNumero valor={valor} aoMudar={setValor} dinheiro autoFocus />
            </Rotulo>
            <Rotulo texto="Saldo em dinheiro">
              <EntradaNumero valor={dinheiro} aoMudar={setDinheiro} dinheiro />
            </Rotulo>
          </>
        ) : (
          <>
            {natureza === "ajuste" ? (
              <Rotulo grupo texto="O caixa real tem">
                <Opcoes
                  opcoes={[
                    { valor: "entrada" as const, rotulo: "Mais que o sistema" },
                    { valor: "saida" as const, rotulo: "Menos que o sistema" },
                  ]}
                  valor={tipo}
                  aoMudar={setTipo}
                />
              </Rotulo>
            ) : null}
            <Rotulo texto={natureza === "ajuste" ? "Diferença" : "Valor"}>
              <EntradaNumero valor={valor} aoMudar={setValor} dinheiro autoFocus />
            </Rotulo>
            <Rotulo grupo texto="Forma">
              <Opcoes colunas={3} opcoes={FORMAS} valor={forma} aoMudar={setForma} />
            </Rotulo>
            <Rotulo texto="Descrição">
              <input className={classeEntrada} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </Rotulo>
          </>
        )}
        <Rotulo texto="Data">
          <input type="date" className={classeEntrada} value={data} onChange={(e) => setData(e.target.value || hoje())} />
        </Rotulo>
        {erro ? <p className="font-semibold text-morango">{erro}</p> : null}
      </Cartao>
      <Botao
        onClick={async () => {
          try {
            const g = inicial
              ? [
                  ...(valor ? montarMovimentoAvulso({ natureza, tipo: "entrada", valor, forma: "pix", data, descricao: "Saldo inicial Pix/conta" }) : []),
                  ...(dinheiro ? montarMovimentoAvulso({ natureza, tipo: "entrada", valor: dinheiro, forma: "dinheiro", data, descricao: "Saldo inicial dinheiro" }) : []),
                ]
              : montarMovimentoAvulso({ natureza, tipo, valor: valor ?? 0, forma, data, descricao: descricao.trim() || null });
            if (!g.length) return setErro("Informe ao menos um valor.");
            await salvarVarios(g);
            aoFechar();
          } catch (e) {
            setErro((e as Error).message);
          }
        }}
      >
        Salvar
      </Botao>
      <Botao variante="secundario" onClick={aoFechar}>
        Voltar
      </Botao>
    </>
  );
}

// ---------------------------------------------------------------- contas

function Contas({ tipo }: { tipo: "pagar" | "receber" }) {
  const titulos = useTabela("titulos");
  const baixas = useTabela("baixas");
  const nome = useNomes();
  const [aberto, setAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const d = hoje();
  const grupos = useMemo(
    () => (titulos && baixas ? agruparPorPessoa(titulos, baixas, tipo, d, nome) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [titulos, baixas, tipo, d, nome],
  );
  if (!grupos || !baixas) return <Carregando />;
  const lista = grupos.filter((g) => !busca || g.nome.toLowerCase().includes(busca.toLowerCase()));
  const total = arred2(grupos.reduce((s, g) => s + g.aberto, 0));
  const vencido = arred2(grupos.reduce((s, g) => s + g.vencido, 0));
  const grupo = aberto ? grupos.find((g) => g.chave === aberto) : undefined;
  const rotulo = tipo === "pagar" ? "A pagar" : "A receber";

  if (grupo) return <ContasDaPessoa grupo={grupo} baixas={baixas} tipo={tipo} aoVoltar={() => setAberto(null)} />;

  const relatorio = (): TabelaRelatorio[] => [
    {
      titulo: rotulo,
      colunas: [
        { titulo: tipo === "pagar" ? "Fornecedor / favorecido" : "Cliente" },
        { titulo: "Descrição", largura: 36 },
        { titulo: "Vencimento", tipo: "data" },
        { titulo: "Valor", tipo: "moeda" },
        { titulo: tipo === "pagar" ? "Pago" : "Recebido", tipo: "moeda" },
        { titulo: "Falta", tipo: "moeda" },
      ],
      linhas: grupos.flatMap((g) =>
        g.contas.map((c) => [g.nome, String(c.titulo.descricao ?? ""), String(c.titulo.vencimento), Number(c.titulo.valor), c.pago, c.falta]),
      ),
      rodape: ["Total", null, null, null, null, total],
    },
  ];

  return (
    <>
      <Cartao className="flex items-end justify-between">
        <div>
          <div className="text-sm text-suave">{rotulo}</div>
          <div className={`font-marca text-2xl font-bold ${tipo === "pagar" ? "text-morango" : "text-serra"}`}>{formatarMoeda(total)}</div>
        </div>
        <div className="text-right text-sm text-suave">Vencido {formatarMoeda(vencido)}</div>
      </Cartao>
      {grupos.length > 6 ? (
        <input className={classeEntrada} type="search" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      ) : null}
      {!lista.length ? (
        <Vazio>Nada {tipo === "pagar" ? "a pagar" : "a receber"}.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borda">
          {lista.map((g) => (
            <button
              key={g.chave}
              type="button"
              onClick={() => setAberto(g.chave)}
              className="flex min-h-16 w-full items-center gap-3 border-b border-borda bg-white px-4 py-3 text-left last:border-b-0 active:bg-fundo"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{g.nome}</div>
                <div className="text-sm text-suave">
                  {g.contas.length} conta(s) · vence {formatarData(String(g.proximoVencimento))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-semibold">{formatarMoeda(g.aberto)}</span>
                {g.vencido > 0 ? <Selo situacao="vencida" receber={tipo === "receber"} /> : null}
              </div>
            </button>
          ))}
        </div>
      )}
      <Exportar
        tabelas={relatorio}
        titulo={rotulo}
        subtitulo={`Posição em ${formatarData(d)}`}
        arquivo={`${tipo === "pagar" ? "contas-a-pagar" : "contas-a-receber"}-${d}`}
      />
    </>
  );
}

function ContasDaPessoa({
  grupo,
  baixas,
  tipo,
  aoVoltar,
}: {
  grupo: GrupoPessoa;
  baixas: Registro[];
  tipo: "pagar" | "receber";
  aoVoltar: () => void;
}) {
  const { salvarVarios } = useSessao();
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(grupo.contas.map((c) => c.titulo.id)));
  const selecionadas = grupo.contas.filter((c) => marcadas.has(c.titulo.id));
  const totalSel = arred2(selecionadas.reduce((s, c) => s + c.falta, 0));
  const [valor, setValor] = useState<number | null>(totalSel);
  const [ultimoTotal, setUltimoTotal] = useState(totalSel);
  if (ultimoTotal !== totalSel) {
    setUltimoTotal(totalSel);
    setValor(totalSel);
  }
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [data, setData] = useState(hoje());
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const verbo = tipo === "pagar" ? "Pagar" : "Receber";

  if (feito) {
    return (
      <>
        <Cartao className="space-y-2 text-center">
          <div className="text-5xl">✅</div>
          <div className="font-marca text-xl font-bold">{feito}</div>
        </Cartao>
        <Botao onClick={aoVoltar}>Voltar à lista</Botao>
      </>
    );
  }

  return (
    <>
      <Cartao>
        <div className="font-marca text-xl font-bold">{grupo.nome}</div>
        <div className="text-sm text-suave">
          Em aberto {formatarMoeda(grupo.aberto)}
          {grupo.vencido ? ` · vencido ${formatarMoeda(grupo.vencido)}` : ""}
        </div>
      </Cartao>
      <div className="overflow-hidden rounded-2xl border border-borda">
        {grupo.contas.map((c) => {
          const marcada = marcadas.has(c.titulo.id);
          return (
            <label key={c.titulo.id} className="flex min-h-16 items-center gap-3 border-b border-borda bg-white px-4 py-3 last:border-b-0">
              <input
                type="checkbox"
                className="h-6 w-6 accent-serra"
                checked={marcada}
                onChange={() => {
                  const n = new Set(marcadas);
                  if (marcada) n.delete(c.titulo.id);
                  else n.add(c.titulo.id);
                  setMarcadas(n);
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{String(c.titulo.descricao ?? "")}</div>
                <div className="text-sm text-suave">
                  Vence {formatarData(String(c.titulo.vencimento))}
                  {c.pago ? ` · já ${tipo === "pagar" ? "pago" : "recebido"} ${formatarMoeda(c.pago)}` : ""}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-semibold">{formatarMoeda(c.falta)}</span>
                <Selo situacao={c.situacao} receber={tipo === "receber"} />
              </div>
            </label>
          );
        })}
      </div>
      <Cartao className="space-y-5">
        <h3 className="font-marca text-lg font-bold">
          {verbo} {selecionadas.length} conta(s) · {formatarMoeda(totalSel)}
        </h3>
        <Rotulo texto="Valor" ajuda="Pode ser menor (parcial): quita primeiro as que vencem antes.">
          <EntradaNumero valor={valor} aoMudar={setValor} dinheiro />
        </Rotulo>
        <Rotulo grupo texto="Forma">
          <Opcoes colunas={3} opcoes={FORMAS} valor={forma} aoMudar={setForma} />
        </Rotulo>
        <Rotulo texto="Data">
          <input type="date" className={classeEntrada} value={data} onChange={(e) => setData(e.target.value || hoje())} />
        </Rotulo>
        {erro ? <p className="font-semibold text-morango">{erro}</p> : null}
      </Cartao>
      <Botao
        disabled={!selecionadas.length || !valor}
        onClick={async () => {
          try {
            await salvarVarios(
              montarQuitacao({
                titulos: selecionadas.map((c) => c.titulo),
                baixas,
                valor: valor ?? 0,
                forma,
                data,
                descricao: `${tipo === "pagar" ? "Pagamento" : "Recebimento"} - ${grupo.nome} (${selecionadas.length} conta(s))`,
              }),
            );
            setFeito(`${formatarMoeda(valor ?? 0)} ${tipo === "pagar" ? "pagos a" : "recebidos de"} ${grupo.nome}`);
          } catch (e) {
            setErro((e as Error).message);
          }
        }}
      >
        Confirmar {valor ? formatarMoeda(valor) : ""}
      </Botao>
      <Botao variante="secundario" onClick={aoVoltar}>
        Voltar
      </Botao>
    </>
  );
}

// ---------------------------------------------------------------- caixa

function SeletorMes({ mes, aoMudar }: { mes: string; aoMudar: (m: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" aria-label="Mês anterior" className="min-h-11 min-w-11 rounded-full border-2 border-borda bg-white text-xl" onClick={() => aoMudar(mudarMes(mes, -1))}>
        ‹
      </button>
      <div className="font-marca text-lg font-bold">{nomeMes(mes).replace(/^./, (c) => c.toUpperCase())}</div>
      <button type="button" aria-label="Próximo mês" className="min-h-11 min-w-11 rounded-full border-2 border-borda bg-white text-xl" onClick={() => aoMudar(mudarMes(mes, 1))}>
        ›
      </button>
    </div>
  );
}

function Caixa() {
  const { salvar } = useSessao();
  const movs = useTabela("movimentos_caixa");
  const [mes, setMes] = useState(inicioDoMes(hoje()));
  if (!movs) return <Carregando />;
  const de = mes;
  const ate = fimDoMes(mes);
  const f = fluxoCaixa(movs, de, ate);
  const linhas = [...f.linhas].reverse();

  const relatorio = (): TabelaRelatorio[] => [
    {
      titulo: "Fluxo de caixa",
      colunas: [
        { titulo: "Data", tipo: "data" },
        { titulo: "Descrição", largura: 40 },
        { titulo: "Forma" },
        { titulo: "Entrada", tipo: "moeda" },
        { titulo: "Saída", tipo: "moeda" },
        { titulo: "Saldo", tipo: "moeda" },
      ],
      linhas: [
        [de, "Saldo anterior", null, null, null, f.saldoAnterior],
        ...f.linhas.map(({ m, saldo }) => [
          String(m.data),
          String(m.descricao ?? ROTULO_NATUREZA[String(m.natureza)] ?? ""),
          String(m.forma),
          m.tipo === "entrada" ? Number(m.valor) : null,
          m.tipo === "saida" ? Number(m.valor) : null,
          saldo,
        ]),
      ],
      rodape: ["Total", null, null, f.entradas, f.saidas, f.saldoFinal],
    },
  ];

  return (
    <>
      <SeletorMes mes={mes} aoMudar={setMes} />
      <Cartao className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-suave">Saldo anterior</span>
          <span className="font-semibold">{formatarMoeda(f.saldoAnterior)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-suave">Entradas</span>
          <span className="font-semibold text-serra">{formatarMoeda(f.entradas)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-suave">Saídas</span>
          <span className="font-semibold text-morango">-{formatarMoeda(f.saidas)}</span>
        </div>
        <div className="flex justify-between border-t border-borda pt-1 font-marca text-xl font-bold">
          <span>Saldo no fim</span>
          <span>{formatarMoeda(f.saldoFinal)}</span>
        </div>
      </Cartao>
      {!linhas.length ? (
        <Vazio>Nenhum movimento neste mês.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borda">
          {linhas.map(({ m, saldo }) => (
            <div key={m.id} className="flex min-h-16 items-center gap-3 border-b border-borda bg-white px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{String(m.descricao ?? ROTULO_NATUREZA[String(m.natureza)] ?? "")}</div>
                <div className="text-sm text-suave">
                  {formatarData(String(m.data))} · {String(m.forma)} · saldo {formatarMoeda(saldo)}
                </div>
                {m.natureza !== "baixa" ? (
                  <button
                    type="button"
                    className="text-sm text-morango underline"
                    onClick={async () => {
                      if (confirm("Excluir este movimento de caixa?")) await salvar("movimentos_caixa", { id: m.id, cancelado_em: new Date().toISOString() });
                    }}
                  >
                    excluir
                  </button>
                ) : null}
              </div>
              <span className={`shrink-0 font-semibold ${m.tipo === "entrada" ? "text-serra" : "text-morango"}`}>
                {m.tipo === "entrada" ? "+" : "-"}
                {formatarMoeda(Number(m.valor))}
              </span>
            </div>
          ))}
        </div>
      )}
      <Exportar tabelas={relatorio} titulo="Fluxo de caixa" subtitulo={`${formatarData(de)} a ${formatarData(ate)}`} arquivo={`caixa-${mes.slice(0, 7)}`} />
    </>
  );
}

// ---------------------------------------------------------------- margens

function Margens() {
  const vendas = useTabela("vendas");
  const itens = useTabela("venda_itens");
  const movs = useTabela("movimentos_estoque", (m) => m.tipo === "venda");
  const produtos = useMapa("produtos");
  const classes = useMapa("classificacoes");
  const clientes = useMapa("clientes");
  const viagens = useMapa("viagens");
  const [mes, setMes] = useState(inicioDoMes(hoje()));
  const [visao, setVisao] = useState<"produto" | "cliente" | "viagem">("produto");
  if (!vendas || !itens || !movs) return <Carregando />;
  const de = mes;
  const ate = fimDoMes(mes);
  const r = calcularMargens({ vendas, itens, movimentos: movs, de, ate });
  const nomeProduto = (chave: string) => {
    const [p, c] = chave.split("|");
    return `${produtos?.get(p)?.nome ?? ""} ${c ? (classes?.get(c)?.nome ?? "") : ""}`.trim();
  };
  const nomeCliente = (id: string) => String(clientes?.get(id)?.nome ?? "");
  const nomeViagem = (id: string) => {
    const v = viagens?.get(id);
    return v ? `${formatarData(String(v.data_saida))} · ${v.destino}` : "";
  };
  const lista = visao === "produto" ? r.porProduto : visao === "cliente" ? r.porCliente : r.porViagem;
  const nome = visao === "produto" ? nomeProduto : visao === "cliente" ? nomeCliente : nomeViagem;

  const tabela = (titulo: string, ls: LinhaMargem[], n: (c: string) => string, qtd: boolean): TabelaRelatorio => ({
    titulo,
    colunas: [
      { titulo: titulo.replace("Por ", "").replace(/^./, (c) => c.toUpperCase()) },
      ...(qtd ? [{ titulo: "Qtd.", tipo: "numero" as const }] : []),
      { titulo: "Vendas", tipo: "moeda" },
      { titulo: "Custo", tipo: "moeda" },
      { titulo: "Margem", tipo: "moeda" },
      { titulo: "Margem %", tipo: "percentual" },
    ],
    linhas: ls.map((l) => [n(l.chave), ...(qtd ? [l.quantidade] : []), l.receita, l.custo, l.margem, l.percentual]),
    rodape: ["Total", ...(qtd ? [null] : []), r.total.receita, r.total.custo, r.total.margem, r.total.percentual],
  });

  return (
    <>
      <SeletorMes mes={mes} aoMudar={setMes} />
      <Cartao className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-suave">Vendas (valor acertado)</span>
          <span className="font-semibold">{formatarMoeda(r.total.receita)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-suave">Custo das mercadorias</span>
          <span className="font-semibold">-{formatarMoeda(r.total.custo)}</span>
        </div>
        <div className="flex justify-between border-t border-borda pt-1 font-marca text-xl font-bold">
          <span>Margem</span>
          <span className={r.total.margem < 0 ? "text-morango" : "text-serra"}>
            {formatarMoeda(r.total.margem)} · {pct(r.total.percentual)}
          </span>
        </div>
        <p className="pt-1 text-xs text-suave">Margem bruta pelo custo médio (PEPS). Despesas de viagem e gerais ficam fora.</p>
      </Cartao>
      <Opcoes
        colunas={3}
        opcoes={[
          { valor: "produto" as const, rotulo: "Produto" },
          { valor: "cliente" as const, rotulo: "Cliente" },
          { valor: "viagem" as const, rotulo: "Viagem" },
        ]}
        valor={visao}
        aoMudar={setVisao}
      />
      {!lista.length ? (
        <Vazio>Nenhuma venda neste mês.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borda">
          {lista.map((l) => (
            <div key={l.chave} className="flex min-h-16 items-center gap-3 border-b border-borda bg-white px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{nome(l.chave)}</div>
                <div className="text-sm text-suave">
                  Vendas {formatarMoeda(l.receita)} · custo {formatarMoeda(l.custo)}
                  {visao === "produto" ? ` · ${formatarNumero(l.quantidade)} un.` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${l.margem < 0 ? "text-morango" : "text-serra"}`}>{formatarMoeda(l.margem)}</div>
                <div className="text-xs text-suave">{pct(l.percentual)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Exportar
        tabelas={() => [
          tabela("Por produto", r.porProduto, nomeProduto, true),
          tabela("Por cliente", r.porCliente, nomeCliente, false),
          tabela("Por viagem", r.porViagem, nomeViagem, false),
        ]}
        titulo="Margens"
        subtitulo={`${formatarData(de)} a ${formatarData(ate)}`}
        arquivo={`margens-${mes.slice(0, 7)}`}
      />
    </>
  );
}

// ---------------------------------------------------------------- exportar

function Exportar({
  tabelas,
  titulo,
  subtitulo,
  arquivo,
}: {
  tabelas: () => TabelaRelatorio[];
  titulo: string;
  subtitulo: string;
  arquivo: string;
}) {
  const [gerando, setGerando] = useState<string | null>(null);
  const rodar = async (tipo: "excel" | "pdf") => {
    setGerando(tipo);
    try {
      if (tipo === "excel") await exportarExcel(tabelas(), arquivo);
      else await exportarPdf(tabelas(), titulo, subtitulo, arquivo);
    } finally {
      setGerando(null);
    }
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Botao variante="secundario" disabled={!!gerando} onClick={() => rodar("excel")}>
        {gerando === "excel" ? "Gerando…" : "Excel"}
      </Botao>
      <Botao variante="secundario" disabled={!!gerando} onClick={() => rodar("pdf")}>
        {gerando === "pdf" ? "Gerando…" : "PDF"}
      </Botao>
    </div>
  );
}
