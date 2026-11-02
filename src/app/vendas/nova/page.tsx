"use client";
// Lançamento de venda em 3 passos: cliente → itens (do estoque) → prazo e recebimento.
import Link from "next/link";
import { Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Estrutura } from "@/components/Estrutura";
import { EntradaNumero, EscolherDaLista, Opcoes, Passos } from "@/components/lancamento";
import { Botao, Cartao, classeEntrada, Rotulo } from "@/components/ui";
import { ativos, ordenarPorNome, ultimoPrecoVenda, useEstoque, useTabela } from "@/lib/consultas";
import { chaveEstoque, custoDeSaida, type Saldo } from "@/lib/estoque";
import { formatarData, formatarMoeda, formatarNumero, hoje, somarDias } from "@/lib/formato";
import type { FormaPagamento } from "@/lib/lancamentos";
import { useSessao } from "@/lib/sessao";
import type { Registro } from "@/lib/tabelas";
import { montarVenda, proximoNumero, totalVenda, type ItemVenda } from "@/lib/vendas";

type ItemTela = Omit<ItemVenda, "custo_unitario">;
type Recebimento = "prazo" | FormaPagamento;

export default function Pagina() {
  return (
    <Suspense fallback={null}>
      <NovaVenda />
    </Suspense>
  );
}

function NovaVenda() {
  const viagemParam = useSearchParams().get("viagem");
  const { perfil, salvarVarios } = useSessao();
  const [passo, setPasso] = useState(1);
  const [cliente, setCliente] = useState<Registro | null>(null);
  const [itens, setItens] = useState<ItemTela[]>([]);
  const [data, setData] = useState(hoje());
  const [prazo, setPrazo] = useState<number | null>(0);
  const [recebimento, setRecebimento] = useState<Recebimento>("prazo");
  const [viagemId, setViagemId] = useState<string | null>(viagemParam);
  const [observacao, setObservacao] = useState("");
  const [salva, setSalva] = useState<{ id: string; numero: string; total: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const clientes = useTabela("clientes", ativos);
  const vendas = useTabela("vendas");
  const todasVendas = useTabela("vendas", () => true);
  const produtos = useTabela("produtos", ativos);
  const classificacoes = useTabela("classificacoes", ativos);
  const viagens = useTabela("viagens", (v) => v.situacao !== "encerrada");
  const estoque = useEstoque(hoje());

  // Clientes com venda mais recente aparecem primeiro.
  const ordenados = useMemo(() => {
    const ultima = new Map<string, string>();
    for (const v of vendas ?? []) {
      const c = String(v.cliente_id);
      if (String(v.data) > (ultima.get(c) ?? "")) ultima.set(c, String(v.data));
    }
    return [...(clientes ?? [])].sort((a, b) => (ultima.get(b.id) ?? "").localeCompare(ultima.get(a.id) ?? "") || ordenarPorNome(a, b));
  }, [clientes, vendas]);

  const nomeProduto = (id: string) => String(produtos?.find((p) => p.id === id)?.nome ?? "");
  const nomeClass = (id: string | null) => (id ? String(classificacoes?.find((c) => c.id === id)?.nome ?? "") : "");
  const unidade = (id: string) => String(produtos?.find((p) => p.id === id)?.unidade ?? "");
  const total = totalVenda(itens);

  // Quanto já foi colocado nesta venda (para não mostrar saldo que já saiu).
  const usado = (p: string, c: string | null) =>
    itens.filter((i) => i.produto_id === p && i.classificacao_id === c).reduce((s, i) => s + i.quantidade, 0);

  const salvarVenda = async () => {
    if (!perfil?.letra) return setErro("Seu usuário não tem letra de romaneio. Peça a um sócio em Usuários.");
    if (prazo === null || prazo < 0) return setErro("Informe o prazo em dias (0 = no dia).");
    setErro(null);
    // Custo de cada item pelo PEPS, considerando itens repetidos na mesma venda.
    const jaSaiu = new Map<string, number>();
    const comCusto: ItemVenda[] = itens.map((i) => {
      const chave = chaveEstoque(i.produto_id, i.classificacao_id);
      const saldo = estoque?.get(chave);
      const antes = jaSaiu.get(chave) ?? 0;
      const totalDepois = custoDeSaida(saldo, antes + i.quantidade) * (antes + i.quantidade);
      const totalAntes = antes ? custoDeSaida(saldo, antes) * antes : 0;
      jaSaiu.set(chave, antes + i.quantidade);
      return { ...i, custo_unitario: (totalDepois - totalAntes) / i.quantidade };
    });
    const numero = proximoNumero(perfil.letra, (todasVendas ?? []).map((v) => String(v.numero)));
    const g = montarVenda({
      numero,
      data,
      cliente: cliente!,
      viagem_id: viagemId,
      prazo_dias: recebimento === "prazo" ? prazo : 0,
      observacao: observacao.trim() || null,
      itens: comCusto,
      recebimento: recebimento === "prazo" ? { tipo: "prazo" } : { tipo: "agora", forma: recebimento },
    });
    await salvarVarios(g);
    setSalva({ id: String(g[0].dados.id), numero, total });
  };

  if (salva) {
    return (
      <Estrutura titulo="Venda registrada">
        <Cartao className="space-y-2 text-center">
          <div className="text-5xl">✅</div>
          <div className="text-suave">Romaneio {salva.numero}</div>
          <div className="font-marca text-2xl font-bold">{formatarMoeda(salva.total)}</div>
          <div className="text-suave">{String(cliente?.nome ?? "")}</div>
          <div className="text-sm text-suave">Já saiu do estoque e entrou em contas a receber.</div>
        </Cartao>
        <Link href={`/vendas/?id=${salva.id}`} className="block">
          <Botao>Abrir venda e enviar romaneio</Botao>
        </Link>
        <Botao
          variante="secundario"
          onClick={() => {
            setSalva(null);
            setCliente(null);
            setItens([]);
            setObservacao("");
            setPasso(1);
          }}
        >
          Nova venda
        </Botao>
      </Estrutura>
    );
  }

  return (
    <Estrutura titulo="Nova venda" voltar={passo > 1 ? undefined : "/lancar/"} apenasSocio>
      <Passos atual={passo} total={3} />

      {passo === 1 ? (
        <>
          <h2 className="font-marca text-xl font-bold">Para quem você vendeu?</h2>
          <EscolherDaLista
            itens={ordenados}
            titulo={(r) => String(r.nome)}
            detalhe={(r) => [r.cidade, Number(r.prazo_dias) ? `prazo ${r.prazo_dias} dias` : "à vista"].filter(Boolean).join(" · ")}
            selecionado={cliente?.id}
            aoEscolher={(r) => {
              setCliente(r);
              const p = Number(r.prazo_dias ?? 0);
              setPrazo(p);
              setRecebimento("prazo");
              setPasso(2);
            }}
            vazio="Nenhum cliente cadastrado. Cadastre em Mais → Cadastros → Clientes."
          />
        </>
      ) : null}

      {passo === 2 && cliente ? (
        <>
          <Cartao className="flex items-center justify-between">
            <div>
              <div className="text-sm text-suave">Cliente</div>
              <div className="font-semibold">{String(cliente.nome)}</div>
            </div>
            <button type="button" className="font-semibold text-serra underline" onClick={() => setPasso(1)}>
              Trocar
            </button>
          </Cartao>

          {itens.length ? (
            <Cartao className="space-y-2">
              {itens.map((i, n) => (
                <div key={n} className="flex items-center justify-between gap-2 border-b border-borda pb-2 last:border-0">
                  <div>
                    <div className="font-semibold">
                      {nomeProduto(i.produto_id)} {nomeClass(i.classificacao_id)}
                    </div>
                    <div className="text-sm text-suave">
                      {formatarNumero(i.quantidade)} {unidade(i.produto_id)} × {formatarMoeda(i.preco_unitario)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatarMoeda(i.quantidade * i.preco_unitario)}</div>
                    <button type="button" className="text-sm text-morango" onClick={() => setItens(itens.filter((_, k) => k !== n))}>
                      remover
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-1 font-marca text-xl font-bold">
                <span>Total</span>
                <span>{formatarMoeda(total)}</span>
              </div>
            </Cartao>
          ) : null}

          <NovoItem
            clienteId={cliente.id}
            produtos={[...(produtos ?? [])].sort(ordenarPorNome)}
            classificacoes={[...(classificacoes ?? [])].sort((a, b) => Number(a.ordem) - Number(b.ordem))}
            estoque={estoque}
            usado={usado}
            primeiro={!itens.length}
            aoAdicionar={(i) => setItens([...itens, i])}
          />

          {itens.length ? <Botao onClick={() => setPasso(3)}>Continuar · {formatarMoeda(total)}</Botao> : null}
          <Botao variante="secundario" onClick={() => setPasso(1)}>
            Voltar
          </Botao>
        </>
      ) : null}

      {passo === 3 && cliente ? (
        <>
          <Cartao className="flex items-center justify-between">
            <div>
              <div className="text-sm text-suave">
                {String(cliente.nome)} · {itens.length} item(ns)
              </div>
              <div className="font-marca text-2xl font-bold">{formatarMoeda(total)}</div>
            </div>
            <button type="button" className="font-semibold text-serra underline" onClick={() => setPasso(2)}>
              Itens
            </button>
          </Cartao>
          <Cartao className="space-y-5">
            <Rotulo grupo texto="Recebimento">
              <Opcoes
                colunas={3}
                opcoes={[
                  { valor: "prazo" as Recebimento, rotulo: "A prazo / acerto" },
                  { valor: "pix" as Recebimento, rotulo: "Recebido no Pix" },
                  { valor: "dinheiro" as Recebimento, rotulo: "Recebido em dinheiro" },
                ]}
                valor={recebimento}
                aoMudar={setRecebimento}
              />
            </Rotulo>
            {recebimento === "prazo" ? (
              <Rotulo
                texto="Prazo para acerto (dias)"
                ajuda={prazo !== null ? `Vence em ${formatarData(somarDias(data, prazo))}. Fica em contas a receber.` : undefined}
              >
                <EntradaNumero valor={prazo} aoMudar={setPrazo} inteiro sufixo="dias" />
              </Rotulo>
            ) : null}
            <Rotulo texto="Data da venda">
              <input type="date" className={classeEntrada} value={data} max={hoje()} onChange={(e) => setData(e.target.value || hoje())} />
            </Rotulo>
            {viagens?.length ? (
              <Rotulo texto="Viagem (carga de ida)" ajuda="Opcional. Entra no resultado da viagem.">
                <select className={classeEntrada} value={viagemId ?? ""} onChange={(e) => setViagemId(e.target.value || null)}>
                  <option value="">Sem viagem</option>
                  {viagens.map((v) => (
                    <option key={v.id} value={v.id}>
                      {formatarData(String(v.data_saida))} · {String(v.destino)}
                    </option>
                  ))}
                </select>
              </Rotulo>
            ) : null}
            <Rotulo texto="Observação">
              <textarea className={classeEntrada} rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </Rotulo>
            {erro ? <p className="font-semibold text-morango">{erro}</p> : null}
          </Cartao>
          <Botao onClick={salvarVenda}>Salvar venda</Botao>
          <Botao variante="secundario" onClick={() => setPasso(2)}>
            Voltar
          </Botao>
        </>
      ) : null}
    </Estrutura>
  );
}

function NovoItem({
  clienteId,
  produtos,
  classificacoes,
  estoque,
  usado,
  primeiro,
  aoAdicionar,
}: {
  clienteId: string;
  produtos: Registro[];
  classificacoes: Registro[];
  estoque: Map<string, Saldo> | undefined;
  usado: (p: string, c: string | null) => number;
  primeiro: boolean;
  aoAdicionar: (i: ItemTela) => void;
}) {
  const [produto, setProduto] = useState<Registro | null>(null);
  const [classe, setClasse] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState<number | null>(null);
  const [preco, setPreco] = useState<number | null>(null);
  const [sugestao, setSugestao] = useState<string | null>(null);

  const disponivel = (p: string, c: string | null) => (estoque?.get(chaveEstoque(p, c))?.saldo ?? 0) - usado(p, c);
  const disponivelProduto = (p: string) =>
    [null, ...classificacoes.map((c) => c.id)].reduce((s, c) => s + Math.max(disponivel(p, c), 0), 0);

  const consulta = useRef(0);
  const sugerir = async (p: Registro, c: string | null) => {
    const minha = ++consulta.current;
    const u = await ultimoPrecoVenda(clienteId, p.id, c);
    if (minha !== consulta.current) return;
    if (u) {
      setPreco(u.preco);
      setSugestao(`Último preço ${u.doCliente ? "para este cliente" : "vendido"}: ${formatarMoeda(u.preco)} em ${formatarData(u.data)}`);
    } else {
      setPreco(null);
      setSugestao(null);
    }
  };

  const escolherProduto = (p: Registro) => {
    setProduto(p);
    // Já marca a classificação que tem estoque, se só uma tiver.
    const comSaldo = [...classificacoes.map((c) => c.id as string | null), null].filter((c) => disponivel(p.id, c) > 0);
    const c = comSaldo.length === 1 ? comSaldo[0] : null;
    setClasse(c);
    void sugerir(p, c);
  };

  if (!produto) {
    const ordem = [...produtos].sort((a, b) => Number(disponivelProduto(b.id) > 0) - Number(disponivelProduto(a.id) > 0));
    return (
      <div className="space-y-3">
        <h2 className="font-marca text-xl font-bold">{primeiro ? "Qual produto?" : "Adicionar outro produto"}</h2>
        <div className="grid grid-cols-2 gap-2">
          {ordem.map((p) => {
            const d = disponivelProduto(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => escolherProduto(p)}
                className={`min-h-16 rounded-xl border-2 bg-white px-3 py-2 text-left font-semibold active:bg-fundo ${d > 0 ? "border-borda" : "border-dashed border-borda text-suave"}`}
              >
                {String(p.nome)}
                <span className="block text-xs font-normal text-suave">
                  {d > 0 ? `${formatarNumero(d)} ${p.unidade} em estoque` : "sem estoque"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const saldo = disponivel(produto.id, classe);
  const valido = quantidade !== null && quantidade > 0 && preco !== null && preco >= 0;
  const passa = valido && quantidade! > saldo + 1e-6;
  return (
    <Cartao className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-marca text-xl font-bold">{String(produto.nome)}</h2>
        <button type="button" className="font-semibold text-serra underline" onClick={() => setProduto(null)}>
          Trocar
        </button>
      </div>
      {classificacoes.length ? (
        <Rotulo grupo texto="Classificação">
          <Opcoes
            colunas={Math.min(3, classificacoes.length + 1)}
            opcoes={[...classificacoes.map((c) => ({ valor: c.id as string | null, rotulo: String(c.nome) })), { valor: null, rotulo: "Sem" }].map(
              (o) => {
                const d = disponivel(produto.id, o.valor);
                return { ...o, rotulo: d > 0 ? `${o.rotulo} (${formatarNumero(d)})` : o.rotulo };
              },
            )}
            valor={classe}
            aoMudar={(c) => {
              setClasse(c);
              void sugerir(produto, c);
            }}
          />
        </Rotulo>
      ) : null}
      <Rotulo texto="Quantidade" ajuda={`Em estoque: ${formatarNumero(Math.max(saldo, 0))} ${produto.unidade}`}>
        <EntradaNumero valor={quantidade} aoMudar={setQuantidade} sufixo={String(produto.unidade)} autoFocus />
      </Rotulo>
      <Rotulo texto={`Preço por ${produto.unidade}`} ajuda={sugestao ?? undefined}>
        <EntradaNumero valor={preco} aoMudar={setPreco} dinheiro />
      </Rotulo>
      {passa ? (
        <p className="rounded-xl bg-maracuja/20 p-3 text-sm font-semibold">
          Quantidade maior que o estoque. Dá para salvar assim mesmo, mas o estoque ficará negativo até lançar a entrada.
        </p>
      ) : null}
      {valido ? <div className="text-right font-semibold">Subtotal {formatarMoeda(quantidade! * preco!)}</div> : null}
      <Botao
        disabled={!valido}
        onClick={() => {
          aoAdicionar({ produto_id: produto.id, classificacao_id: classe, quantidade: quantidade!, preco_unitario: preco! });
          setProduto(null);
          setQuantidade(null);
          setPreco(null);
          setSugestao(null);
        }}
      >
        Adicionar item
      </Botao>
    </Cartao>
  );
}
