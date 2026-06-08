import { useCallback } from 'react';
import { generatePdfBlob } from '../utils/generatePdf';
import type { Quote, Equipamento } from '../types';

interface UsePdfOptions {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  setGenerating: (v: boolean) => void;
}

export function usePdf({ onSuccess, onError, setGenerating }: UsePdfOptions) {
  const generatePdf = useCallback(async (
    activeQuote: Quote,
    cart: Equipamento[],
    logoSrc: string,
    watermarkSrc: string
  ) => {
    if (!activeQuote || cart.length === 0) return;
    setGenerating(true);

    const isPwa = window.matchMedia('(display-mode: standalone)').matches;
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const clientName = activeQuote.clientName || 'Cliente';
    const quoteName = activeQuote.name || 'Proposta';
    const safeName = `${clientName}-${quoteName}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `proposta_${safeName}.pdf`;

    try {
      const pdfBlob = await generatePdfBlob(activeQuote, cart, logoSrc, watermarkSrc);
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      // Estratégia 1 — Share API nativa (HTTPS/mobile)
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Proposta: ${activeQuote.name}`, text: 'Segue a proposta em anexo.' });
          onSuccess('PDF compartilhado com sucesso!');
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') return;
        }
      }

      // Estratégia 2 — Download direto (PWA/mobile — nunca abre aba externa)
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      if (isPwa || isMobileDevice) link.target = '_self';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      onSuccess('PDF gerado! Verifique seus downloads.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erro ao gerar PDF:', msg);
      onError(`Erro ao gerar o PDF: ${msg}.`);
    } finally {
      setGenerating(false);
    }
  }, [onSuccess, onError, setGenerating]);

  return { generatePdf };
}
