"use client";
import { Estrutura } from "@/components/Estrutura";
import { ItemLista } from "@/components/ui";
import { CADASTROS } from "@/lib/cadastros";

export default function Cadastros() {
  return (
    <Estrutura titulo="Cadastros" voltar="/mais/" apenasSocio>
      <div className="overflow-hidden rounded-2xl border border-borda">
        {CADASTROS.map((c) => (
          <ItemLista key={c.rota} href={`/cadastros/${c.rota}/`} titulo={c.titulo} />
        ))}
      </div>
    </Estrutura>
  );
}
