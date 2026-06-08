import { useState } from 'react';
import logoOficial from '../../assets/logo_oficial.png';
import { setToken } from '../../utils/api';

interface LoginScreenProps {
  onLogin: (name: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Email ou senha incorretos.');
      }

      const data = await response.json();
      setToken(data.access_token);

      // Agora busca os dados do usuário para pegar o nome
      const meResponse = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const meData = await meResponse.json();

      localStorage.setItem('microEstoque_salesperson', meData.name);
      onLogin(meData.name);
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
        <img src={logoOficial} alt="Logo" className="h-16 mx-auto mb-6 object-contain" />
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Bem-vindo(a)</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          Acesse com suas credenciais para visualizar o catálogo e reservar equipamentos.
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="E-mail"
            required
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Senha"
            required
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-wait text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm flex justify-center items-center gap-2"
          >
            {isLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Acessar Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
