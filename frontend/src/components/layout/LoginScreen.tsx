import { useState } from 'react';
import { setToken } from '../../utils/api';
import { Mail, Lock, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import logoOficial from '../../assets/logo_oficial.png';

import type { User } from '../../contexts/AppContext';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Validação inline
  const isEmailValid = email.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
    <div className="min-h-screen w-full flex bg-[#0f172a] font-sans overflow-hidden">
      
      {/* ── LADO ESQUERDO: ARTE (Desktop) ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/5 bg-[#0B1120]">
        {/* Fundo Animado Mesh Gradient */}
        <div 
          className="absolute inset-0 z-0 animate-mesh opacity-80 mix-blend-screen"
          style={{
            backgroundImage: 'radial-gradient(at 20% 30%, rgba(99, 102, 241, 0.4) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(168, 85, 247, 0.3) 0px, transparent 50%), radial-gradient(at 90% 10%, rgba(59, 130, 246, 0.2) 0px, transparent 50%), radial-gradient(at 10% 90%, rgba(139, 92, 246, 0.3) 0px, transparent 50%)'
          }}
        />
        
        {/* Elementos de Overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 pointer-events-none" />

        <div className="relative z-10">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-xl mb-6">
            <img src={logoOficial} alt="Logo" className="w-8 h-8 object-contain drop-shadow-md brightness-0 invert" />
          </div>
        </div>

        <div className="relative z-10 mb-24 max-w-lg">
          <h1 className="text-5xl font-black text-white leading-tight tracking-tight mb-6">
            Inteligência e fluidez para o seu <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Estoque.</span>
          </h1>
          <p className="text-lg text-indigo-100/80 leading-relaxed font-medium">
            Gerencie alocações, reserve equipamentos e mantenha tudo sincronizado com o GLPI através de uma interface desenhada para produtividade máxima.
          </p>
        </div>
        
        <div className="relative z-10 flex items-center gap-4 text-sm text-white/50 font-medium">
          <span>&copy; {new Date().getFullYear()} Sistema Estoque</span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
          <span>Versão 1.0</span>
        </div>
      </div>

      {/* ── LADO DIREITO: FORMULÁRIO ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        {/* Background mobile (no desktop fica invisível ou coberto) */}
        <div className="absolute inset-0 lg:hidden bg-[#0B1120] z-0">
          <div 
            className="absolute inset-0 animate-mesh opacity-40 mix-blend-screen"
            style={{ backgroundImage: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.3) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.3) 0px, transparent 50%)' }}
          />
        </div>

        <div className="w-full max-w-md relative z-10 animate-fade-slide-up">
          <div className="mb-10 text-center lg:text-left">
            {/* Logo e Nome mobile */}
            <div className="flex lg:hidden justify-center items-center gap-3 mb-8">
              <img src={logoOficial} alt="Logo" className="w-10 h-10 object-contain brightness-0 invert" />
              <h2 className="text-2xl font-black text-white tracking-tight">Estoque<span className="text-indigo-500">.</span></h2>
            </div>

            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
              Acesse sua conta
            </h2>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              Insira suas credenciais para continuar
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-white/10 relative overflow-hidden">
            {/* Shine effect na borda superior do card */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-semibold p-4 rounded-xl mb-6 border border-red-200 dark:border-red-800/50 flex items-center gap-3">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">E-mail</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="voce@empresa.com"
                    required
                    className={`w-full pl-11 pr-4 py-3.5 border rounded-xl font-medium text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all shadow-sm ${
                      !isEmailValid ? 'border-red-500 focus:ring-2 focus:ring-red-500/50' : 'border-slate-200 dark:border-slate-700/50 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                    }`}
                  />
                </div>
                {!isEmailValid && (
                  <p className="text-red-500 text-xs font-semibold mt-1.5 ml-1">Formato de e-mail inválido.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Senha</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-11 pr-4 py-3.5 border border-slate-200 dark:border-slate-700/50 rounded-xl font-medium text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900/50 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !isEmailValid || !password}
                className="group relative w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_4px_14px_0_rgba(99,102,241,0.39)] disabled:shadow-none hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] hover:-translate-y-[1px] active:translate-y-[0px] overflow-hidden mt-8"
              >
                {/* Shine effect animation */}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-shine bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
                
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    <>
                      Entrar na Plataforma
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Problemas para acessar?{' '}
              <a 
                href="https://wa.me/5511967977042?text=Ol%C3%A1%2C%20estou%20com%20problemas%20para%20acessar%20o%20sistema." 
                target="_blank" 
                rel="noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:underline transition-colors font-bold"
              >
                Contate o Suporte
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
