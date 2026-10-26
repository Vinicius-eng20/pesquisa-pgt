import { type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Briefcase, Home, PlusCircle, FileText, Shield, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  label: string;
  icon: ReactNode;
  page: string;
}

export function Layout({ children, currentPage, onNavigate }: { children: ReactNode; currentPage: string; onNavigate: (page: string) => void }) {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!profile) return null;

  const navItems: NavItem[] = [
    { label: 'Explorar serviços', icon: <Home className="w-4 h-4" />, page: 'browse' },
    { label: 'Publicar serviço', icon: <PlusCircle className="w-4 h-4" />, page: 'publish' },
    { label: 'Meus contratos', icon: <FileText className="w-4 h-4" />, page: 'contracts' },
  ];

  if (profile.role === 'admin') {
    navItems.push({ label: 'Administração', icon: <Shield className="w-4 h-4" />, page: 'admin' });
  }

  const handleNav = (page: string) => {
    onNavigate(page);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-md shadow-emerald-500/20">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900 hidden sm:block">FreelaMarket</span>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.page}
                  onClick={() => handleNav(item.page)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                    currentPage === item.page
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-700 font-semibold text-sm">
                  {profile.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <div className="font-medium text-slate-900 max-w-[120px] truncate">{profile.display_name}</div>
                  <div className="text-xs text-slate-500">{profile.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
                </div>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t border-slate-200 px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.page}
                onClick={() => handleNav(item.page)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  currentPage === item.page
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
