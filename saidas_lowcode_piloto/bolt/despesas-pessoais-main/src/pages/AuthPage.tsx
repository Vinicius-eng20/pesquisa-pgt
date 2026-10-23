import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Wallet, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === 'signup' && password.length < 6) {
      setError('A senha precisa ter ao menos 6 caracteres.');
      setSubmitting(false);
      return;
    }

    const result =
      mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, fullName.trim());

    if (result.error) setError(result.error);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Brand panel */}
      <div className="lg:w-1/2 bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 text-white p-8 lg:p-14 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 -left-32 w-96 h-96 rounded-full bg-emerald-300 blur-3xl" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
            <Wallet className="w-6 h-6" />
          </div>
          <span className="text-xl font-semibold tracking-tight">FinControl</span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-4">
            Controle total dos seus gastos pessoais
          </h1>
          <p className="text-teal-50/90 text-lg leading-relaxed">
            Registre despesas, organize por categoria e acompanhe quanto você gasta a cada mês.
            Tudo salvo com segurança, acessível de qualquer dispositivo.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4 text-sm">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 ring-1 ring-white/10">
            <div className="text-2xl font-bold">100%</div>
            <div className="text-teal-100/80">online</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 ring-1 ring-white/10">
            <div className="text-2xl font-bold">PC + celular</div>
            <div className="text-teal-100/80">sincronizado</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 ring-1 ring-white/10">
            <div className="text-2xl font-bold">seguro</div>
            <div className="text-teal-100/80">e privado</div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {mode === 'signin' ? 'Entrar na conta' : 'Criar nova conta'}
            </h2>
            <p className="text-slate-500 text-sm">
              {mode === 'signin'
                ? 'Acesse com seu e-mail e senha para continuar.'
                : 'Preencha os dados para começar a controlar seus gastos.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Seu nome"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="voce@exemplo.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 focus:ring-2 focus:ring-teal-500/30 disabled:opacity-60 transition"
            >
              {submitting ? 'Carregando...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            {mode === 'signin' ? (
              <>
                Ainda não tem conta?{' '}
                <button
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="font-semibold text-teal-700 hover:text-teal-800"
                >
                  Criar agora
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="font-semibold text-teal-700 hover:text-teal-800"
                >
                  Entrar
                </button>
              </>
            )}
          </div>

          <p className="mt-8 text-xs text-slate-400 text-center leading-relaxed">
            Ao criar uma conta, seus dados ficam protegidos e acessíveis apenas por você.
            A primeira conta criada se torna administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
