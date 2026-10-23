import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AuthPage from '@/pages/AuthPage';
import Dashboard from '@/pages/Dashboard';
import AdminPanel from '@/pages/AdminPanel';
import { supabase } from '@/lib/supabase';
import { Wallet } from 'lucide-react';

function Shell() {
  const { session, profile, loading } = useAuth();
  const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');
  const [deactivated, setDeactivated] = useState(false);

  useEffect(() => {
    if (!session) {
      setDeactivated(false);
      return;
    }
    setDeactivated(false);
  }, [session]);

  useEffect(() => {
    const toAdmin = () => setView('admin');
    const toDash = () => setView('dashboard');
    window.addEventListener('navigate-admin', toAdmin);
    window.addEventListener('navigate-dashboard', toDash);
    return () => {
      window.removeEventListener('navigate-admin', toAdmin);
      window.removeEventListener('navigate-dashboard', toDash);
    };
  }, []);

  // Keep profile fresh if the admin flips active state for the current user
  useEffect(() => {
    if (profile && profile.active === false) {
      setDeactivated(true);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white animate-pulse">
            <Wallet className="w-6 h-6" />
          </div>
          <p className="text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  if (deactivated) {
    return <DeactivatedScreen />;
  }

  if (view === 'admin' && profile?.role === 'admin') {
    return <AdminPanel />;
  }

  return <Dashboard />;
}

function DeactivatedScreen() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
          <Wallet className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Conta desativada</h1>
        <p className="text-sm text-slate-500 mb-6">
          Seu acesso foi desativado pelo administrador do sistema. Entre em contato para reativar sua conta.
        </p>
        <button
          onClick={signOut}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          Sair
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
