// Gera out/sw.js com a lista de todos os arquivos do app para uso offline.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { join, relative, sep } from "node:path";

const saida = "out";
const arquivos = [];
const hash = createHash("sha256");

function percorrer(pasta) {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) percorrer(caminho);
    else {
      const rel = "/" + relative(saida, caminho).split(sep).join("/");
      if (rel === "/sw.js" || rel === "/sw.template.js" || rel.endsWith(".txt")) continue;
      arquivos.push(rel);
      hash.update(rel).update(readFileSync(caminho));
    }
  }
}

percorrer(saida);
arquivos.sort();
// Páginas também pelo endereço com barra (/cadastros/), além do index.html.
const paginas = arquivos.filter((a) => a.endsWith("/index.html")).map((a) => a.replace(/index\.html$/, ""));
const lista = [...new Set([...paginas, ...arquivos])];

const modelo = readFileSync(join(saida, "sw.template.js"), "utf8");
const sw = modelo
  .replace("__VERSAO__", hash.digest("hex").slice(0, 12))
  .replace("__ARQUIVOS__", JSON.stringify(lista, null, 0));
writeFileSync(join(saida, "sw.js"), sw);
rmSync(join(saida, "sw.template.js"));
console.log(`sw.js gerado com ${lista.length} arquivos para uso offline.`);
