"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { EntradaNumero, EscolherDaLista, Opcoes } from "@/components/lancamento";
import { Botao, Cartao, classeEntrada, Rotulo } from "@/components/ui";
import { ativos, ordenarPorNome, useMapa, useTabela } from "@/lib/consultas";
import { db } from "@/lib/db";
import { formatarData, formatarMoeda, formatarNumero, hoje } from "@/lib/formato";
import { custoUnitarioColheita, montarColheita, resumirCiclo } from "@/lib/lancamentos";
import { carregarCiclos } from "@/lib/producao";
import { useSessao } from "@/lib/sessao";
import type { Registro } from "@/lib/tabelas";

type Item = { produto_id: string; classificacao_id: string | null; quantidade: number };

export default function Pagina() {
  return (
    <Suspense>
      <NovaColheita />
    </Suspense>
  );
}

function NovaColheita() {
  const params = useSearchParams();
  const { salvarVarios } = useSessao();
  const [cicloId, setCicloId] = useState<string | null>(params.get("ciclo"));
  const [data, setData] = useState(hoje());
  const [itens, setItens] = useState<Item[]>([]);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [classe, setClasse] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState<number | null>(null);
  const [salva, setSalva] = useState<string | null>(null);

  const ciclos = useTabela("ciclos", (c) => c.situacao === "ativo");
  const produtos = useTabela("produtos", ativos);
  const classes = useTabela("classificacoes", ativos);
  const areas = useMapa("areas");
  const mapaProdutos = useMapa("produtos");
  const ciclo = ciclos?.find((c) => c.id === cicloId);
  const produtoAtual = produtoId ?? (ciclo ? String(ciclo.produto_id) : null);
  const unidade = (id: string) => String(mapaProdutos?.get(id)?.unidade ?? "");
  const nomeCiclo = (c: Registro) =>
    `${areas?.get(String(c.area_id))?.nome ?? ""} · ${mapaProdutos?.get(String(c.produto_id))?.nome ?? ""}`;

  if (salva) {
    return (
      <Estrutura titulo="Colheita registrada">
        <Cartao className="space-y-2 text-center">
          <div className="text-5xl">🍓</div>
          <div className="font-semibold">{salva}</div>
          <div className="text-sm text-suave">Já entrou no estoque como produção própria.</div>
        </Cartao>
        <Botao onClick={() => { setSalva(null); setItens([]); }}>Nova colheita</Botao>
        <Link href="/producao/" className="block">
          <Botao variante="secundario">Ver produção</Botao>
        </Link>
      </Estrutura>
    );
  }

  if (!ciclo) {
    return (
      <Estrutura titulo="Colheita" voltar="/lancar/">
        <h2 className="font-marca text-xl font-bold">De qual ciclo / talhão?</h2>
        <EscolherDaLista
          itens={ciclos}
          titulo={(c) => nomeCiclo(c)}
          detalhe={(c) => `Plantio ${formatarData(String(c.data_plantio))}`}
          aoEscolher={(c) => setCicloId(c.id)}
          vazio="Nenhum ciclo ativo. Um sócio precisa criar o ciclo em Mais → Produção própria."
        />
      </Estrutura>
    );
  }

  const valido = !!produtoAtual && quantidade !== null && quantidade > 0;
  return (
    <Estrutura titulo="Colheita" voltar="/producao/">
      <Cartao className="flex items-center justify-between">
        <div>
          <div className="text-sm text-suave">Ciclo</div>
          <div className="font-semibold">{nomeCiclo(ciclo)}</div>
        </div>
        {!params.get("ciclo") ? (
          <button type="button" className="font-semibold text-serra underline" onClick={() => setCicloId(null)}>
            Trocar
          </button>
        ) : null}
      </Cartao>

      {itens.length ? (
        <Cartao className="space-y-1">
          {itens.map((i, n) => (
            <div key={n} className="flex justify-between">
              <span>
                {formatarNumero(i.quantidade)} {unidade(i.produto_id)} {String(mapaProdutos?.get(i.produto_id)?.nome ?? "")}{" "}
                {String(classes?.find((c) => c.id === i.classificacao_id)?.nome ?? "")}
              </span>
              <button type="button" className="text-sm text-morango" onClick={() => setItens(itens.filter((_, k) => k !== n))}>
                remover
              </button>
            </div>
          ))}
        </Cartao>
      ) : null}

      <Cartao className="space-y-4">
        <Rotulo texto="Produto">
          <select className={classeEntrada} value={produtoAtual ?? ""} onChange={(e) => setProdutoId(e.target.value || null)}>
            {[...(produtos ?? [])].sort(ordenarPorNome).map((p) => (
              <option key={p.id} value={p.id}>{String(p.nome)} ({String(p.unidade)})</option>
            ))}
          </select>
        </Rotulo>
        {classes?.length ? (
          <Rotulo grupo texto="Classificação">
            <Opcoes
              colunas={3}
              opcoes={[...[...classes].sort((a, b) => Number(a.ordem) - Number(b.ordem)).map((c) => ({ valor: c.id as string | null, rotulo: String(c.nome) })), { valor: null, rotulo: "Sem" }]}
              valor={classe}
              aoMudar={setClasse}
            />
          </Rotulo>
        ) : null}
        <Rotulo texto="Quantidade colhida">
          <EntradaNumero valor={quantidade} aoMudar={setQuantidade} sufixo={produtoAtual ? unidade(produtoAtual) : ""} />
        </Rotulo>
        <Botao
          variante={itens.length ? "secundario" : "primario"}
          disabled={!valido}
          onClick={() => {
            setItens([...itens, { produto_id: produtoAtual!, classificacao_id: classe, quantidade: quantidade! }]);
            setQuantidade(null);
          }}
        >
          Adicionar
        </Botao>
      </Cartao>

      <Rotulo texto="Data da colheita">
        <input type="date" className={classeEntrada} value={data} max={hoje()} onChange={(e) => setData(e.target.value || hoje())} />
      </Rotulo>

      {itens.length ? (
        <Botao
          onClick={async () => {
            // Custo = despesas do ciclo ÷ kg colhidos, contando esta colheita.
            const [d] = await carregarCiclos([ciclo.id]);
            const mapa = new Map((await db.t("produtos").toArray()).map((p) => [p.id, p]));
            const resumo = resumirCiclo(d?.despesas ?? [], [...(d?.itens ?? []), ...itens], mapa);
            await salvarVarios(
              montarColheita({
                data,
                ciclo_id: ciclo.id,
                observacao: null,
                itens,
                custoUnitario: (id) => custoUnitarioColheita(resumo, mapa.get(id)),
              }),
            );
            setSalva(
              `${itens.length} item(ns) · custo atual ${resumo.custoPorKg === null ? "sem kg" : `${formatarMoeda(resumo.custoPorKg)}/kg`}`,
            );
          }}
        >
          Salvar colheita
        </Botao>
      ) : null}
    </Estrutura>
  );
}
