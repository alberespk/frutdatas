import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";
import { ProvedorSessao } from "@/lib/sessao";
import "./globals.css";

export const metadata: Metadata = {
  title: "FrutDatas",
  description: "Gestão de compras, estoque, vendas e viagens da FrutDatas",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icones/icone-192.png", apple: "/icones/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "FrutDatas", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1f5e3b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Guarda o aviso de instalação do navegador antes do app terminar de abrir. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__avisoInstalacao=e;});",
          }}
        />
      </head>
      <body>
        <ProvedorSessao>{children}</ProvedorSessao>
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
