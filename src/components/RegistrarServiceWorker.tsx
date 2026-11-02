"use client";
import { useEffect } from "react";
import { escutarInstalacao } from "@/lib/instalar";

/** Instala o service worker que guarda o app no celular para abrir sem internet. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    escutarInstalacao();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
