"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Estrutura } from "@/components/Estrutura";
import { Botao, Cartao, classeEntrada, ItemLista, Rotulo, Vazio } from "@/components/ui";
import { db } from "@/lib/db";
import { useSessao } from "@/lib/sessao";
import type { Registro } from "@/lib/tabelas";

export default function Usuarios() {
  const usuarios = useLiveQuery(() => db.t("usuarios").toArray(), []);
  const [editando, setEditando] = useState<Registro | null>(null);

  return (
    <Estrutura titulo="Usuários" voltar="/mais/" apenasSocio>
      {editando ? (
        <EditarUsuario usuario={editando} lista={usuarios ?? []} aoFechar={() => setEditando(null)} />
      ) : (
        <>
          {!usuarios?.length ? (
            <Vazio>Nenhum usuário sincronizado ainda.</Vazio>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-borda">
              {[...usuarios]
                .sort((a, b) => String(a.letra).localeCompare(String(b.letra)))
                .map((u) => (
                  <ItemLista
                    key={u.id}
                    onClick={() => setEditando(u)}
                    titulo={String(u.nome)}
                    detalhe={`${u.papel === "socio" ? "Sócio" : "Campo"} · romaneio ${u.letra ?? "-"} · ${u.email ?? ""}`}
                    apagado={u.ativo === false}
                  />
                ))}
            </div>
          )}
          <Cartao className="space-y-2 text-sm">
            <div className="font-semibold">Como cadastrar um novo usuário</div>
            <ol className="list-decimal space-y-1 pl-5 text-suave">
              <li>No site do Supabase, abra o projeto frutdatas.</li>
              <li>Vá em Authentication → Users → Add user → Create new user.</li>
              <li>Informe e-mail e senha e marque “Auto Confirm User”.</li>
              <li>Ele aparece aqui como “Campo”. Toque nele para mudar o nome ou torná-lo sócio.</li>
            </ol>
          </Cartao>
        </>
      )}
    </Estrutura>
  );
}

function EditarUsuario({ usuario, lista, aoFechar }: { usuario: Registro; lista: Registro[]; aoFechar: () => void }) {
  const { salvar, perfil } = useSessao();
  const [nome, setNome] = useState(String(usuario.nome ?? ""));
  const [papel, setPapel] = useState(String(usuario.papel));
  const [letra, setLetra] = useState(String(usuario.letra ?? ""));
  const [ativo, setAtivo] = useState(usuario.ativo !== false);
  const [erro, setErro] = useState<string | null>(null);
  const euMesmo = usuario.id === perfil?.id;

  const gravar = async () => {
    const l = letra.trim().toUpperCase();
    if (!nome.trim()) return setErro("Informe o nome.");
    if (!/^[A-Z]{1,2}$/.test(l)) return setErro("A letra do romaneio deve ter 1 ou 2 letras.");
    if (lista.some((u) => u.id !== usuario.id && u.letra === l)) return setErro("Essa letra já é de outro usuário.");
    await salvar("usuarios", { id: usuario.id, nome: nome.trim(), papel, letra: l, ativo });
    aoFechar();
  };

  return (
    <div className="space-y-4">
      <Cartao className="space-y-5">
        <div className="text-sm text-suave">{String(usuario.email ?? "")}</div>
        <Rotulo texto="Nome" obrigatorio>
          <input className={classeEntrada} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Rotulo>
        <Rotulo grupo texto="Perfil" ajuda="Campo lança compras, colheitas, perdas e despesas de viagem; não vê vendas nem financeiro.">
          <div className="grid grid-cols-2 gap-2">
            {[
              ["socio", "Sócio"],
              ["campo", "Campo"],
            ].map(([v, r]) => (
              <button
                key={v}
                type="button"
                disabled={euMesmo}
                onClick={() => setPapel(v)}
                className={`min-h-14 rounded-xl border-2 font-semibold ${papel === v ? "border-serra bg-serra/10 text-serra" : "border-borda bg-white"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </Rotulo>
        <Rotulo texto="Letra do romaneio" ajuda="Os romaneios deste usuário saem como A-0001, A-0002…">
          <input className={classeEntrada} maxLength={2} value={letra} onChange={(e) => setLetra(e.target.value.toUpperCase())} />
        </Rotulo>
        {!euMesmo ? (
          <label className="flex items-center gap-3">
            <input type="checkbox" className="h-6 w-6" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Acesso ativo
          </label>
        ) : null}
        {erro ? <p className="font-semibold text-morango">{erro}</p> : null}
      </Cartao>
      <Botao onClick={gravar}>Salvar</Botao>
      <Botao variante="secundario" onClick={aoFechar}>
        Voltar
      </Botao>
    </div>
  );
}
