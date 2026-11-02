// Exportar relatórios para Excel (.xlsx) e PDF, gerados no próprio aparelho.
import { formatarData, formatarMoeda, formatarNumero } from "./formato";
import { compartilharArquivo } from "./romaneio-pdf";
import { EMPRESA } from "./vendas";

export type TipoColuna = "texto" | "moeda" | "numero" | "data" | "percentual";

export interface TabelaRelatorio {
  titulo: string;
  colunas: { titulo: string; tipo?: TipoColuna; largura?: number }[];
  linhas: (string | number | null)[][];
  /** Linha final em negrito (ex.: totais). */
  rodape?: (string | number | null)[];
}

function emTexto(v: string | number | null, tipo: TipoColuna = "texto"): string {
  if (v === null || v === undefined || v === "") return "";
  if (tipo === "moeda") return formatarMoeda(Number(v));
  if (tipo === "numero") return formatarNumero(Number(v));
  if (tipo === "percentual") return `${formatarNumero(Math.round(Number(v) * 1000) / 10)}%`;
  if (tipo === "data") return formatarData(String(v));
  return String(v);
}

function dataLocal(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export async function exportarExcel(tabelas: TabelaRelatorio[], nomeArquivo: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const folhas = tabelas.map((t) => {
    const cabecalho = t.colunas.map((c) => ({ value: c.titulo, fontWeight: "bold" as const, backgroundColor: "#1F5E3B", color: "#FFFFFF" }));
    const celula = (v: string | number | null, tipo: TipoColuna = "texto", negrito = false) => {
      const base = negrito ? { fontWeight: "bold" as const } : {};
      if (v === null || v === undefined || v === "") return null;
      // Texto numa coluna de número/data (ex.: "Total" no rodapé) fica como texto.
      if (tipo !== "texto" && typeof v === "string" && (tipo !== "data" || !/^\d{4}-\d{2}-\d{2}/.test(v))) {
        return { ...base, value: v, type: String };
      }
      if (tipo === "moeda") return { ...base, value: Number(v), type: Number, format: '"R$" #,##0.00' };
      if (tipo === "numero") return { ...base, value: Number(v), type: Number, format: "#,##0.###" };
      if (tipo === "percentual") return { ...base, value: Number(v), type: Number, format: "0.0%" };
      if (tipo === "data") return { ...base, value: dataLocal(String(v)), type: Date, format: "dd/mm/yyyy" };
      return { ...base, value: String(v), type: String };
    };
    const dados = [
      cabecalho,
      ...t.linhas.map((l) => l.map((v, i) => celula(v, t.colunas[i]?.tipo))),
      ...(t.rodape ? [t.rodape.map((v, i) => celula(v, t.colunas[i]?.tipo, true))] : []),
    ];
    return {
      data: dados,
      sheet: t.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"),
      columns: t.colunas.map((c) => ({ width: c.largura ?? (c.tipo === "texto" || !c.tipo ? 28 : 14) })),
    };
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await writeXlsxFile(folhas as any).toBlob();
  await compartilharArquivo(
    new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${nomeArquivo}.xlsx`,
    nomeArquivo,
  );
}

export async function exportarPdf(tabelas: TabelaRelatorio[], titulo: string, subtitulo: string, nomeArquivo: string) {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const verde: [number, number, number] = [31, 94, 59];
  doc.setTextColor(...verde);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${EMPRESA.nome} · ${titulo}`, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(subtitulo, 14, 22);
  let y = 28;
  for (const t of tabelas) {
    if (y > 260) {
      doc.addPage();
      y = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(t.titulo, 14, y);
    const alinhar = Object.fromEntries(
      t.colunas.map((c, i) => [i, { halign: c.tipo && c.tipo !== "texto" && c.tipo !== "data" ? ("right" as const) : ("left" as const) }]),
    );
    autoTable(doc, {
      startY: y + 2,
      head: [t.colunas.map((c) => c.titulo)],
      body: t.linhas.map((l) => l.map((v, i) => emTexto(v, t.colunas[i]?.tipo))),
      foot: t.rodape ? [t.rodape.map((v, i) => emTexto(v, t.colunas[i]?.tipo))] : undefined,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: verde },
      footStyles: { fillColor: [235, 242, 237], textColor: [20, 20, 20], fontStyle: "bold" },
      columnStyles: alinhar,
      margin: { left: 14, right: 14 },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;
  }
  await compartilharArquivo(doc.output("blob"), `${nomeArquivo}.pdf`, titulo);
}
