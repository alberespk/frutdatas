"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import type { Campo } from "@/lib/cadastros";
import { db } from "@/lib/db";
import { lerNumero, mascararCpfCnpj, mascararTelefone, numeroParaCampo } from "@/lib/formato";
import { classeEntrada, Rotulo } from "./ui";

/** Um campo do formulário. Números são digitados no padrão brasileiro (vírgula). */
export function CampoFormulario({
  campo,
  valor,
  aoMudar,
  erro,
  somenteLeitura,
}: {
  campo: Campo;
  valor: unknown;
  aoMudar: (v: unknown) => void;
  erro?: string;
  somenteLeitura?: boolean;
}) {
  const props = { disabled: somenteLeitura, className: classeEntrada };
  let entrada;

  switch (campo.tipo) {
    case "opcoes":
      entrada = (
        <div className="grid gap-2">
          {campo.opcoes!.map((o) => (
            <button
              key={o.valor}
              type="button"
              disabled={somenteLeitura}
              onClick={() => aoMudar(o.valor)}
              className={`min-h-14 rounded-xl border-2 px-4 text-left font-semibold ${
                valor === o.valor ? "border-serra bg-serra/10 text-serra" : "border-borda bg-white"
              }`}
            >
              {valor === o.valor ? "● " : "○ "}
              {o.rotulo}
            </button>
          ))}
        </div>
      );
      break;
    case "referencia":
      entrada = <Referencia campo={campo} valor={valor} aoMudar={aoMudar} somenteLeitura={somenteLeitura} />;
      break;
    case "textoLongo":
      entrada = (
        <textarea {...props} rows={3} value={(valor as string) ?? ""} onChange={(e) => aoMudar(e.target.value)} />
      );
      break;
    case "telefone":
      entrada = (
        <input
          {...props}
          type="tel"
          inputMode="tel"
          value={(valor as string) ?? ""}
          onChange={(e) => aoMudar(mascararTelefone(e.target.value))}
          placeholder="(38) 99999-9999"
        />
      );
      break;
    case "cpfcnpj":
      entrada = (
        <input
          {...props}
          inputMode="numeric"
          value={(valor as string) ?? ""}
          onChange={(e) => aoMudar(mascararCpfCnpj(e.target.value))}
        />
      );
      break;
    case "data":
      entrada = (
        <input {...props} type="date" value={(valor as string) ?? ""} onChange={(e) => aoMudar(e.target.value)} />
      );
      break;
    case "inteiro":
    case "decimal":
    case "dinheiro":
      entrada = <CampoNumero campo={campo} valor={valor} aoMudar={aoMudar} somenteLeitura={somenteLeitura} />;
      break;
    default:
      entrada = <input {...props} value={(valor as string) ?? ""} onChange={(e) => aoMudar(e.target.value)} />;
  }

  return (
    <Rotulo texto={campo.rotulo} obrigatorio={campo.obrigatorio} ajuda={campo.ajuda} erro={erro}>
      {entrada}
    </Rotulo>
  );
}

function CampoNumero({ campo, valor, aoMudar, somenteLeitura }: {
  campo: Campo;
  valor: unknown;
  aoMudar: (v: unknown) => void;
  somenteLeitura?: boolean;
}) {
  // Guarda o texto digitado para não "brigar" com a vírgula enquanto a pessoa digita.
  const [texto, setTexto] = useState(() =>
    numeroParaCampo(valor as number, campo.tipo === "dinheiro" && valor != null ? 2 : undefined),
  );
  return (
    <div className="relative">
      {campo.tipo === "dinheiro" ? (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-suave">R$</span>
      ) : null}
      <input
        disabled={somenteLeitura}
        className={`${classeEntrada} ${campo.tipo === "dinheiro" ? "pl-12" : ""}`}
        inputMode={campo.tipo === "inteiro" ? "numeric" : "decimal"}
        value={texto}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, "");
          setTexto(t);
          aoMudar(t.trim() === "" ? null : (lerNumero(t) ?? Number.NaN));
        }}
      />
    </div>
  );
}

function Referencia({ campo, valor, aoMudar, somenteLeitura }: {
  campo: Campo;
  valor: unknown;
  aoMudar: (v: unknown) => void;
  somenteLeitura?: boolean;
}) {
  const opcoes = useLiveQuery(
    () => db.t(campo.referencia!).filter((r) => !r.cancelado_em).toArray(),
    [campo.referencia],
  );
  return (
    <select
      disabled={somenteLeitura}
      className={classeEntrada}
      value={(valor as string) ?? ""}
      onChange={(e) => aoMudar(e.target.value || null)}
    >
      <option value="">— nenhum —</option>
      {(opcoes ?? []).map((o) => (
        <option key={o.id} value={o.id}>
          {String(o.nome ?? o.id)}
        </option>
      ))}
    </select>
  );
}
