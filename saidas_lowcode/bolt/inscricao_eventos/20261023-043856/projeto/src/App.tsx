import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AuthPage from '@/pages/AuthPage';
import EventList from '@/pages/EventList';
import EventDetail from '@/pages/EventDetail';
import MyRegistrations from '@/pages/MyRegistrations';
import ManageEvents from '@/pages/ManageEvents';
import AllRegistrations from '@/pages/AllRegistrations';
import Navbar, { type Tab } from '@/components/Navbar';
import LoadingScreen from '@/components/LoadingScreen';

type View =
  | { name: 'event-list' }
  | { name: 'event-detail'; eventId: string }
  | { name: 'my-registrations' }
  | { name: 'manage-events' }
  | { name: 'all-registrations' };

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [view, setView] = useState<View>({ name: 'event-list' });

  const isOrganizer = profile?.role === 'organizer';

  useEffect(() => {
    if (!isOrganizer && (view.name === 'manage-events' || view.name === 'all-registrations')) {
      setView({ name: 'event-list' });
    }
  }, [isOrganizer]);

  if (loading) return <LoadingScreen />;

  if (!session) return <AuthPage />;

  const handleTabChange = (tab: Tab) => {
    if (tab === 'events') setView({ name: 'event-list' });
    else if (tab === 'my-registrations') setView({ name: 'my-registrations' });
    else if (tab === 'manage-events') setView({ name: 'manage-events' });
    else if (tab === 'all-registrations') setView({ name: 'all-registrations' });
  };

  const activeTab: Tab =
    view.name === 'event-list' || view.name === 'event-detail'
      ? 'events'
      : view.name;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {view.name === 'event-list' && (
          <EventList onSelectEvent={(id) => setView({ name: 'event-detail', eventId: id })} />
        )}
        {view.name === 'event-detail' && (
          <EventDetail
            eventId={view.eventId}
            onBack={() => setView({ name: 'event-list' })}
          />
        )}
        {view.name === 'my-registrations' && (
          <MyRegistrations
            onSelectEvent={(id) => setView({ name: 'event-detail', eventId: id })}
          />
        )}
        {view.name === 'manage-events' && isOrganizer && <ManageEvents />}
        {view.name === 'all-registrations' && isOrganizer && <AllRegistrations />}
        {(view.name === 'manage-events' || view.name === 'all-registrations') && !isOrganizer && (
          <div className="text-center py-20 text-slate-500">
            Acesso restrito a organizadores.
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
