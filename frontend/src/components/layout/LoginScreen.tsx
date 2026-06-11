import { useState } from 'react';
import { setToken } from '../../utils/api';

import type { User } from '../../contexts/AppContext';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isRegistering) {
        // Fluxo de Registro
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.detail || 'Erro ao registrar.');
        }
        // Após registrar com sucesso, faz o login automaticamente
      }

      // Fluxo de Login (ou login após o registro)
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

      // Agora busca os dados do usuário para pegar o nome e as flags (is_superuser)
      const meResponse = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const meData = await meResponse.json();

      onLogin(meData);
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans p-4 relative bg-[#0B1120] overflow-hidden">
      {/* Mesh Gradient Background */}
      <div 
        className="absolute inset-0 z-0 animate-mesh opacity-60"
        style={{
          backgroundImage: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(168, 85, 247, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.15) 0px, transparent 50%), radial-gradient(at 0% 100%, rgba(139, 92, 246, 0.15) 0px, transparent 50%)'
        }}
      />
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] w-full max-w-sm text-center relative z-10 border border-white/20 dark:border-white/5 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
        
        {/* Nova Identidade Visual: Sistema Estoque */}
        <div className="flex justify-center items-center gap-2 mb-6 select-none">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-white font-black text-xl leading-none">S</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
            Sistema Estoque<span className="text-indigo-500">.</span>
          </h1>
        </div>

        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">
          {isRegistering ? 'Criar Conta' : 'Bem-vindo(a)'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {isRegistering ? 'Cadastre-se para acessar o sistema.' : 'Acesse com suas credenciais para visualizar o catálogo e reservar equipamentos.'}
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu Nome"
              required
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          )}
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
            {isLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isRegistering ? 'Cadastrar' : 'Acessar Sistema'}
          </button>
        </form>

        <div className="mt-6">
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
            className="text-xs text-indigo-500 hover:text-indigo-400 font-bold transition-colors"
          >
            {isRegistering ? 'Já tem uma conta? Faça Login' : 'Ainda não tem conta? Crie aqui'}
          </button>
        </div>
      </div>
    </div>
  );
}
