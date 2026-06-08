export const getToken = () => localStorage.getItem('microEstoque_token');
export const setToken = (token: string) => localStorage.setItem('microEstoque_token', token);
export const removeToken = () => localStorage.removeItem('microEstoque_token');

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

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
      // Force logout by triggering an event or throwing
      throw new Error('Não autenticado');
    }
    (config.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, config);

  if (response.status === 401 && requireAuth) {
    removeToken();
    localStorage.removeItem('microEstoque_salesperson');
    window.location.reload(); // Force login screen
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  return response;
}
