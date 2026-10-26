import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthPage } from '@/pages/AuthPage';
import { AppShell } from '@/components/AppShell';
import { ClientServices, ClientBookings } from '@/pages/ClientArea';
import {
  BusinessServices,
  BusinessSlots,
  BusinessBookings,
} from '@/pages/BusinessArea';
import { FullPageLoader } from '@/components/ui';

function AppContent() {
  const { profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('services');

  if (loading) {
    return <FullPageLoader />;
  }

  if (!profile) {
    return <AuthPage />;
  }

  const isBusiness = profile.role === 'business';

  // Reset tab if switching role context
  const validTabs = isBusiness
    ? ['services', 'slots', 'bookings']
    : ['services', 'bookings'];
  const currentTab = validTabs.includes(activeTab) ? activeTab : 'services';

  return (
    <AppShell activeTab={currentTab} onTabChange={setActiveTab}>
      {isBusiness ? (
        <>
          {currentTab === 'services' && <BusinessServices />}
          {currentTab === 'slots' && <BusinessSlots />}
          {currentTab === 'bookings' && <BusinessBookings />}
        </>
      ) : (
        <>
          {currentTab === 'services' && <ClientServices />}
          {currentTab === 'bookings' && <ClientBookings />}
        </>
      )}
    </AppShell>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
