"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Estrutura } from "@/components/Estrutura";
import { Selo } from "@/components/lancamento";
import { Botao, Vazio } from "@/components/ui";
import { useMapa, useTabela } from "@/lib/consultas";
import { formatarData, formatarMoeda, hoje } from "@/lib/formato";
import { situacaoTitulo } from "@/lib/lancamentos";

export default function Despesas() {
  const despesas = useTabela("despesas");
  const titulos = useTabela("titulos", (t) => t.origem_tabela === "despesas");
  const baixas = useTabela("baixas");
  const categorias = useMapa("categorias_despesa");
  const lista = useMemo(
    () => [...(despesas ?? [])].sort((a, b) => `${b.data}${b.criado_em}`.localeCompare(`${a.data}${a.criado_em}`)),
    [despesas],
  );
  return (
    <Estrutura titulo="Despesas" voltar="/mais/">
      <Link href="/despesas/nova/" className="block">
        <Botao>+ Nova despesa</Botao>
      </Link>
      {!lista.length ? (
        <Vazio>Nenhuma despesa lançada.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borda">
          {lista.map((d) => {
            const t = titulos?.find((x) => x.origem_id === d.id);
            return (
              <div key={d.id} className="flex min-h-16 items-center gap-3 border-b border-borda bg-white px-4 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{String(categorias?.get(String(d.categoria_id))?.nome ?? "")}</div>
                  <div className="truncate text-sm text-suave">
                    {formatarData(String(d.data))} {d.descricao ? `· ${d.descricao}` : ""} {d.favorecido ? `· ${d.favorecido}` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold">{formatarMoeda(Number(d.valor))}</span>
                  {t ? <Selo situacao={situacaoTitulo(t, baixas ?? [], hoje())} /> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Estrutura>
  );
}
