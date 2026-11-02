import { notFound } from "next/navigation";
import { CADASTROS } from "@/lib/cadastros";
import { PaginaCadastro } from "./PaginaCadastro";

export function generateStaticParams() {
  return CADASTROS.map((c) => ({ rota: c.rota }));
}

export default async function Pagina({ params }: { params: Promise<{ rota: string }> }) {
  const { rota } = await params;
  if (!CADASTROS.some((c) => c.rota === rota)) notFound();
  return <PaginaCadastro rota={rota} />;
}
