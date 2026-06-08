import logoOficial from '../../assets/logo_oficial.png';

interface LoginScreenProps {
  onLogin: (name: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
        <img src={logoOficial} alt="Logo" className="h-16 mx-auto mb-6 object-contain" />
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Bem-vindo(a)</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          Por favor, identifique-se para acessar o catálogo comercial. Seu nome será registrado nas reservas.
        </p>
        <form
          onSubmit={e => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get('name')?.toString().trim();
            if (name) {
              localStorage.setItem('microEstoque_salesperson', name);
              onLogin(name);
            }
          }}
        >
          <input
            type="text"
            name="name"
            placeholder="Ex: Yuri Yan"
            required
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl mb-4 font-bold text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm"
          >
            Acessar Sistema
          </button>
        </form>
      </div>
    </div>
  );
}
