export const getToken = () => localStorage.getItem('microEstoque_token');
export const setToken = (token: string) => localStorage.setItem('microEstoque_token', token);
export const removeToken = () => localStorage.removeItem('microEstoque_token');

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

/**
 * Wrapper global de fetch com suporte a autenticação Bearer e interceptação de 401.
 * Ao receber um 401, emite o evento customizado `auth:expired` no window para que
 * o AppContext possa acionar o logout graciosamente (com Toast) sem recarga de página.
 */
export async function apiFetch(endpoint: string, options: FetchOptions = {}) {
  const { requireAuth = true, headers, ...customConfig } = options;
  
  const token = getToken();
  
  const config: RequestInit = {
    ...customConfig,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (requireAuth) {
    if (!token) {
      // Nenhum token presente: notifica e sai imediatamente
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new Error('Não autenticado');
    }
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, config);

  if (response.status === 401 && requireAuth) {
    removeToken();
    // Evento customizado capturado pelo AppContext para logout suave com Toast
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  return response;
}

