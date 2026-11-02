"use client";
// Login e perfil do usuário. O perfil fica guardado no celular para o app
// continuar funcionando sem internet depois do primeiro login.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { db, gravarMeta, lerMeta } from "./db";
import { gravar, gravarVarios } from "./repo";
import { definirPapel, agendarSync, iniciarSincronizador, sincronizar } from "./sincronizador";
import { supabase } from "./supabase";
import type { NomeTabela, Registro } from "./tabelas";

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: "socio" | "campo";
  letra: string | null;
}

interface Sessao {
  carregando: boolean;
  perfil: Perfil | null;
  ehSocio: boolean;
  entrar(email: string, senha: string): Promise<string | null>;
  sair(forcar?: boolean): Promise<{ pendentes: number } | null>;
  salvar(tabela: NomeTabela, dados: Partial<Registro>): Promise<Registro>;
  salvarVarios(itens: { tabela: NomeTabela; dados: Partial<Registro> }[]): Promise<Registro[]>;
}

const Contexto = createContext<Sessao | null>(null);
const CHAVE_PERFIL = "perfil";

async function buscarPerfil(id: string, email: string): Promise<Perfil | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("usuarios").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return { id, nome: data.nome, email, papel: data.papel, letra: data.letra };
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const aplicarPerfil = useCallback(async (p: Perfil | null) => {
    setPerfil(p);
    if (p) {
      definirPapel(p.papel);
      await gravarMeta(CHAVE_PERFIL, p);
      void iniciarSincronizador();
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const salvo = await lerMeta<Perfil>(CHAVE_PERFIL);
      if (!ativo) return;
      if (salvo) await aplicarPerfil(salvo);
      setCarregando(false);
      // Com internet, confirma o perfil no servidor (pode ter mudado de papel).
      if (salvo && supabase && navigator.onLine) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const atual = await buscarPerfil(salvo.id, salvo.email);
          if (atual && ativo) await aplicarPerfil(atual);
        }
      }
    })();
    return () => {
      ativo = false;
    };
  }, [aplicarPerfil]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      if (!supabase) return "O sistema ainda não foi configurado (falta o arquivo .env.local).";
      if (!navigator.onLine) return "O primeiro login precisa de internet.";
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error || !data.user) return "E-mail ou senha incorretos.";
      const p = await buscarPerfil(data.user.id, email);
      if (!p) return "Usuário sem cadastro no sistema. Fale com um dos sócios.";
      const anterior = await lerMeta<Perfil>(CHAVE_PERFIL);
      if (anterior && anterior.id !== p.id) {
        // Outro usuário neste celular: começa com o banco local limpo.
        await Promise.all(db.tables.map((t) => t.clear()));
      }
      await aplicarPerfil(p);
      void sincronizar();
      return null;
    },
    [aplicarPerfil],
  );

  const sair = useCallback(async (forcar = false) => {
    await sincronizar();
    const pendentes = await db.fila.count();
    if (pendentes > 0 && !forcar) return { pendentes };
    await supabase?.auth.signOut();
    await Promise.all(db.tables.map((t) => t.clear()));
    setPerfil(null);
    return null;
  }, []);

  const salvar = useCallback(
    async (tabela: NomeTabela, dados: Partial<Registro>) => {
      const r = await gravar(db, tabela, dados, perfil?.id ?? null);
      agendarSync();
      return r;
    },
    [perfil],
  );

  const salvarVarios = useCallback(
    async (itens: { tabela: NomeTabela; dados: Partial<Registro> }[]) => {
      const r = await gravarVarios(db, itens, perfil?.id ?? null);
      agendarSync();
      return r;
    },
    [perfil],
  );

  return (
    <Contexto.Provider
      value={{ carregando, perfil, ehSocio: perfil?.papel === "socio", entrar, sair, salvar, salvarVarios }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useSessao(): Sessao {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSessao fora do ProvedorSessao");
  return s;
}
