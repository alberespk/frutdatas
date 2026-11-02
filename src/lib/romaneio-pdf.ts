// Romaneio em PDF (A4), gerado no próprio celular, sem internet.
import { formatarData, formatarMoeda, formatarNumero } from "./formato";
import type { Registro } from "./tabelas";
import { EMPRESA, valorItem } from "./vendas";

async function carregarLogo(): Promise<string | null> {
  try {
    const r = await fetch("/icones/logo-mono.png");
    const b = await r.blob();
    return await new Promise((ok) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result));
      leitor.onerror = () => ok(null);
      leitor.readAsDataURL(b);
    });
  } catch {
    return null;
  }
}

export async function gerarRomaneioPdf(p: {
  venda: Registro;
  cliente: Registro | undefined;
  itens: Registro[];
  nomeItem: (i: Registro) => string;
  unidade: (i: Registro) => string;
}): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const verde: [number, number, number] = [31, 94, 59];
  const acertada = p.venda.situacao === "acertada";

  // Cabeçalho
  const logo = await carregarLogo();
  if (logo) doc.addImage(logo, "PNG", 15, 12, 40, 24);
  doc.setTextColor(...verde);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(acertada ? "ACERTO" : "ROMANEIO", 195, 20, { align: "right" });
  doc.setFontSize(14);
  doc.text(`Nº ${p.venda.numero}`, 195, 28, { align: "right" });
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(EMPRESA.endereco, 195, 34, { align: "right" });
  doc.text(EMPRESA.telefones, 195, 38, { align: "right" });
  doc.setDrawColor(...verde);
  doc.setLineWidth(0.6);
  doc.line(15, 43, 195, 43);

  // Cliente e datas
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 15, 51);
  doc.setFont("helvetica", "normal");
  doc.text(String(p.cliente?.nome ?? ""), 33, 51);
  const extra = [p.cliente?.cidade, p.cliente?.telefone].filter(Boolean).join(" · ");
  if (extra) doc.text(String(extra), 33, 57);
  doc.setFont("helvetica", "bold");
  doc.text("Data:", 140, 51);
  doc.setFont("helvetica", "normal");
  doc.text(formatarData(String(p.venda.data)), 160, 51);
  doc.setFont("helvetica", "bold");
  doc.text("Venc.:", 140, 57);
  doc.setFont("helvetica", "normal");
  doc.text(formatarData(String(p.venda.vencimento)), 160, 57);

  // Tabela
  let y = 68;
  const cabecalho = () => {
    doc.setFillColor(...verde);
    doc.rect(15, y - 5, 180, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Qtd.", 17, y);
    doc.text("Un.", 35, y);
    doc.text("Produto", 55, y);
    doc.text("Preço", 160, y, { align: "right" });
    doc.text("Total", 193, y, { align: "right" });
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    y += 9;
  };
  cabecalho();
  let total = 0;
  p.itens.forEach((i, n) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
      cabecalho();
    }
    const q = Number(i.quantidade_acerto ?? i.quantidade);
    const preco = Number(i.preco_acerto ?? i.preco_unitario);
    const v = valorItem(i);
    total += v;
    if (n % 2 === 1) {
      doc.setFillColor(243, 247, 244);
      doc.rect(15, y - 5, 180, 8, "F");
    }
    doc.text(formatarNumero(q), 17, y);
    doc.text(p.unidade(i), 35, y);
    doc.text(p.nomeItem(i).slice(0, 50), 55, y);
    doc.text(formatarMoeda(preco), 160, y, { align: "right" });
    doc.text(formatarMoeda(v), 193, y, { align: "right" });
    if (acertada && Number(i.quantidade_devolvida) > 0) {
      y += 5;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Saiu ${formatarNumero(Number(i.quantidade))}, devolvido ${formatarNumero(Number(i.quantidade_devolvida))}`, 55, y);
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
    }
    y += 8;
  });

  doc.setDrawColor(...verde);
  doc.line(120, y - 3, 195, y - 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TOTAL", 140, y + 4);
  doc.text(formatarMoeda(total), 193, y + 4, { align: "right" });

  if (p.venda.observacao) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(`Obs.: ${p.venda.observacao}`, 180), 15, y + 16);
  }

  // Assinatura
  const ya = Math.max(y + 40, 240);
  if (ya < 285) {
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.line(15, ya, 95, ya);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Recebido por", 15, ya + 5);
  }
  return doc.output("blob");
}

/** Abre o compartilhar do celular (WhatsApp etc.); se não der, baixa o arquivo. */
export async function compartilharArquivo(blob: Blob, nome: string, titulo: string) {
  const arquivo = new File([blob], nome, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [arquivo] })) {
    try {
      await nav.share({ files: [arquivo], title: titulo });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
