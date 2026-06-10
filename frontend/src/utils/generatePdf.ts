import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { Quote, Equipamento } from '../contexts/AppContext';

async function toBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

export async function generatePdfBlob(
  quote: Quote,
  cart: Equipamento[],
  logoUrl: string,
  watermarkUrl: string
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();   // 210
  const H = pdf.internal.pageSize.getHeight();   // 297
  const M = 15; // margem lateral
  const cW = W - M * 2; // largura do conteúdo

  // Paleta
  const C = {
    headerBg:    '#0f172a',
    headerLine:  '#6366f1', // Indigo mais vibrante
    titleBlue:   '#6366f1',
    sectionBlue: '#4f46e5',
    bodyText:    '#1e293b',
    mutedText:   '#64748b',
    borderLight: '#e2e8f0',
    stripeBg:    '#f8fafc',
    footerBg:    '#f1f5f9',
    footerText:  '#94a3b8',
  };

  const setFont = (weight: 'normal' | 'bold' | 'italic' = 'normal', size = 10) => {
    pdf.setFont('helvetica', weight);
    pdf.setFontSize(size);
  };

  const rgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b] as [number, number, number];
  };

  // ─────────────────────────────────────────────────────────
  //  Função para desenhar UMA página completa (header + footer)
  // ─────────────────────────────────────────────────────────
  const drawPageChrome = async (isFirstPage: boolean, logoB64: string, wmB64: string, pageNum: number, totalPages: number) => {
    // Marca d'água (muito sutil)
    if (wmB64) {
      try {
        const gs = (pdf as any).GState({ opacity: 0.03 });
        pdf.saveGraphicsState();
        pdf.setGState(gs);
        pdf.addImage(wmB64, 'PNG', W / 2 - 55, H / 2 - 55, 110, 110);
        pdf.restoreGraphicsState();
      } catch { /* ignora */ }
    }

    // ── HEADER ──────────────────────────────────────────────
    if (isFirstPage) {
      const headerH = 34;
      // Fundo escuro do header
      pdf.setFillColor(...rgb(C.headerBg));
      pdf.rect(0, 0, W, headerH, 'F');

      // Linha accent azul no rodapé do header
      pdf.setFillColor(...rgb(C.headerLine));
      pdf.rect(0, headerH, W, 1.5, 'F');

      // Logo (calculando a proporção correta para não esticar)
      if (logoB64) {
        try {
          const props = pdf.getImageProperties(logoB64);
          const ratio = props.width / props.height;
          const targetH = 12; // Altura menor e mais elegante
          const targetW = targetH * ratio;
          // Centralizar
          pdf.addImage(logoB64, 'PNG', (W / 2) - (targetW / 2), 6, targetW, targetH);
        } catch { /* ignora */ }
      } else {
        // Logo Limmus Fallback
        setFont('bold', 18);
        pdf.setTextColor(255, 255, 255);
        pdf.text('Limmus.', W / 2, 13, { align: 'center' });
      }

      // Títulos
      setFont('bold', 12);
      pdf.setTextColor(255, 255, 255);
      pdf.text('PROPOSTA COMERCIAL', W / 2, 24, { align: 'center' });

      setFont('normal', 8);
      pdf.setTextColor(180, 190, 210);
      pdf.text(`${quote.name}  |  Emissão: ${format(new Date(), 'dd/MM/yyyy, HH:mm')}`, W / 2, 29, { align: 'center' });
    } else {
      // Header compacto para páginas seguintes
      const headerH = 12;
      pdf.setFillColor(...rgb(C.headerBg));
      pdf.rect(0, 0, W, headerH, 'F');
      pdf.setFillColor(...rgb(C.headerLine));
      pdf.rect(0, headerH, W, 0.8, 'F');

      setFont('bold', 9);
      pdf.setTextColor(255, 255, 255);
      pdf.text('PROPOSTA COMERCIAL', M, 8);
      setFont('normal', 7);
      pdf.setTextColor(180, 190, 210);
      pdf.text(quote.name, W - M, 8, { align: 'right' });
    }

    // ── FOOTER ──────────────────────────────────────────────
    pdf.setFillColor(...rgb(C.footerBg));
    pdf.rect(0, H - 10, W, 10, 'F');
    pdf.setDrawColor(...rgb(C.borderLight));
    pdf.setLineWidth(0.3);
    pdf.line(0, H - 10, W, H - 10);

    setFont('normal', 6);
    pdf.setTextColor(...rgb(C.footerText));
    pdf.text('Documento eletrônico oficial — Limmus (Sistema de Gestão)', M, H - 4.5);
    pdf.text(`Página ${pageNum} de ${totalPages}`, W - M, H - 4.5, { align: 'right' });
  };

  // ─────────────────────────────────────────────────────────
  //  PRÉ-CARREGAMENTO DE IMAGENS
  // ─────────────────────────────────────────────────────────
  const [logoB64, wmB64] = await Promise.all([toBase64(logoUrl), toBase64(watermarkUrl)]);

  // ─────────────────────────────────────────────────────────
  //  CONTEÚDO — primeira passagem para saber total de páginas
  //  (jsPDF não tem "pre-pass", então desenhamos e contamos)
  // ─────────────────────────────────────────────────────────
  // Vamos calcular quantas páginas serão necessárias para o footer
  // Estimativa simples: ~24mm por item + 70mm de header/contratante
  const estimatedH = 35 + 65 + cart.length * 24 + 30;
  const contentAreaFirst = H - 30 - 12; // header 28 + line 1.2 + footer 10 + spacing
  const contentAreaNext  = H - 14 - 12;
  let totalPages = 1;
  if (estimatedH > contentAreaFirst) {
    const overflow = estimatedH - contentAreaFirst;
    totalPages += Math.ceil(overflow / contentAreaNext);
  }

  // ─────────────────────────────────────────────────────────
  //  PRIMEIRA PÁGINA — Chrome
  // ─────────────────────────────────────────────────────────
  await drawPageChrome(true, logoB64, wmB64, 1, totalPages);

  // Posição inicial do conteúdo (abaixo do header)
  let y = 42; // header 34 + linha accent + espaço

  // ── HELPER: seção com barra azul lateral ────────────────
  const sectionTitle = (title: string) => {
    pdf.setFillColor(...rgb(C.sectionBlue));
    pdf.rect(M, y, 1.5, 6, 'F');
    setFont('bold', 8.5);
    pdf.setTextColor(...rgb(C.sectionBlue));
    pdf.text(title, M + 5, y + 4.5);
    y += 10;
  };

  // ── HELPER: campo com label+valor, bordas finas ─────────
  const field = (label: string, value: string, x: number, yy: number, w: number, h = 14) => {
    pdf.setDrawColor(...rgb(C.borderLight));
    pdf.setFillColor(...rgb(C.stripeBg));
    pdf.setLineWidth(0.25);
    pdf.roundedRect(x, yy, w, h, 1, 1, 'FD');
    setFont('normal', 6);
    pdf.setTextColor(...rgb(C.mutedText));
    pdf.text(label.toUpperCase(), x + 3, yy + 4.5);
    setFont('bold', 9);
    pdf.setTextColor(...rgb(C.bodyText));
    pdf.text(value || '—', x + 3, yy + 10.5);
  };

  // ─────────────────────────────────────────────────────────
  //  SEÇÃO: DADOS DO CONTRATANTE
  // ─────────────────────────────────────────────────────────
  sectionTitle('DADOS DO CONTRATANTE');

  // Campo cliente (largura total)
  field('Razão Social / Nome do Cliente', quote.clientName || 'Não Informado', M, y, cW);
  y += 17;

  // Margem + Validade lado a lado
  const halfW = (cW - 3) / 2;
  const dias = quote.validityDays ?? 2;
  field('Condição Especial / Margem', quote.margin || '—', M, y, halfW);
  field('Validade da Proposta', `${dias} ${dias <= 1 ? 'dia útil' : 'dias úteis'}`, M + halfW + 3, y, halfW);
  y += 20;

  // ─────────────────────────────────────────────────────────
  //  SEÇÃO: ITENS DA PROPOSTA
  // ─────────────────────────────────────────────────────────
  sectionTitle('ITENS DA PROPOSTA');

  // Larguras das colunas
  const col = [cW * 0.30, cW * 0.40, cW * 0.30];
  const cx  = [M, M + col[0], M + col[0] + col[1]];

  // ── Header da tabela ─────────────────────────────────────
  pdf.setFillColor(...rgb('#e8edf5'));
  pdf.setDrawColor(...rgb(C.borderLight));
  pdf.setLineWidth(0.25);
  pdf.rect(M, y, cW, 7, 'FD');

  // Linhas verticais do header
  pdf.line(cx[1], y, cx[1], y + 7);
  pdf.line(cx[2], y, cx[2], y + 7);

  setFont('bold', 6.5);
  pdf.setTextColor(...rgb(C.mutedText));
  pdf.text('ITEM / EQUIPAMENTO', cx[0] + 3, y + 4.8);
  pdf.text('ESPECIFICAÇÕES', cx[1] + 3, y + 4.8);
  pdf.text('IDENTIFICAÇÃO', cx[2] + 3, y + 4.8);
  y += 7;

  // ── Linhas dos itens ─────────────────────────────────────
  let currentPage = 1;
  const contentBottom = H - 13; // margem superior do footer

  for (let i = 0; i < cart.length; i++) {
    const item = cart[i];
    const rowH = 24;

    // Quebra de página
    if (y + rowH > contentBottom) {
      currentPage++;
      pdf.addPage();
      await drawPageChrome(false, logoB64, wmB64, currentPage, totalPages);
      y = 17; // abaixo do header compacto

      // Repete header da tabela na nova página
      pdf.setFillColor(...rgb('#e8edf5'));
      pdf.setDrawColor(...rgb(C.borderLight));
      pdf.setLineWidth(0.25);
      pdf.rect(M, y, cW, 7, 'FD');
      pdf.line(cx[1], y, cx[1], y + 7);
      pdf.line(cx[2], y, cx[2], y + 7);
      setFont('bold', 6.5);
      pdf.setTextColor(...rgb(C.mutedText));
      pdf.text('ITEM / EQUIPAMENTO', cx[0] + 3, y + 4.8);
      pdf.text('ESPECIFICAÇÕES', cx[1] + 3, y + 4.8);
      pdf.text('IDENTIFICAÇÃO', cx[2] + 3, y + 4.8);
      y += 7;
    }

    // Zebra sutil
    if (i % 2 === 0) {
      pdf.setFillColor(...rgb(C.stripeBg));
      pdf.rect(M, y, cW, rowH, 'F');
    }

    // Bordas da linha
    pdf.setDrawColor(...rgb(C.borderLight));
    pdf.setLineWidth(0.2);
    pdf.line(M, y + rowH, W - M, y + rowH);   // borda inferior
    pdf.line(cx[1], y, cx[1], y + rowH);        // sep col 2
    pdf.line(cx[2], y, cx[2], y + rowH);        // sep col 3

    const ry = y + 5;

    // Col 1 — Equipamento
    setFont('bold', 8);
    pdf.setTextColor(...rgb(C.bodyText));
    pdf.text(`${item.tipo} ${item.marca}`.toUpperCase(), cx[0] + 3, ry);
    setFont('normal', 7.5);
    pdf.setTextColor(...rgb(C.mutedText));
    const modelLines = pdf.splitTextToSize(item.modelo, col[0] - 6);
    pdf.text(modelLines[0] ?? '', cx[0] + 3, ry + 5);

    // Col 2 — Especificações (pares label:valor na mesma linha)
    const specs: [string, string][] = [
      ['CPU: ',  item.especificacoes?.processador ?? ''],
      ['RAM: ',  item.especificacoes?.ram ?? ''],
      ['SSD: ',  item.especificacoes?.armazenamento ?? ''],
      ['SO: ',   item.especificacoes?.so ?? ''],
    ];
    let sy = ry;
    for (const [lbl, val] of specs) {
      setFont('bold', 6);
      pdf.setTextColor(...rgb(C.mutedText));
      const lw = pdf.getTextWidth(lbl);
      pdf.text(lbl, cx[1] + 3, sy);
      setFont('normal', 6.5);
      pdf.setTextColor(...rgb(C.bodyText));
      const maxVW = col[1] - 6 - lw;
      const trimmed = pdf.getTextWidth(val) > maxVW ? pdf.splitTextToSize(val, maxVW)[0] : val;
      pdf.text(trimmed, cx[1] + 3 + lw, sy);
      sy += 4;
    }

    // Col 3 — Identificação
    setFont('bold', 6);
    pdf.setTextColor(...rgb(C.mutedText));
    pdf.text('SÉRIE:', cx[2] + 3, ry);
    setFont('bold', 9);
    pdf.setTextColor(...rgb(C.bodyText));
    const sMax = col[2] - 6;
    const sSplit = pdf.splitTextToSize(item.numeroSerie ?? '', sMax);
    pdf.text(sSplit[0], cx[2] + 3, ry + 5.5);
    if (sSplit[1]) pdf.text(sSplit[1], cx[2] + 3, ry + 9.5);

    setFont('bold', 6);
    pdf.setTextColor(...rgb(C.mutedText));
    pdf.text('PATRIMÔNIO:', cx[2] + 3, ry + 13);
    setFont('normal', 7);
    pdf.setTextColor(...rgb(C.bodyText));
    pdf.text(item.idPatrimonio ?? '', cx[2] + 3, ry + 17.5);

    y += rowH;
  }

  // ─────────────────────────────────────────────────────────
  //  AVISO LEGAL
  // ─────────────────────────────────────────────────────────
  y += 8;
  if (y + 12 > contentBottom) {
    currentPage++;
    pdf.addPage();
    await drawPageChrome(false, logoB64, wmB64, currentPage, totalPages);
    y = 20;
  }

  // Linha separadora fina antes do aviso
  pdf.setDrawColor(...rgb(C.borderLight));
  pdf.setLineWidth(0.3);
  pdf.line(M, y, W - M, y);
  y += 5;

  setFont('italic', 7);
  pdf.setTextColor(...rgb(C.mutedText));
  const aviso = 'Declaro para os devidos fins que os equipamentos descritos acima compõem a proposta comercial atual. A efetivação e faturamento dependem de aprovação formal pelo departamento financeiro.';
  const avisoLines = pdf.splitTextToSize(aviso, cW);
  pdf.text(avisoLines, W / 2, y, { align: 'center' });

  return pdf.output('blob');
}
