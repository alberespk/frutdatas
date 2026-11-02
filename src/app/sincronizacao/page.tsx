"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { textoStatus, useStatusSync } from "@/components/StatusSync";
import { Botao, Cartao } from "@/components/ui";
import { db } from "@/lib/db";
import { formatarDataHora } from "@/lib/formato";
import { sincronizar } from "@/lib/sincronizador";

const NOMES: Record<string, string> = {
  fornecedores: "Fornecedores",
  clientes: "Clientes",
  produtos: "Produtos",
  usuarios: "Usuários",
};

export default function Sincronizacao() {
  const s = useStatusSync();
  const [rodando, setRodando] = useState(false);
  const fila = useLiveQuery(() => db.fila.orderBy("seq").reverse().limit(50).toArray(), []);

  return (
    <Estrutura titulo="Sincronização" voltar="/mais/">
      <Cartao className="space-y-1">
        <div className="font-marca text-xl font-bold">{textoStatus(s).texto}</div>
        <div className="text-suave">
          {s.ultima ? `Última sincronização: ${formatarDataHora(s.ultima)}` : "Ainda não sincronizou neste aparelho."}
        </div>
        {s.erro ? <div className="pt-2 text-sm font-semibold text-morango">Detalhe: {s.erro}</div> : null}
      </Cartao>

      <Botao
        disabled={rodando}
        onClick={async () => {
          setRodando(true);
          await sincronizar();
          setRodando(false);
        }}
      >
        {rodando ? "Sincronizando…" : "Sincronizar agora"}
      </Botao>

      <Cartao className="space-y-2">
        <div className="font-semibold">Aguardando envio ({fila?.length ?? 0})</div>
        {fila?.length ? (
          <ul className="space-y-1 text-sm text-suave">
            {fila.map((f) => (
              <li key={f.seq}>
                {formatarDataHora(f.em)} · {NOMES[f.tabela] ?? f.tabela.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-suave">Tudo enviado.</div>
        )}
      </Cartao>

      <Cartao className="space-y-2 text-sm">
        <div className="font-semibold">Instalar o app no celular</div>
        <p className="text-suave">
          <strong>Android (Chrome):</strong> menu ⋮ → “Adicionar à tela inicial” ou “Instalar app”.
        </p>
        <p className="text-suave">
          <strong>iPhone (Safari):</strong> botão Compartilhar → “Adicionar à Tela de Início”.
        </p>
        <p className="text-suave">
          Depois de instalado e com o primeiro login feito, o FrutDatas abre e grava lançamentos sem internet. Tudo
          sobe sozinho quando o sinal voltar.
        </p>
      </Cartao>
    </Estrutura>
  );
}
