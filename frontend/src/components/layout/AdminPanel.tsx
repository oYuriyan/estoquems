import { useState, useEffect } from 'react';
import { X, Shield, Trash2, UserPlus } from 'lucide-react';
import type { User } from '../../contexts/AppContext';
import { apiFetch } from '../../utils/api';

interface AdminPanelProps {
  onClose: () => void;
  currentUser: User;
}

export function AdminPanel({ onClose, currentUser }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // States para novo usuário
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'SALES'>('SALES');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch users from API
  // Actually, let's just fetch directly assuming token is in localStorage.
  
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/users/');
      if (!res.ok) throw new Error('Falha ao carregar usuários');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      const res = await apiFetch(`/api/users/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Falha ao excluir');
      }
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/users/', {
        method: 'POST',
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Falha ao criar usuário');
      }
      const data = await res.json();
      setUsers(prev => [...prev, data]);
      setShowNew(false);
      setNewName(''); setNewEmail(''); setNewPassword('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#161b22] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-700/50">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-[#0d1117]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">Painel de Acessos</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Gerencie quem tem acesso ao sistema</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && <div className="text-red-500 text-sm mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">{error}</div>}
          
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700 dark:text-slate-200">Usuários Cadastrados</h3>
            <button 
              onClick={() => setShowNew(!showNew)}
              className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> {showNew ? 'Cancelar' : 'Novo Usuário'}
            </button>
          </div>

          {showNew && (
            <form onSubmit={handleCreate} className="mb-6 p-4 border border-indigo-200 dark:border-indigo-500/30 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input required type="text" placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm outline-none focus:border-indigo-500" />
                <input required type="email" placeholder="E-mail" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm outline-none focus:border-indigo-500" />
                <input required type="password" placeholder="Senha Inicial" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm outline-none focus:border-indigo-500" />
                <select value={newRole} onChange={e => setNewRole(e.target.value as 'ADMIN' | 'SALES')} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm outline-none focus:border-indigo-500">
                  <option value="SALES">Vendedor (Padrão)</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <button disabled={isSubmitting} type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors">
                {isSubmitting ? 'Salvando...' : 'Criar Usuário'}
              </button>
            </form>
          )}

          {loading ? (
            <div className="text-center py-10 text-slate-500 text-sm">Carregando usuários...</div>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{u.name}</span>
                      {u.role === 'ADMIN' && <span className="bg-indigo-500 text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest">Admin</span>}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{u.email}</span>
                  </div>
                  
                  {u.email !== currentUser.email && (
                    <button 
                      onClick={() => handleDelete(u.id!)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      title="Excluir Usuário"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
