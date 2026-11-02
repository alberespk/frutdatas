"use client";
// Serviço de sincronização do navegador: roda ao abrir o app, a cada minuto,
// quando a internet volta e logo depois de cada lançamento.
import { db, gravarMeta, lerMeta } from "./db";
import { supabase } from "./supabase";
import { sincronizarCom, type ClienteSync } from "./sync";
import { SO_SOCIO, TABELAS } from "./tabelas";

export type EstadoSync = "ocioso" | "sincronizando" | "offline" | "erro";

export interface StatusSync {
  estado: EstadoSync;
  pendentes: number;
  ultima?: string;
  erro?: string;
}

type Ouvinte = (s: StatusSync) => void;
const ouvintes = new Set<Ouvinte>();
let status: StatusSync = { estado: "ocioso", pendentes: 0 };
let emAndamento: Promise<void> | null = null;
let papel: "socio" | "campo" = "campo";
let agendado: ReturnType<typeof setTimeout> | null = null;

function publicar(parcial: Partial<StatusSync>) {
  status = { ...status, ...parcial };
  for (const o of ouvintes) o(status);
}

export function ouvirSync(o: Ouvinte): () => void {
  ouvintes.add(o);
  o(status);
  return () => ouvintes.delete(o);
}

export async function contarPendentes() {
  const pendentes = await db.fila.count();
  publicar({ pendentes });
  return pendentes;
}

export function definirPapel(p: "socio" | "campo") {
  papel = p;
}

export function sincronizar(): Promise<void> {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    try {
      if (!supabase) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        publicar({ estado: "offline" });
        await contarPendentes();
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        publicar({ estado: "offline" });
        return;
      }
      publicar({ estado: "sincronizando", erro: undefined });
      const tabelas = papel === "socio" ? TABELAS : TABELAS.filter((t) => !SO_SOCIO.includes(t));
      await sincronizarCom(db, supabase as unknown as ClienteSync, tabelas);
      const ultima = new Date().toISOString();
      await gravarMeta("ultima_sync", ultima);
      publicar({ estado: "ocioso", ultima });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const semRede = /fetch|network|Failed/i.test(msg);
      publicar({ estado: semRede ? "offline" : "erro", erro: semRede ? undefined : msg });
    } finally {
      await contarPendentes();
      emAndamento = null;
    }
  })();
  return emAndamento;
}

/** Pede uma sincronização daqui a pouco (junta vários lançamentos seguidos). */
export function agendarSync(ms = 1500) {
  if (agendado) clearTimeout(agendado);
  agendado = setTimeout(() => {
    agendado = null;
    void sincronizar();
  }, ms);
  void contarPendentes();
}

let iniciado = false;
export async function iniciarSincronizador() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  publicar({ ultima: await lerMeta<string>("ultima_sync") });
  window.addEventListener("online", () => void sincronizar());
  window.addEventListener("offline", () => publicar({ estado: "offline" }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void sincronizar();
  });
  setInterval(() => void sincronizar(), 60_000);
  void sincronizar();
}
