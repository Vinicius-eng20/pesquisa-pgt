import { Loader2, Hotel } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { GuestDashboard } from '@/components/GuestDashboard';
import { ManagerDashboard } from '@/components/ManagerDashboard';

function AppContent() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-700 rounded-2xl flex items-center justify-center shadow-lg">
            <Hotel className="w-7 h-7 text-white" />
          </div>
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return profile?.role === 'manager' ? <ManagerDashboard /> : <GuestDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
