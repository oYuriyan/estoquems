import { useEffect, useState, useRef, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import type { TourStep } from '../../hooks/useTour';

interface OnboardingTourProps {
  isActive: boolean;
  currentStep: TourStep;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
}

const TOOLTIP_WIDTH  = 320;
const TOOLTIP_HEIGHT = 195;
const PADDING        = 16;

function computePosition(rect: DOMRect, placement: TourStep['placement']): TooltipPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top  = 0;
  let left = 0;
  let arrowSide: TooltipPosition['arrowSide'] = 'top';

  switch (placement) {
    case 'bottom':
      top  = rect.bottom + PADDING;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      arrowSide = 'top';
      if (top + TOOLTIP_HEIGHT > vh - PADDING) {
        top  = rect.top - TOOLTIP_HEIGHT - PADDING;
        arrowSide = 'bottom';
      }
      break;
    case 'top':
      top  = rect.top - TOOLTIP_HEIGHT - PADDING;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      arrowSide = 'bottom';
      if (top < PADDING) {
        top  = rect.bottom + PADDING;
        arrowSide = 'top';
      }
      break;
    case 'right':
      top  = rect.top + rect.height / 2 - TOOLTIP_HEIGHT / 2;
      left = rect.right + PADDING;
      arrowSide = 'left';
      if (left + TOOLTIP_WIDTH > vw - PADDING) {
        left = rect.left - TOOLTIP_WIDTH - PADDING;
        arrowSide = 'right';
      }
      break;
    case 'left':
      top  = rect.top + rect.height / 2 - TOOLTIP_HEIGHT / 2;
      left = rect.left - TOOLTIP_WIDTH - PADDING;
      arrowSide = 'right';
      if (left < PADDING) {
        left = rect.right + PADDING;
        arrowSide = 'left';
      }
      break;
  }

  left = Math.max(PADDING, Math.min(left, vw - TOOLTIP_WIDTH - PADDING));
  top  = Math.max(PADDING, Math.min(top,  vh - TOOLTIP_HEIGHT - PADDING));

  return { top, left, arrowSide };
}

export function OnboardingTour({
  isActive,
  currentStep,
  currentStepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: OnboardingTourProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos]  = useState<TooltipPosition | null>(null);
  const [visible, setVisible]        = useState(false);
  const [closing, setClosing]        = useState(false);
  const tooltipRef  = useRef<HTMLDivElement>(null);
  const elRef       = useRef<HTMLElement | null>(null);
  const rafRef      = useRef<number>(0);

  useEffect(() => {
    if (isActive) setClosing(false);
  }, [isActive]);

  const handleSkip = () => {
    setClosing(true);
    setTimeout(onSkip, 250);
  };

  const handleNext = () => {
    if (currentStepIndex === totalSteps - 1) {
      setClosing(true);
      setTimeout(onNext, 250);
    } else {
      onNext();
    }
  };

  const syncPosition = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    
    setTargetRect(prev => {
      // Evita re-render se o elemento não mudou de posição nem tamanho (margem de 1px)
      if (prev && 
          Math.abs(prev.top - rect.top) < 1 &&
          Math.abs(prev.left - rect.left) < 1 &&
          Math.abs(prev.width - rect.width) < 1 &&
          Math.abs(prev.height - rect.height) < 1) {
        return prev;
      }
      setTooltipPos(computePosition(rect, currentStep.placement));
      return rect;
    });
  }, [currentStep.placement]);

  // ── Localiza o elemento e inicia observadores (Resize + Scroll) ───────────
  useEffect(() => {
    if (!isActive) { setVisible(false); return; }

    elRef.current = null;
    setTargetRect(null);
    setVisible(false);

    let raf: number;
    let observer: ResizeObserver | null = null;
    let interval: NodeJS.Timeout | null = null;
    let t: NodeJS.Timeout | null = null;

    const find = () => {
      const el = document.querySelector(`[data-tour="${currentStep.target}"]`) as HTMLElement | null;
      if (!el) {
        raf = requestAnimationFrame(find);
        return;
      }
      elRef.current = el;
      syncPosition();
      
      // Observa mudanças de dimensão no próprio elemento
      observer = new ResizeObserver(() => syncPosition());
      observer.observe(el);
      
      // Observa scroll e resize globais (capture=true para pegar scrolls de sub-elementos)
      window.addEventListener('resize', syncPosition);
      window.addEventListener('scroll', syncPosition, true);
      
      // Fallback a cada 500ms para layout shifts não capturados
      interval = setInterval(syncPosition, 500);

      // Mostra o tooltip com fade-in após encontrar o elemento
      t = setTimeout(() => setVisible(true), 80);
    };

    raf = requestAnimationFrame(find);
    
    return () => {
      cancelAnimationFrame(raf);
      if (observer) observer.disconnect();
      if (interval) clearInterval(interval);
      if (t) clearTimeout(t);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [isActive, currentStep.target, syncPosition]);

  // ── Trava o scroll do body enquanto o tour está ativo ────────────────────
  useEffect(() => {
    if (!isActive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isActive]);

  if (!isActive || !targetRect || !tooltipPos) return null;

  const arrowBase = 'absolute w-3 h-3 bg-[#1e293b] rotate-45';

  return (
    <>
      {/* ── Overlay: cobre TUDO, bloqueia todos os cliques no fundo ── */}
      {/* pointer-events-auto impede qualquer interação com elementos por baixo */}
      <div
        className="fixed inset-0 z-[9000] pointer-events-auto"
        style={{
          background: `radial-gradient(ellipse ${targetRect.width + 40}px ${targetRect.height + 32}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 0%, rgba(0,0,0,0.70) 100%)`,
          opacity: (!closing && visible) ? 1 : 0,
          transition: 'opacity 0.25s ease',
          cursor: 'not-allowed',
        }}
        // Previne propagação de qualquer evento de mouse/toque
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      />

      {/* ── Highlight ring: anel visual sobre o elemento (sem bloquear cliques) ── */}
      <div
        className="fixed z-[9001] rounded-xl pointer-events-none"
        style={{
          top:    targetRect.top    - 6,
          left:   targetRect.left   - 6,
          width:  targetRect.width  + 12,
          height: targetRect.height + 12,
          opacity: (!closing && visible) ? 1 : 0,
          boxShadow: '0 0 0 3px rgba(99,102,241,0.9), 0 0 0 8px rgba(99,102,241,0.18)',
          transition: 'opacity 0.25s ease, top 0.15s ease, left 0.15s ease, width 0.15s ease, height 0.15s ease',
        }}
      />

      {/* ── Tooltip: único elemento interativo durante o tour ── */}
      <div
        ref={tooltipRef}
        className="fixed z-[9002] pointer-events-auto"
        style={{
          top:     tooltipPos.top,
          left:    tooltipPos.left,
          width:   TOOLTIP_WIDTH,
          opacity: (!closing && visible) ? 1 : 0,
          transform: (!closing && visible) ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.96)',
          transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1), top 0.15s ease, left 0.15s ease',
        }}
      >
        {/* Seta direcional */}
        {tooltipPos.arrowSide === 'top'    && <div className={`${arrowBase} -top-1.5 left-1/2 -translate-x-1/2 border-l border-t border-[#30363d]`} />}
        {tooltipPos.arrowSide === 'bottom' && <div className={`${arrowBase} -bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b border-[#30363d]`} />}
        {tooltipPos.arrowSide === 'left'   && <div className={`${arrowBase} top-1/2 -translate-y-1/2 -left-1.5 border-l border-b border-[#30363d]`} />}
        {tooltipPos.arrowSide === 'right'  && <div className={`${arrowBase} top-1/2 -translate-y-1/2 -right-1.5 border-r border-t border-[#30363d]`} />}

        {/* Card do tooltip */}
        <div className="bg-[#1e293b] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                Tutorial — {currentStepIndex + 1} de {totalSteps}
              </span>
            </div>
            <button
              onClick={handleSkip}
              title="Pular tutorial"
              className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="px-4 py-3">
            <p className="text-sm font-black text-slate-100 leading-snug mb-1.5">
              {currentStep.title}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Footer: progresso + navegação */}
          <div className="px-4 pb-4 flex items-center justify-between gap-3">
            {/* Pontos de progresso */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentStepIndex
                      ? 'w-4 h-1.5 bg-indigo-400'
                      : i < currentStepIndex
                        ? 'w-1.5 h-1.5 bg-indigo-600'
                        : 'w-1.5 h-1.5 bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {/* Botões de navegação */}
            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  onClick={onPrev}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                {currentStepIndex === totalSteps - 1 ? 'Começar!' : 'Próximo'}
                {currentStepIndex < totalSteps - 1 && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
