"use client";
import { useEffect } from "react";

/** Instala o service worker que guarda o app no celular para abrir sem internet. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
