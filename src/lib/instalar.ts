"use client";
// Instalar o app no celular (atalho na tela inicial).
// O Chrome/Android avisa uma única vez, logo ao abrir, que o app pode ser instalado
// (evento beforeinstallprompt). Guardamos esse aviso para usar quando o usuário tocar em "Instalar app".
import { useEffect, useState } from "react";

interface AvisoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let aviso: AvisoInstalacao | null = null;
let instalado = false;
let escutando = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

/** Chamado uma vez ao abrir o app, para não perder o aviso do navegador. */
export function escutarInstalacao() {
  if (typeof window === "undefined" || escutando) return;
  escutando = true;
  const cedo = (window as Window & { __avisoInstalacao?: AvisoInstalacao }).__avisoInstalacao;
  if (cedo && !aviso) aviso = cedo;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    aviso = e as AvisoInstalacao;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    instalado = true;
    aviso = null;
    avisar();
  });
}

export type ModoInstalacao = "instalado" | "pronto" | "iphone" | "manual";

function modoAtual(): ModoInstalacao {
  if (typeof window === "undefined") return "manual";
  const nav = navigator as Navigator & { standalone?: boolean };
  if (instalado || window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone) return "instalado";
  if (aviso) return "pronto";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iphone";
  return "manual";
}

export function useInstalar() {
  const [modo, setModo] = useState<ModoInstalacao>("manual");
  useEffect(() => {
    const atualizar = () => setModo(modoAtual());
    atualizar();
    ouvintes.add(atualizar);
    return () => {
      ouvintes.delete(atualizar);
    };
  }, []);

  /** Abre a janela de instalação do navegador. Devolve true se o usuário aceitou. */
  const instalar = async () => {
    if (!aviso) return false;
    const a = aviso;
    await a.prompt();
    const { outcome } = await a.userChoice;
    aviso = null;
    if (outcome === "accepted") instalado = true;
    avisar();
    return outcome === "accepted";
  };

  return { modo, instalar };
}
