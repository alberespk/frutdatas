"use client";
import Link from "next/link";
import { Estrutura } from "@/components/Estrutura";
import { useSessao } from "@/lib/sessao";

const LANCAMENTOS = [
  { rotulo: "Compra", icone: "🧺", href: "/compras/nova/", campo: true },
  { rotulo: "Colheita", icone: "🍓", href: "/producao/colheita/", campo: true },
  { rotulo: "Despesa", icone: "⛽", href: "/despesas/nova/", campo: true },
  { rotulo: "Venda", icone: "🧾", href: "/vendas/nova/", campo: false },
  { rotulo: "Perda", icone: "🗑️", href: "/estoque/perda/", campo: true },
  { rotulo: "Pagamento", icone: "💸", href: "/financeiro/?aba=pagar", campo: false },
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
            </>
          );
          const classe =
            "flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border-2 bg-white text-center";
          return (
            <Link key={l.rotulo} href={l.href} className={`${classe} border-serra active:bg-fundo`}>
              {conteudo}
            </Link>
          );
        })}
      </div>
    </Estrutura>
  );
}
