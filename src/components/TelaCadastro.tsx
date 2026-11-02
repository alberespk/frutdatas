"use client";
// Lista + formulário de qualquer cadastro (produtores, clientes, produtos…).
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { validar, type Cadastro } from "@/lib/cadastros";
import { db } from "@/lib/db";
import { linkWhatsApp, normalizar } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import type { NomeTabela, Registro } from "@/lib/tabelas";
import { CampoFormulario } from "./CampoFormulario";
import { Botao, Cartao, ItemLista, Vazio, classeEntrada } from "./ui";

export function TelaCadastro({ cadastro }: { cadastro: Cadastro }) {
  const { ehSocio } = useSessao();
  const [editando, setEditando] = useState<Partial<Registro> | null>(null);
  const [busca, setBusca] = useState("");
  const [verInativos, setVerInativos] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const registros = useLiveQuery(
    () => db.t(cadastro.tabela).filter((r) => !r.cancelado_em).toArray(),
    [cadastro.tabela],
  );
  const usuarios = useLiveQuery(() => db.t("usuarios").toArray(), []);

  const nomes = (tabela: NomeTabela, id: unknown) =>
    tabela === "usuarios" ? String(usuarios?.find((u) => u.id === id)?.nome ?? "") : "";

  const lista = useMemo(() => {
    const termo = normalizar(busca);
    return (registros ?? [])
      .filter((r) => verInativos || r.ativo !== false)
      .filter(
        (r) =>
          !termo ||
          normalizar(`${cadastro.titulo_item(r)} ${cadastro.detalhe(r, nomes)}`).includes(termo),
      )
      .sort(cadastro.ordenar ?? (() => 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, busca, verInativos, cadastro, usuarios]);

  if (editando) {
    return (
      <Formulario
        cadastro={cadastro}
        inicial={editando}
        aoFechar={(msg) => {
          setEditando(null);
          setAviso(msg ?? null);
        }}
      />
    );
  }

  const novo = () => {
    const padrao: Partial<Registro> = { ativo: true };
    for (const c of cadastro.campos) if (c.padrao !== undefined) padrao[c.nome] = c.padrao;
    setEditando(padrao);
  };

  return (
    <div className="space-y-4">
      {aviso ? (
        <div className="rounded-xl bg-folha/25 px-4 py-3 font-semibold text-serra" role="status">
          {aviso}
        </div>
      ) : null}
      {ehSocio ? <Botao onClick={novo}>+ Novo {cadastro.singular}</Botao> : null}
      <input
        className={classeEntrada}
        placeholder="Buscar…"
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      {registros === undefined ? (
        <Vazio>Carregando…</Vazio>
      ) : lista.length === 0 ? (
        <Vazio>{busca ? "Nada encontrado." : `Nenhum ${cadastro.singular} cadastrado ainda.`}</Vazio>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-borda">
          {lista.map((r) => (
            <ItemLista
              key={r.id}
              onClick={() => setEditando(r)}
              titulo={cadastro.titulo_item(r)}
              detalhe={cadastro.detalhe(r, nomes)}
              apagado={r.ativo === false}
            />
          ))}
        </div>
      )}
      <label className="flex items-center gap-3 px-1 text-suave">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={verInativos}
          onChange={(e) => setVerInativos(e.target.checked)}
        />
        Mostrar desativados
      </label>
      <p className="px-1 text-sm text-suave">{lista.length} registro(s)</p>
    </div>
  );
}

function Formulario({
  cadastro,
  inicial,
  aoFechar,
}: {
  cadastro: Cadastro;
  inicial: Partial<Registro>;
  aoFechar: (mensagem?: string) => void;
}) {
  const { salvar, ehSocio } = useSessao();
  const [valores, setValores] = useState<Record<string, unknown>>(inicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const novo = !inicial.id;
  const somenteLeitura = !ehSocio;
  const zap = linkWhatsApp(valores.telefone as string);

  const gravar = async (extra: Partial<Registro> = {}, mensagem?: string) => {
    const e = validar(cadastro, valores);
    setErros(e);
    if (Object.keys(e).length) return;
    setSalvando(true);
    try {
      const dados: Partial<Registro> = {};
      for (const c of cadastro.campos) {
        const v = valores[c.nome];
        dados[c.nome] = c.mostrarSe && !c.mostrarSe(valores) ? null : typeof v === "string" ? v.trim() || null : v ?? null;
      }
      if (cadastro.tabela === "veiculos" && dados.placa) dados.placa = String(dados.placa).toUpperCase();
      await salvar(cadastro.tabela, { ...dados, id: inicial.id, ativo: valores.ativo ?? true, ...extra });
      aoFechar(mensagem ?? (novo ? "Cadastrado com sucesso." : "Alterações salvas."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void gravar();
      }}
    >
      <Cartao className="space-y-5">
        <h2 className="font-marca text-xl font-bold">
          {novo ? `Novo ${cadastro.singular}` : cadastro.titulo_item(inicial as Registro)}
        </h2>
        {cadastro.campos
          .filter((c) => !c.mostrarSe || c.mostrarSe(valores))
          .map((c) => (
            <CampoFormulario
              key={c.nome}
              campo={c}
              valor={valores[c.nome]}
              erro={erros[c.nome]}
              somenteLeitura={somenteLeitura}
              aoMudar={(v) => setValores((atual) => ({ ...atual, [c.nome]: v }))}
            />
          ))}
        {zap ? (
          <a href={zap} target="_blank" rel="noreferrer" className="block font-semibold text-serra underline">
            Abrir conversa no WhatsApp
          </a>
        ) : null}
      </Cartao>

      {somenteLeitura ? null : (
        <Botao type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Botao>
      )}
      <Botao type="button" variante="secundario" onClick={() => aoFechar()}>
        Voltar
      </Botao>
      {!novo && !somenteLeitura ? (
        inicial.ativo === false ? (
          <Botao type="button" variante="fantasma" onClick={() => gravar({ ativo: true }, "Reativado.")}>
            Reativar
          </Botao>
        ) : (
          <Botao
            type="button"
            variante="perigo"
            onClick={() => {
              if (confirm(`Desativar este ${cadastro.singular}? Ele some das listas, mas o histórico fica.`))
                void gravar({ ativo: false }, "Desativado.");
            }}
          >
            Desativar
          </Botao>
        )
      ) : null}
    </form>
  );
}
