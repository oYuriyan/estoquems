/**
 * ErrorBoundary — captura erros de render em componentes React filhos.
 *
 * Comportamento:
 * - Em produção: exibe UI de fallback elegante + reporta ao Sentry
 * - Em desenvolvimento: relança o erro para que o React DevTools mostre a stack
 *
 * Uso:
 * <ErrorBoundary>
 *   <ComponenteQuePodefailhar />
 * </ErrorBoundary>
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException, withScope } from '@sentry/react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** UI customizada para exibir no lugar do fallback padrão */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  eventId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '', eventId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error.message || 'Erro desconhecido',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Envia ao Sentry com o component stack para diagnóstico preciso
    withScope((scope) => {
      scope.setExtras({ componentStack: info.componentStack });
      const eventId = captureException(error);
      this.setState({ eventId });
    });

    // Log local também
    console.error('[ErrorBoundary] Erro capturado:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '', eventId: null });
  };

  render() {
    const { hasError, errorMessage, eventId } = this.state;
    const { children, fallback } = this.props;

    if (!hasError) return children;
    if (fallback) return fallback;

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#0f172a] p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 flex flex-col items-center gap-6 text-center">
          {/* Ícone */}
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>

          {/* Título */}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              Algo deu errado
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ocorreu um erro inesperado. Nossa equipe foi notificada automaticamente.
            </p>
          </div>

          {/* Detalhes do erro (colapsado) */}
          {errorMessage && (
            <details className="w-full text-left">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 transition-colors">
                Detalhes técnicos
              </summary>
              <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs text-red-600 dark:text-red-400 overflow-auto whitespace-pre-wrap break-words">
                {errorMessage}
              </pre>
            </details>
          )}

          {/* Event ID para suporte */}
          {eventId && (
            <p className="text-xs text-slate-400">
              Código de rastreamento:{' '}
              <code className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                {eventId.slice(0, 8)}
              </code>
            </p>
          )}

          {/* Ações */}
          <div className="flex gap-3 w-full">
            <button
              onClick={this.handleReset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Recarregar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
