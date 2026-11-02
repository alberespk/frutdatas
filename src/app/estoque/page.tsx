"use client";
import { Estrutura } from "@/components/Estrutura";
import { EmBreve } from "@/components/ui";

export default function Estoque() {
  return (
    <Estrutura titulo="Estoque" apenasSocio>
      <EmBreve
        etapa={3}
        titulo="Estoque"
        itens={[
          "Saldo por produto e classificação",
          "Custo médio e dias parado, com alerta",
          "Lançar perda/descarte com motivo",
          "Ajuste de contagem",
        ]}
      />
    </Estrutura>
  );
}
