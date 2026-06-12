/**
 * Inicialização do Sentry para o frontend React.
 *
 * Ativa apenas quando VITE_SENTRY_DSN estiver configurado no .env.
 * Em desenvolvimento, só inicializa se VITE_SENTRY_FORCE=true for definido.
 *
 * Integra automaticamente:
 * - Captura de exceptions não tratadas
 * - React component stack nos erros
 * - Performance tracing de page loads e navigations
 * - Session replay (apenas em produção, 10% das sessões)
 */
import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = import.meta.env.MODE; // 'development' | 'production'
const RELEASE = import.meta.env.VITE_APP_VERSION as string | undefined;
const FORCE_DEV = import.meta.env.VITE_SENTRY_FORCE === 'true';

export function initSentry() {
  // Não inicializa sem DSN ou em dev (a menos que forçado)
  if (!DSN || (ENV === 'development' && !FORCE_DEV)) {
    if (ENV === 'development') {
      console.info('[Sentry] Desativado em desenvolvimento. Defina VITE_SENTRY_FORCE=true para ativar.');
    }
    return;
  }

  const isProd = ENV === 'production';

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: RELEASE ? `estoque-frontend@${RELEASE}` : undefined,

    integrations: [
      // Rastreia navegações e page loads
      Sentry.browserTracingIntegration(),
      // Replays de sessão para reproduzir erros (privacidade: mascara inputs)
      Sentry.replayIntegration({
        maskAllInputs: true,   // mascara senhas e dados sensíveis
        maskAllText: false,    // texto normal é exibido para diagnóstico
        blockAllMedia: false,
      }),
    ],

    // Performance: 100% em dev (quando forçado), 10% em prod
    tracesSampleRate: isProd ? 0.1 : 1.0,

    // Replay: 10% das sessões normais, 100% das que têm erro
    replaysSessionSampleRate: isProd ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,

    // Não envia PII automaticamente (LGPD)
    sendDefaultPii: false,

    // Ignora erros irrelevantes que poluem o dashboard
    ignoreErrors: [
      // Erros de rede/conectividade do usuário
      'Failed to fetch',
      'NetworkError',
      'Load failed',
      'The Internet connection appears to be offline',
      // Erros de extensões de browser
      /^Extension context invalidated/,
      /^ResizeObserver loop/,
    ],
  });

  console.info(`[Sentry] Inicializado. Environment: ${ENV}`);
}

// Re-exporta Sentry para uso nos componentes (ErrorBoundary, etc.)
export { Sentry };
