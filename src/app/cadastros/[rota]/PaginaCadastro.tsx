"use client";
import { Estrutura } from "@/components/Estrutura";
import { TelaCadastro } from "@/components/TelaCadastro";
import { acharCadastro } from "@/lib/cadastros";
import { useSessao } from "@/lib/sessao";

export function PaginaCadastro({ rota }: { rota: string }) {
  const cadastro = acharCadastro(rota)!;
  const { ehSocio } = useSessao();
  // O perfil "campo" só consulta produtores e produtos.
  const liberado = ehSocio || rota === "fornecedores" || rota === "produtos";
  return (
    <Estrutura titulo={cadastro.titulo} voltar={ehSocio ? "/cadastros/" : "/"} apenasSocio={!liberado}>
      <TelaCadastro key={rota} cadastro={cadastro} />
    </Estrutura>
  );
}
