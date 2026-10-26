import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { CustomerMenu } from '@/components/CustomerMenu';
import { CustomerOrders } from '@/components/CustomerOrders';
import { ManagerMenu } from '@/components/ManagerMenu';
import { ManagerOrders } from '@/components/ManagerOrders';

type Tab = 'menu' | 'orders' | 'manage-menu' | 'manage-orders';

function AppContent() {
  const { user, profile, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('menu');

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }} />
          <p className="text-stone-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthScreen />;
  }

  const isManager = profile.role === 'manager';

  // Manager tabs
  const managerTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'manage-orders', label: 'Pedidos', icon: <OrdersIcon /> },
    { id: 'manage-menu', label: 'Cardápio', icon: <MenuIcon /> },
  ];

  // Customer tabs
  const customerTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'menu', label: 'Cardápio', icon: <MenuIcon /> },
    { id: 'orders', label: 'Meus Pedidos', icon: <OrdersIcon /> },
  ];

  const tabs = isManager ? managerTabs : customerTabs;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-stone-100">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                <path d="M7 2v20" />
                <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-stone-900 leading-none text-sm">Sabor & Arte</h1>
              <p className="text-xs text-stone-400 mt-0.5">
                {isManager ? 'Painel do Gerente' : profile.full_name || 'Cliente'}
              </p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        {tab === 'menu' && <CustomerMenu />}
        {tab === 'orders' && <CustomerOrders />}
        {tab === 'manage-menu' && <ManagerMenu />}
        {tab === 'manage-orders' && <ManagerOrders />}
      </main>

      {/* Bottom navigation */}
      <nav className="sticky bottom-0 z-30 bg-white/95 backdrop-blur border-t border-stone-100">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-around">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center gap-1 py-3 px-6 transition-colors relative ${
                  tab === t.id ? 'text-amber-600' : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {tab === t.id && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-amber-500 rounded-full" />
                )}
                <span className="transition-transform">{t.icon}</span>
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
