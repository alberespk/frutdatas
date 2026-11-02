"use client";
import { Estrutura } from "@/components/Estrutura";
import { EmBreve } from "@/components/ui";

export default function Financeiro() {
  return (
    <Estrutura titulo="Financeiro" apenasSocio>
      <EmBreve
        etapa={6}
        titulo="Financeiro"
        itens={[
          "Contas a pagar e a receber por pessoa",
          "Quitar várias contas de uma vez, total ou parcial",
          "Fluxo de caixa e saldo",
          "Margem por produto, cliente e viagem",
          "Exportar para Excel e PDF",
        ]}
      />
    </Estrutura>
  );
}
