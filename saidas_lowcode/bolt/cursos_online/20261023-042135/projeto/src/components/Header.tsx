import { GraduationCap, LogOut, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type NavItem = {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
};

export type Page = 'catalog' | 'my-courses' | 'admin-courses' | 'admin-enrollments';

export default function Header({
  current,
  onNavigate,
  navItems,
}: {
  current: string;
  onNavigate: (page: Page) => void;
  navItems: { label: string; icon: LucideIcon; page: Page }[];
}) {
  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => onNavigate(navItems[0].page)} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 hidden sm:block">EduCursos</span>
          </button>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = item.page === current;
              return (
                <button
                  key={item.page}
                  onClick={() => onNavigate(item.page)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium text-slate-900">{profile?.name}</span>
              <span className="text-xs text-slate-400">
                {profile?.role === 'admin' ? 'Administrador' : 'Aluno'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
              {profile?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <button
              onClick={signOut}
              title="Sair"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
