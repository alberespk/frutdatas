"use client";
import { useState } from "react";
import { formatarMoeda, hoje } from "@/lib/formato";
import { arred2, montarPagamento, totalPago, type FormaPagamento } from "@/lib/lancamentos";
import { useSessao } from "@/lib/sessao";
import type { Registro } from "@/lib/tabelas";
import { EntradaNumero, Opcoes } from "./lancamento";
import { Botao, Cartao, classeEntrada, Rotulo } from "./ui";

/** Registrar pagamento (total ou parcial) de uma conta. */
export function PagarTitulo({ titulo, baixas, aoFechar }: { titulo: Registro; baixas: Registro[]; aoFechar: () => void }) {
  const { salvarVarios } = useSessao();
  const restante = arred2(Number(titulo.valor) - totalPago(titulo, baixas));
  const [valor, setValor] = useState<number | null>(restante);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [data, setData] = useState(hoje());
  const valido = valor !== null && valor > 0 && valor <= restante + 0.005;
  const receber = titulo.tipo === "receber";

  return (
    <Cartao className="space-y-4">
      <h3 className="font-marca text-lg font-bold">{receber ? "Registrar recebimento" : "Registrar pagamento"}</h3>
      <div className="text-sm text-suave">Falta {formatarMoeda(restante)}. Pode lançar um valor menor (pagamento parcial).</div>
      <Rotulo texto="Valor">
        <EntradaNumero valor={valor} aoMudar={setValor} dinheiro />
      </Rotulo>
      <Rotulo grupo texto="Forma">
        <Opcoes
          colunas={3}
          opcoes={[
            { valor: "pix", rotulo: "Pix" },
            { valor: "dinheiro", rotulo: "Dinheiro" },
            { valor: "outro", rotulo: "Outro" },
          ]}
          valor={forma}
          aoMudar={setForma}
        />
      </Rotulo>
      <Rotulo texto="Data">
        <input type="date" className={classeEntrada} value={data} onChange={(e) => setData(e.target.value || hoje())} />
      </Rotulo>
      {valor !== null && valor > restante + 0.005 ? (
        <p className="font-semibold text-morango">O valor é maior que o que falta.</p>
      ) : null}
      <Botao
        disabled={!valido}
        onClick={async () => {
          await salvarVarios(montarPagamento({ titulo, valor: valor!, forma, data }));
          aoFechar();
        }}
      >
        Confirmar {valor ? formatarMoeda(valor) : ""}
      </Botao>
      <Botao variante="fantasma" onClick={aoFechar}>
        Cancelar
      </Botao>
    </Cartao>
  );
}
