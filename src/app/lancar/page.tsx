"use client";
import { Estrutura } from "@/components/Estrutura";
import { useSessao } from "@/lib/sessao";

const LANCAMENTOS = [
  { rotulo: "Compra", icone: "🧺", etapa: 2, campo: true },
  { rotulo: "Colheita", icone: "🍓", etapa: 2, campo: true },
  { rotulo: "Venda", icone: "🧾", etapa: 4, campo: false },
  { rotulo: "Despesa", icone: "⛽", etapa: 5, campo: true },
  { rotulo: "Perda", icone: "🗑️", etapa: 3, campo: true },
  { rotulo: "Pagamento", icone: "💸", etapa: 6, campo: false },
];

export default function Lancar() {
  const { ehSocio } = useSessao();
  return (
    <Estrutura titulo="Lançar">
      <div className="grid grid-cols-2 gap-3">
        {LANCAMENTOS.filter((l) => ehSocio || l.campo).map((l) => (
          <button
            key={l.rotulo}
            type="button"
            disabled
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border-2 border-borda bg-white text-center disabled:opacity-70"
          >
            <span className="text-5xl">{l.icone}</span>
            <span className="font-marca text-2xl font-bold">{l.rotulo}</span>
            <span className="rounded-full bg-maracuja/20 px-2 text-xs font-semibold">Etapa {l.etapa}</span>
          </button>
        ))}
      </div>
      <p className="text-center text-sm text-suave">Os lançamentos são liberados a partir da Etapa 2.</p>
    </Estrutura>
  );
}
