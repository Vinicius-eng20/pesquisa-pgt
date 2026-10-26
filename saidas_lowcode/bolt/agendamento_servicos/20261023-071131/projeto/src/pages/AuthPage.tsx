import { useState } from 'react';
import { CalendarCheck, LogIn, UserPlus, Scissors, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Spinner } from '@/components/ui';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'business' | 'client'>('client');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (fullName.trim().length < 2) {
        setError('Digite seu nome completo.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        setLoading(false);
        return;
      }
      const { error } = await signUp({
        email,
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role,
      });
      if (error) setError(error);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-stone-50">
      {/* Left panel — branding */}
      <div className="lg:w-1/2 bg-gradient-to-br from-teal-700 via-teal-800 to-stone-900 text-white p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-stone-800/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center ring-1 ring-white/20">
              <CalendarCheck size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight">AgendaFácil</span>
          </div>
        </div>

        <div className="relative z-10 my-12 lg:my-0">
          <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight">
            Gerencie seus agendamentos com simplicidade
          </h1>
          <p className="mt-4 text-teal-100 text-base lg:text-lg leading-relaxed max-w-md">
            Seus clientes marcam horários online, você confirma com um clique.
            Tudo organizado, tudo salvo, acessível de qualquer lugar.
          </p>

          <div className="mt-8 space-y-3 max-w-sm">
            <div className="flex items-center gap-3 text-sm text-teal-50">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center ring-1 ring-white/10">
                <Scissors size={16} />
              </div>
              <span>Cadastre seus serviços e horários disponíveis</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-teal-50">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center ring-1 ring-white/10">
                <Clock size={16} />
              </div>
              <span>Clientes veem horários livres e agendam sozinhos</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-teal-50">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center ring-1 ring-white/10">
                <CalendarCheck size={16} />
              </div>
              <span>Confirme ou recuse agendamentos em segundos</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-teal-200/70">
          © {new Date().getFullYear()} AgendaFácil. Todos os direitos reservados.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-stone-900">
              {mode === 'signin' ? 'Entrar na minha conta' : 'Criar minha conta'}
            </h2>
            <p className="mt-1.5 text-sm text-stone-500">
              {mode === 'signin'
                ? 'Acesse com seu email e senha para continuar.'
                : 'Escolha seu tipo de conta e comece a usar.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <Input
                  label="Nome completo"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  required
                />
                <Input
                  label="Telefone (opcional)"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Tipo de conta
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('client')}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        role === 'client'
                          ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <UserPlus
                          size={18}
                          className={role === 'client' ? 'text-teal-600' : 'text-stone-400'}
                        />
                        <span className="font-semibold text-sm text-stone-800">
                          Cliente
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">
                        Agendar horários
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('business')}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        role === 'business'
                          ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20'
                          : 'border-stone-200 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Scissors
                          size={18}
                          className={role === 'business' ? 'text-teal-600' : 'text-stone-400'}
                        />
                        <span className="font-semibold text-sm text-stone-800">
                          Responsável
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">
                        Gerenciar negócio
                      </p>
                    </button>
                  </div>
                </div>
              </>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
            />

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <Spinner className="w-5 h-5" />
              ) : mode === 'signin' ? (
                <>
                  <LogIn size={18} />
                  Entrar
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Criar conta
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="text-sm text-stone-500 hover:text-teal-600 transition-colors"
            >
              {mode === 'signin' ? (
                <>Não tem conta? <span className="font-medium text-teal-600">Cadastre-se</span></>
              ) : (
                <>Já tem conta? <span className="font-medium text-teal-600">Entrar</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
