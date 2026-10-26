import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { FullPageLoader } from '@/components/ui/Loading';
import { AuthPage } from '@/pages/AuthPage';
import { Layout } from '@/components/Layout';
import { UserDashboard } from '@/pages/UserDashboard';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { AdminCategories } from '@/pages/AdminCategories';
import { AdminUsers } from '@/pages/AdminUsers';

type Page = 'dashboard' | 'expenses' | 'admin-users' | 'admin-categories' | 'admin-dashboard';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  if (loading) return <FullPageLoader />;

  if (!user || !profile) return <AuthPage />;

  // If account was deactivated, sign out
  if (!profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Conta desativada</h1>
          <p className="text-sm text-slate-500 mb-6">
            Sua conta foi desativada pelo administrador. Entre em contato para reativá-la.
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = profile.role === 'admin';

  function handleNavigate(p: Page) {
    if ((p === 'admin-users' || p === 'admin-categories' || p === 'admin-dashboard') && !isAdmin) {
      return;
    }
    setPage(p);
  }

  return (
    <Layout currentPage={page} onNavigate={handleNavigate}>
      {page === 'dashboard' && <UserDashboard onNavigate={handleNavigate} />}
      {page === 'expenses' && <ExpensesPage />}
      {page === 'admin-dashboard' && <AdminDashboard onNavigate={handleNavigate} />}
      {page === 'admin-users' && <AdminUsers />}
      {page === 'admin-categories' && <AdminCategories />}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
