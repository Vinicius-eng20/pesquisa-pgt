import { ReactNode } from 'react';
import { CalendarCheck, LogOut, Scissors, Calendar, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

export type BusinessTab = 'services' | 'slots' | 'bookings';
export type ClientTab = 'services' | 'bookings';

export function AppShell({
  children,
  activeTab,
  onTabChange,
}: {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const { profile, signOut } = useAuth();
  const isBusiness = profile?.role === 'business';

  const tabs = isBusiness
    ? [
        { id: 'services' as BusinessTab, label: 'Serviços', icon: Scissors },
        { id: 'slots' as BusinessTab, label: 'Horários', icon: Calendar },
        { id: 'bookings' as BusinessTab, label: 'Agendamentos', icon: LayoutGrid },
      ]
    : [
        { id: 'services' as ClientTab, label: 'Agendar', icon: Calendar },
        { id: 'bookings' as ClientTab, label: 'Meus Agendamentos', icon: LayoutGrid },
      ];

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
                <CalendarCheck size={20} className="text-white" />
              </div>
              <span className="text-lg font-bold text-stone-900 tracking-tight hidden sm:block">
                AgendaFácil
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-stone-800 leading-tight">
                  {profile?.full_name}
                </p>
                <p className="text-xs text-stone-500">
                  {isBusiness ? 'Responsável' : 'Cliente'}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-semibold">
                {profile?.full_name?.charAt(0).toUpperCase() || '?'}
              </div>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                <LogOut size={16} />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="sticky top-16 z-30 bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-stone-500 hover:text-stone-700'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}
