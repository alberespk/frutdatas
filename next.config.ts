import type { NextConfig } from "next";

// Exportação estática: o app inteiro vira HTML/JS que o celular guarda
// para funcionar sem internet. Os dados vão direto ao Supabase.
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
