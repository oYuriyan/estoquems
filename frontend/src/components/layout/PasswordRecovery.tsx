import { useEffect, useState } from 'react';
import { removeToken } from '../../utils/api';

export function PasswordRecovery({ onBack }: { onBack: () => void }) {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('reset') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [token]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (token && password !== confirmation) { setError('As senhas não coincidem.'); return; }
    if (token && new TextEncoder().encode(password).length > 72) { setError('A senha deve ter até 72 bytes.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/' + (token ? 'reset-password' : 'forgot-password'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(token ? { token, password } : { email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 429 ? 'Muitas tentativas. Aguarde um minuto.' : typeof data.detail === 'string' ? data.detail : 'Confira os dados informados.');
      setMessage(data.message); setDone(true);
      if (token) { removeToken(); setPassword(''); setConfirmation(''); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível conectar. Tente novamente.'); }
    finally { setBusy(false); }
  }
  const input = 'w-full rounded-xl border border-slate-600 bg-slate-900 p-3 text-white';
  return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
    <section className="w-full max-w-md bg-slate-800 p-8 rounded-3xl space-y-6">
      <h1 className="text-2xl font-bold">{token ? 'Definir nova senha' : 'Recuperar acesso'}</h1>
      <p>{token ? 'Use uma senha exclusiva com pelo menos 12 caracteres. O link expira em 15 minutos.' : 'Informe o e-mail cadastrado para receber um link de recuperação.'}</p>
      {message && <p role="status" className="text-emerald-300">{message}</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {!done && <form onSubmit={submit} className="space-y-5">
        {token ? <>
          <label className="block">Nova senha<input className={input} type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /></label>
          <label className="block">Confirmar nova senha<input className={input} type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        </> : <label className="block">E-mail<input className={input} type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>}
        <button disabled={busy} className="w-full bg-indigo-600 rounded-xl p-3 disabled:opacity-50" type="submit">{busy ? 'Aguarde…' : token ? 'Salvar nova senha' : 'Enviar link'}</button>
      </form>}
      <button className="underline text-slate-300" onClick={onBack}>Voltar ao login</button>
    </section>
  </main>;
}
