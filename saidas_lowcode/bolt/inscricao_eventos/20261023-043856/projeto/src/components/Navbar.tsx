import { useState } from 'react';
import { CalendarDays, LogOut, User as UserIcon, ChevronDown, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Tab = 'events' | 'my-registrations' | 'manage-events' | 'all-registrations';

export default function Navbar({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const { profile, signOut, refreshProfile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const isOrganizer = profile?.role === 'organizer';

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'events', label: 'Eventos', show: true },
    { id: 'my-registrations', label: 'Minhas inscrições', show: true },
    { id: 'manage-events', label: 'Gerenciar eventos', show: isOrganizer },
    { id: 'all-registrations', label: 'Inscrições', show: isOrganizer },
  ];

  const toggleRole = async () => {
    if (!profile) return;
    setSwitching(true);
    const newRole = isOrganizer ? 'participant' : 'organizer';
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profile.id);
    if (!error) {
      await refreshProfile();
      if (newRole === 'participant') {
        onTabChange('events');
      }
    }
    setSwitching(false);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => onTabChange('events')}
            className="flex items-center gap-2.5 flex-shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center shadow-md shadow-teal-600/20">
              <CalendarDays className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <span className="font-bold text-slate-900 text-lg hidden sm:block">Eventos</span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {tabs.filter((t) => t.show).map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* User menu */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg p-1 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-slate-500" />
                </div>
                <div className="hidden sm:block text-left">
                  <div className="font-medium text-slate-800 leading-tight">{profile?.name || 'Usuário'}</div>
                  <div className="text-xs text-slate-400">
                    {isOrganizer ? 'Organizador' : 'Participante'}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-40">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <div className="font-medium text-slate-800 text-sm">{profile?.name || 'Usuário'}</div>
                      <div className="text-xs text-slate-400">Tipo de conta</div>
                    </div>
                    <button
                      onClick={toggleRole}
                      disabled={switching}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-2.5"
                    >
                      <Shield className={`w-4 h-4 ${isOrganizer ? 'text-teal-600' : 'text-slate-400'}`} />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-700">
                          {isOrganizer ? 'Virar participante' : 'Virar organizador'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {isOrganizer ? 'Modo participante' : 'Criar e gerenciar eventos'}
                        </div>
                      </div>
                    </button>
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={() => { setMenuOpen(false); signOut(); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-red-50 transition-colors flex items-center gap-2.5 text-red-600"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">Sair</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 pb-3 overflow-x-auto">
          {tabs.filter((t) => t.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

export type { Tab };
