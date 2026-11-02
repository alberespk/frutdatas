"use client";
import Link from "next/link";
import { Estrutura } from "@/components/Estrutura";
import { useSessao } from "@/lib/sessao";

const LANCAMENTOS = [
  { rotulo: "Compra", icone: "🧺", href: "/compras/nova/", campo: true },
  { rotulo: "Colheita", icone: "🍓", href: "/producao/colheita/", campo: true },
  { rotulo: "Despesa", icone: "⛽", href: "/despesas/nova/", campo: true },
  { rotulo: "Venda", icone: "🧾", etapa: 4, campo: false },
  { rotulo: "Perda", icone: "🗑️", etapa: 3, campo: true },
  { rotulo: "Pagamento", icone: "💸", etapa: 6, campo: false },
];

export default function Lancar() {
  const { ehSocio } = useSessao();
  return (
    <Estrutura titulo="Lançar">
      <div className="grid grid-cols-2 gap-3">
        {LANCAMENTOS.filter((l) => ehSocio || l.campo).map((l) => {
          const conteudo = (
            <>
              <span className="text-5xl">{l.icone}</span>
              <span className="font-marca text-2xl font-bold">{l.rotulo}</span>
              {l.etapa ? <span className="rounded-full bg-maracuja/20 px-2 text-xs font-semibold">Etapa {l.etapa}</span> : null}
            </>
          );
          const classe =
            "flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border-2 bg-white text-center";
          return l.href ? (
            <Link key={l.rotulo} href={l.href} className={`${classe} border-serra active:bg-fundo`}>
              {conteudo}
            </Link>
          ) : (
            <div key={l.rotulo} className={`${classe} border-borda opacity-60`}>
              {conteudo}
            </div>
          );
        })}
      </div>
    </Estrutura>
  );
}
