"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { EntradaNumero, Opcoes } from "@/components/lancamento";
import { Botao, Cartao, classeEntrada, Rotulo } from "@/components/ui";
import { ativos, ordenarPorNome, useEstoque, useTabela } from "@/lib/consultas";
import { chaveEstoque, custoDeSaida } from "@/lib/estoque";
import { formatarMoeda, formatarNumero, hoje } from "@/lib/formato";
import { montarPerda } from "@/lib/lancamentos";
import { useSessao } from "@/lib/sessao";

export default function Pagina() {
  return (
    <Suspense>
      <Perda />
    </Suspense>
  );
}

function Perda() {
  const params = useSearchParams();
  const { salvarVarios, ehSocio } = useSessao();
  const [produtoId, setProdutoId] = useState<string>(params.get("produto") ?? "");
  const [classe, setClasse] = useState<string | null>(params.get("classe") || null);
  const [quantidade, setQuantidade] = useState<number | null>(null);
  const [motivo, setMotivo] = useState<string>("");
  const [obs, setObs] = useState("");
  const [data, setData] = useState(hoje());
  const [salva, setSalva] = useState<string | null>(null);

  const produtos = useTabela("produtos", ativos);
  const classes = useTabela("classificacoes", ativos);
  const motivos = useTabela("motivos_perda", ativos);
  const estoque = useEstoque(hoje());
  const saldo = produtoId ? estoque?.get(chaveEstoque(produtoId, classe)) : undefined;
  const produto = produtos?.find((p) => p.id === produtoId);
  const unidade = String(produto?.unidade ?? "");

  if (salva) {
    return (
      <Estrutura titulo="Perda registrada">
        <Cartao className="space-y-2 text-center">
          <div className="text-5xl">🗑️</div>
          <div className="font-semibold">{salva}</div>
          <div className="text-sm text-suave">Já saiu do estoque.</div>
        </Cartao>
        <Botao onClick={() => { setSalva(null); setQuantidade(null); setObs(""); }}>Lançar outra perda</Botao>
        <Link href={ehSocio ? "/estoque/" : "/"} className="block">
          <Botao variante="secundario">{ehSocio ? "Ver estoque" : "Início"}</Botao>
        </Link>
      </Estrutura>
    );
  }

  const valido = !!produtoId && quantidade !== null && quantidade > 0 && !!motivo;
  return (
    <Estrutura titulo="Perda / descarte" voltar={ehSocio ? "/estoque/" : "/lancar/"}>
      <Cartao className="space-y-5">
        <Rotulo texto="Produto" obrigatorio>
          <select className={classeEntrada} value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
            <option value="">Escolha o produto</option>
            {[...(produtos ?? [])].sort(ordenarPorNome).map((p) => (
              <option key={p.id} value={p.id}>{String(p.nome)}</option>
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
        {ehSocio && saldo ? (
          <div className="rounded-xl bg-fundo px-4 py-3 text-sm">
            Em estoque: <strong>{formatarNumero(saldo.saldo)} {unidade}</strong> · custo médio {formatarMoeda(saldo.custoMedio)}
          </div>
        ) : null}
        <Rotulo texto="Quantidade perdida" obrigatorio>
          <EntradaNumero valor={quantidade} aoMudar={setQuantidade} sufixo={unidade} />
        </Rotulo>
        {ehSocio && saldo && quantidade && quantidade > saldo.saldo ? (
          <p className="text-sm font-semibold text-morango">Maior que o saldo do sistema. Confira a contagem.</p>
        ) : null}
        <Rotulo grupo texto="Motivo" obrigatorio>
          <Opcoes
            opcoes={[...(motivos ?? [])].sort(ordenarPorNome).map((m) => ({ valor: m.id, rotulo: String(m.nome) }))}
            valor={motivo}
            aoMudar={setMotivo}
          />
        </Rotulo>
        <Rotulo texto="Observação">
          <input className={classeEntrada} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Rotulo>
        <Rotulo texto="Data">
          <input type="date" className={classeEntrada} value={data} max={hoje()} onChange={(e) => setData(e.target.value || hoje())} />
        </Rotulo>
        {ehSocio && saldo && quantidade ? (
          <div className="text-right font-semibold">Prejuízo estimado {formatarMoeda(quantidade * custoDeSaida(saldo, quantidade))}</div>
        ) : null}
      </Cartao>
      <Botao
        variante="perigo"
        disabled={!valido}
        onClick={async () => {
          await salvarVarios(
            montarPerda({
              data,
              produto_id: produtoId,
              classificacao_id: classe,
              quantidade: quantidade!,
              custo_unitario: ehSocio && saldo ? custoDeSaida(saldo, quantidade!) : null,
              motivo_perda_id: motivo,
              observacao: obs.trim() || null,
            }),
          );
          setSalva(`${formatarNumero(quantidade!)} ${unidade} de ${String(produto?.nome ?? "")}`);
        }}
      >
        Registrar perda
      </Botao>
    </Estrutura>
  );
}
