"use client";
// Lançamento de compra em 3 passos: fornecedor → itens → pagamento.
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { EntradaNumero, EscolherDaLista, EscolherPagamento, Opcoes, Passos } from "@/components/lancamento";
import { Botao, Cartao, classeEntrada, Rotulo } from "@/components/ui";
import { ativos, ordenarPorNome, ultimoPreco, useTabela } from "@/lib/consultas";
import { formatarData, formatarMoeda, formatarNumero, hoje, mascararTelefone } from "@/lib/formato";
import { montarCompra, totalItens, type ItemCompra, type Pagamento } from "@/lib/lancamentos";
import { useSessao } from "@/lib/sessao";
import type { Registro } from "@/lib/tabelas";

export default function NovaCompra() {
  const { salvarVarios, salvar } = useSessao();
  const [passo, setPasso] = useState(1);
  const [fornecedor, setFornecedor] = useState<Registro | null>(null);
  const [itens, setItens] = useState<ItemCompra[]>([]);
  const [data, setData] = useState(hoje());
  const [pagamento, setPagamento] = useState<Pagamento>({ tipo: "agora", forma: "pix" });
  const [origem, setOrigem] = useState<"regional" | "retorno">("regional");
  const [viagemId, setViagemId] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [salva, setSalva] = useState<{ total: number; nome: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const fornecedores = useTabela("fornecedores", ativos);
  const compras = useTabela("compras");
  const produtos = useTabela("produtos", ativos);
  const classificacoes = useTabela("classificacoes", ativos);
  const viagens = useTabela("viagens", (v) => v.situacao !== "encerrada");

  // Fornecedores mais usados recentemente aparecem primeiro.
  const ordenados = useMemo(() => {
    const ultima = new Map<string, string>();
    for (const c of compras ?? []) {
      const f = String(c.fornecedor_id);
      if (String(c.data) > (ultima.get(f) ?? "")) ultima.set(f, String(c.data));
    }
    return [...(fornecedores ?? [])].sort(
      (a, b) => (ultima.get(b.id) ?? "").localeCompare(ultima.get(a.id) ?? "") || ordenarPorNome(a, b),
    );
  }, [fornecedores, compras]);

  const nomeProduto = (id: string) => String(produtos?.find((p) => p.id === id)?.nome ?? "");
  const nomeClass = (id: string | null) => (id ? String(classificacoes?.find((c) => c.id === id)?.nome ?? "") : "");
  const unidade = (id: string) => String(produtos?.find((p) => p.id === id)?.unidade ?? "");
  const total = totalItens(itens);

  if (salva) {
    return (
      <Estrutura titulo="Compra registrada">
        <Cartao className="space-y-2 text-center">
          <div className="text-5xl">✅</div>
          <div className="font-marca text-2xl font-bold">{formatarMoeda(salva.total)}</div>
          <div className="text-suave">{salva.nome}</div>
          <div className="text-sm text-suave">Já está no estoque e nas contas. Sobe para o servidor quando houver internet.</div>
        </Cartao>
        <Botao
          onClick={() => {
            setSalva(null);
            setFornecedor(null);
            setItens([]);
            setObservacao("");
            setPasso(1);
          }}
        >
          Nova compra
        </Botao>
        <Link href="/compras/" className="block">
          <Botao variante="secundario">Ver compras</Botao>
        </Link>
      </Estrutura>
    );
  }

  return (
    <Estrutura titulo="Nova compra" voltar={passo > 1 ? undefined : "/lancar/"}>
      <Passos atual={passo} total={3} />

      {passo === 1 ? (
        <>
          <h2 className="font-marca text-xl font-bold">De quem você comprou?</h2>
          <EscolherDaLista
            itens={ordenados}
            titulo={(r) => String(r.nome)}
            detalhe={(r) => [r.localidade || r.cidade, r.tipo === "fornecedor_destino" ? "fornecedor de destino" : null].filter(Boolean).join(" · ")}
            selecionado={fornecedor?.id}
            aoEscolher={(r) => {
              setFornecedor(r);
              if (r.tipo === "fornecedor_destino" && viagens?.length) setOrigem("retorno");
              setPasso(2);
            }}
            vazio="Nenhum produtor cadastrado."
            extra={<NovoProdutor aoCriar={async (dados) => {
              const r = await salvar("fornecedores", { ...dados, tipo: "produtor", ativo: true });
              setFornecedor(r);
              setPasso(2);
            }} />}
          />
        </>
      ) : null}

      {passo === 2 && fornecedor ? (
        <>
          <Cartao className="flex items-center justify-between">
            <div>
              <div className="text-sm text-suave">Fornecedor</div>
              <div className="font-semibold">{String(fornecedor.nome)}</div>
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
            fornecedorId={fornecedor.id}
            produtos={[...(produtos ?? [])].sort(ordenarPorNome)}
            classificacoes={[...(classificacoes ?? [])].sort((a, b) => Number(a.ordem) - Number(b.ordem))}
            primeiro={!itens.length}
            aoAdicionar={(i) => setItens([...itens, i])}
          />

          {itens.length ? <Botao onClick={() => setPasso(3)}>Continuar · {formatarMoeda(total)}</Botao> : null}
          <Botao variante="secundario" onClick={() => setPasso(1)}>
            Voltar
          </Botao>
        </>
      ) : null}

      {passo === 3 && fornecedor ? (
        <>
          <Cartao className="flex items-center justify-between">
            <div>
              <div className="text-sm text-suave">{String(fornecedor.nome)} · {itens.length} item(ns)</div>
              <div className="font-marca text-2xl font-bold">{formatarMoeda(total)}</div>
            </div>
            <button type="button" className="font-semibold text-serra underline" onClick={() => setPasso(2)}>
              Itens
            </button>
          </Cartao>
          <Cartao className="space-y-5">
            <Rotulo grupo texto="Pagamento">
              <EscolherPagamento valor={pagamento} aoMudar={setPagamento} data={data} />
            </Rotulo>
            <Rotulo texto="Data da compra">
              <input type="date" className={classeEntrada} value={data} max={hoje()} onChange={(e) => setData(e.target.value || hoje())} />
            </Rotulo>
            {viagens?.length ? (
              <Rotulo grupo texto="Origem">
                <Opcoes
                  opcoes={[
                    { valor: "regional", rotulo: "Região" },
                    { valor: "retorno", rotulo: "Volta de viagem" },
                  ]}
                  valor={origem}
                  aoMudar={setOrigem}
                />
              </Rotulo>
            ) : null}
            {origem === "retorno" && viagens?.length ? (
              <Rotulo texto="Viagem">
                <select className={classeEntrada} value={viagemId ?? ""} onChange={(e) => setViagemId(e.target.value || null)}>
                  <option value="">Escolha a viagem</option>
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
          <Botao
            onClick={async () => {
              if (origem === "retorno" && !viagemId) return setErro("Escolha a viagem da compra de volta.");
              setErro(null);
              await salvarVarios(
                montarCompra({
                  data,
                  fornecedor,
                  origem,
                  viagem_id: viagemId,
                  observacao: observacao.trim() || null,
                  itens,
                  pagamento,
                }),
              );
              setSalva({ total, nome: String(fornecedor.nome) });
            }}
          >
            Salvar compra
          </Botao>
          <Botao variante="secundario" onClick={() => setPasso(2)}>
            Voltar
          </Botao>
        </>
      ) : null}
    </Estrutura>
  );
}

function NovoItem({
  fornecedorId,
  produtos,
  classificacoes,
  primeiro,
  aoAdicionar,
}: {
  fornecedorId: string;
  produtos: Registro[];
  classificacoes: Registro[];
  primeiro: boolean;
  aoAdicionar: (i: ItemCompra) => void;
}) {
  const [produto, setProduto] = useState<Registro | null>(null);
  const [classe, setClasse] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState<number | null>(null);
  const [preco, setPreco] = useState<number | null>(null);
  const [sugestao, setSugestao] = useState<string | null>(null);

  // Só vale a resposta da última consulta (o toque em outra classificação descarta a anterior).
  const consulta = useRef(0);
  const sugerir = async (p: Registro, c: string | null) => {
    const minha = ++consulta.current;
    const u = await ultimoPreco(fornecedorId, p.id, c);
    if (minha !== consulta.current) return;
    if (u) {
      setPreco(u.preco);
      setSugestao(`Último preço ${u.doFornecedor ? "deste fornecedor" : "pago"}: ${formatarMoeda(u.preco)} em ${formatarData(u.data)}`);
    } else {
      setPreco(null);
      setSugestao(null);
    }
  };

  if (!produto) {
    return (
      <div className="space-y-3">
        <h2 className="font-marca text-xl font-bold">{primeiro ? "Qual produto?" : "Adicionar outro produto"}</h2>
        <div className="grid grid-cols-2 gap-2">
          {produtos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProduto(p);
                void sugerir(p, classe);
              }}
              className="min-h-16 rounded-xl border-2 border-borda bg-white px-3 py-2 text-left font-semibold active:bg-fundo"
            >
              {String(p.nome)}
              <span className="block text-xs font-normal text-suave">{String(p.unidade)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const valido = quantidade !== null && quantidade > 0 && preco !== null && preco >= 0;
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
            opcoes={[...classificacoes.map((c) => ({ valor: c.id as string | null, rotulo: String(c.nome) })), { valor: null, rotulo: "Sem" }]}
            valor={classe}
            aoMudar={(c) => {
              setClasse(c);
              void sugerir(produto, c);
            }}
          />
        </Rotulo>
      ) : null}
      <Rotulo texto="Quantidade">
        <EntradaNumero valor={quantidade} aoMudar={setQuantidade} sufixo={String(produto.unidade)} autoFocus />
      </Rotulo>
      <Rotulo texto={`Preço por ${produto.unidade}`} ajuda={sugestao ?? undefined}>
        <EntradaNumero valor={preco} aoMudar={setPreco} dinheiro />
      </Rotulo>
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

function NovoProdutor({ aoCriar }: { aoCriar: (d: { nome: string; telefone: string | null; localidade: string | null; cidade: string }) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [localidade, setLocalidade] = useState("");
  if (!aberto)
    return (
      <Botao variante="secundario" onClick={() => setAberto(true)}>
        + Produtor novo
      </Botao>
    );
  return (
    <Cartao className="space-y-4">
      <h3 className="font-marca text-lg font-bold">Produtor novo</h3>
      <Rotulo texto="Nome" obrigatorio>
        <input className={classeEntrada} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      </Rotulo>
      <Rotulo texto="Telefone / WhatsApp">
        <input className={classeEntrada} inputMode="tel" value={telefone} onChange={(e) => setTelefone(mascararTelefone(e.target.value))} />
      </Rotulo>
      <Rotulo texto="Comunidade / localidade">
        <input className={classeEntrada} value={localidade} onChange={(e) => setLocalidade(e.target.value)} />
      </Rotulo>
      <Botao
        disabled={!nome.trim()}
        onClick={() => aoCriar({ nome: nome.trim(), telefone: telefone || null, localidade: localidade.trim() || null, cidade: "Datas" })}
      >
        Salvar e continuar
      </Botao>
      <Botao variante="fantasma" onClick={() => setAberto(false)}>
        Cancelar
      </Botao>
    </Cartao>
  );
}
