import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthPage } from '@/pages/AuthPage';
import { Layout } from '@/components/Layout';
import { BrowsePage } from '@/pages/BrowsePage';
import { PublishPage } from '@/pages/PublishPage';
import { ServiceDetailPage } from '@/pages/ServiceDetailPage';
import { ContractsPage } from '@/pages/ContractsPage';
import { AdminPage } from '@/pages/AdminPage';
import type { Service } from '@/lib/supabase';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState('browse');
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  useEffect(() => {
    if (!session) setPage('browse');
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthPage />;
  }

  if (profile.is_suspended) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-full mb-4">
            <span className="text-2xl">⛔</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Conta suspensa</h1>
          <p className="text-slate-500">Sua conta foi suspensa pela administração. Entre em contato para mais informações.</p>
        </div>
      </div>
    );
  }

  const handleNavigate = (newPage: string) => {
    setSelectedService(null);
    setPage(newPage);
  };

  return (
    <Layout currentPage={page} onNavigate={handleNavigate}>
      {page === 'browse' && !selectedService && (
        <BrowsePage onViewService={(svc) => setSelectedService(svc)} />
      )}
      {page === 'browse' && selectedService && (
        <ServiceDetailPage
          service={selectedService}
          onBack={() => setSelectedService(null)}
        />
      )}
      {page === 'publish' && <PublishPage />}
      {page === 'contracts' && <ContractsPage />}
      {page === 'admin' && <AdminPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
