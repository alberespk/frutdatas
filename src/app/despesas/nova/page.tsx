"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { EntradaNumero, EscolherPagamento, Opcoes } from "@/components/lancamento";
import { Botao, Cartao, classeEntrada, Rotulo } from "@/components/ui";
import { ativos, ordenarPorNome, useMapa, useTabela } from "@/lib/consultas";
import { formatarData, formatarMoeda, hoje } from "@/lib/formato";
import { montarDespesa, type Pagamento } from "@/lib/lancamentos";
import { useSessao } from "@/lib/sessao";
import type { Registro } from "@/lib/tabelas";

const GRUPOS = [
  { valor: "producao", rotulo: "Produção" },
  { valor: "viagem", rotulo: "Viagem" },
  { valor: "geral", rotulo: "Geral" },
] as const;

export default function Pagina() {
  return (
    <Suspense>
      <NovaDespesa />
    </Suspense>
  );
}

function NovaDespesa() {
  const params = useSearchParams();
  const cicloInicial = params.get("ciclo");
  const viagemInicial = params.get("viagem");
  const { salvarVarios, ehSocio } = useSessao();
  const [grupo, setGrupo] = useState<string>(cicloInicial ? "producao" : viagemInicial || !ehSocio ? "viagem" : "producao");
  const [categoria, setCategoria] = useState<Registro | null>(null);
  const [valor, setValor] = useState<number | null>(null);
  const [data, setData] = useState(hoje());
  const [descricao, setDescricao] = useState("");
  const [favorecido, setFavorecido] = useState("");
  const [cicloId, setCicloId] = useState<string | null>(cicloInicial);
  const [viagemId, setViagemId] = useState<string | null>(viagemInicial);
  const [motoristaId, setMotoristaId] = useState<string | null>(null);
  const [pagamento, setPagamento] = useState<Pagamento>({ tipo: "agora", forma: "dinheiro" });
  const [erro, setErro] = useState<string | null>(null);
  const [salva, setSalva] = useState<string | null>(null);

  const categorias = useTabela("categorias_despesa", (c) => ativos(c) && c.grupo === grupo, [grupo]);
  const ciclos = useTabela("ciclos", (c) => c.situacao === "ativo");
  const viagens = useTabela("viagens", (v) => v.situacao !== "encerrada");
  const motoristas = useTabela("motoristas", ativos);
  const areas = useMapa("areas");
  const produtos = useMapa("produtos");
  const nomeCiclo = (c: Registro) =>
    `${areas?.get(String(c.area_id))?.nome ?? ""} · ${produtos?.get(String(c.produto_id))?.nome ?? ""}`;
  const ehDiaria = /di[aá]ria/i.test(String(categoria?.nome ?? ""));

  if (salva) {
    return (
      <Estrutura titulo="Despesa registrada">
        <Cartao className="space-y-2 text-center">
          <div className="text-5xl">✅</div>
          <div className="font-marca text-2xl font-bold">{salva}</div>
        </Cartao>
        <Botao onClick={() => { setSalva(null); setValor(null); setDescricao(""); setCategoria(null); }}>Nova despesa</Botao>
        <Link href={cicloInicial ? "/producao/" : viagemInicial ? `/viagens/?id=${viagemInicial}` : "/despesas/"} className="block">
          <Botao variante="secundario">{cicloInicial ? "Voltar à produção" : viagemInicial ? "Voltar à viagem" : "Ver despesas"}</Botao>
        </Link>
      </Estrutura>
    );
  }

  return (
    <Estrutura titulo="Nova despesa" voltar={cicloInicial ? "/producao/" : viagemInicial ? `/viagens/?id=${viagemInicial}` : "/lancar/"}>
      <Cartao className="space-y-5">
        <Rotulo grupo texto="Tipo de despesa">
          <Opcoes
            colunas={3}
            opcoes={GRUPOS.map((g) => ({ valor: g.valor as string, rotulo: g.rotulo }))}
            valor={grupo}
            aoMudar={(g) => {
              setGrupo(g);
              setCategoria(null);
            }}
          />
        </Rotulo>
        <Rotulo grupo texto="Categoria" obrigatorio>
          <Opcoes
            opcoes={[...(categorias ?? [])].sort(ordenarPorNome).map((c) => ({ valor: c.id, rotulo: String(c.nome) }))}
            valor={categoria?.id ?? ""}
            aoMudar={(id) => setCategoria(categorias?.find((c) => c.id === id) ?? null)}
          />
        </Rotulo>
        {grupo === "producao" ? (
          <Rotulo texto="Ciclo / talhão" obrigatorio ajuda="A despesa entra no custo por kg deste ciclo.">
            <select className={classeEntrada} value={cicloId ?? ""} onChange={(e) => setCicloId(e.target.value || null)}>
              <option value="">Escolha o ciclo</option>
              {(ciclos ?? []).map((c) => (
                <option key={c.id} value={c.id}>{nomeCiclo(c)}</option>
              ))}
            </select>
          </Rotulo>
        ) : null}
        {grupo === "viagem" && viagens?.length ? (
          <Rotulo texto="Viagem">
            <select className={classeEntrada} value={viagemId ?? ""} onChange={(e) => setViagemId(e.target.value || null)}>
              <option value="">Sem viagem</option>
              {viagens.map((v) => (
                <option key={v.id} value={v.id}>{formatarData(String(v.data_saida))} · {String(v.destino)}</option>
              ))}
            </select>
          </Rotulo>
        ) : null}
        {ehDiaria ? (
          <Rotulo texto="Motorista / ajudante">
            <select
              className={classeEntrada}
              value={motoristaId ?? ""}
              onChange={(e) => {
                const m = motoristas?.find((x) => x.id === e.target.value);
                setMotoristaId(m?.id ?? null);
                if (m) {
                  setFavorecido(String(m.nome));
                  if (m.valor_diaria && valor === null) setValor(Number(m.valor_diaria));
                }
              }}
            >
              <option value="">Escolha</option>
              {(motoristas ?? []).map((m) => (
                <option key={m.id} value={m.id}>{String(m.nome)}</option>
              ))}
            </select>
          </Rotulo>
        ) : null}
        <Rotulo texto="Valor" obrigatorio>
          <EntradaNumero valor={valor} aoMudar={setValor} dinheiro />
        </Rotulo>
        <Rotulo texto="Descrição">
          <input className={classeEntrada} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: 20 sacos de adubo" />
        </Rotulo>
        {!ehDiaria ? (
          <Rotulo texto="Pago a quem">
            <input className={classeEntrada} value={favorecido} onChange={(e) => setFavorecido(e.target.value)} placeholder="Ex.: Agropecuária, posto" />
          </Rotulo>
        ) : null}
        <Rotulo texto="Data">
          <input type="date" className={classeEntrada} value={data} onChange={(e) => setData(e.target.value || hoje())} />
        </Rotulo>
        <Rotulo grupo texto="Pagamento">
          <EscolherPagamento valor={pagamento} aoMudar={setPagamento} data={data} />
        </Rotulo>
        {erro ? <p className="font-semibold text-morango">{erro}</p> : null}
      </Cartao>
      <Botao
        onClick={async () => {
          if (!categoria) return setErro("Escolha a categoria.");
          if (!valor || valor <= 0) return setErro("Informe o valor.");
          if (grupo === "producao" && !cicloId) return setErro("Escolha o ciclo da produção.");
          setErro(null);
          await salvarVarios(
            montarDespesa({
              data,
              categoria,
              descricao: descricao.trim() || null,
              valor,
              favorecido: favorecido.trim() || null,
              motorista_id: ehDiaria ? motoristaId : null,
              viagem_id: grupo === "viagem" ? viagemId : null,
              ciclo_id: grupo === "producao" ? cicloId : null,
              pagamento,
            }),
          );
          setSalva(`${String(categoria.nome)} · ${formatarMoeda(valor)}`);
        }}
      >
        Salvar despesa
      </Botao>
    </Estrutura>
  );
}
