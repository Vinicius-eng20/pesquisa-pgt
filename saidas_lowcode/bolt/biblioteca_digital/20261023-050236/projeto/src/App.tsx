import { useState } from 'react';
import { BookOpen, Library, ClipboardList, LogOut, Menu, X, LayoutGrid, Users, History } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LoginPage } from '@/pages/LoginPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { MyLoansPage } from '@/pages/MyLoansPage';
import { ManageItemsPage } from '@/pages/ManageItemsPage';
import { LoansHistoryPage } from '@/pages/LoansHistoryPage';
import { ReadersPage } from '@/pages/ReadersPage';

type Page = 'catalog' | 'my-loans' | 'manage-items' | 'history' | 'readers';

function AppContent() {
  const { session, profile, loading, signOut } = useAuth();
  const [page, setPage] = useState<Page>('catalog');
  const [mobileMenu, setMobileMenu] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <BookOpen className="w-10 h-10 text-brand-400 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return <LoginPage />;
  }

  const isLibrarian = profile.role === 'librarian';

  const readerNav: { key: Page; label: string; icon: typeof BookOpen }[] = [
    { key: 'catalog', label: 'Acervo', icon: BookOpen },
    { key: 'my-loans', label: 'Meus empréstimos', icon: ClipboardList },
  ];

  const librarianNav: { key: Page; label: string; icon: typeof BookOpen }[] = [
    { key: 'manage-items', label: 'Acervo', icon: LayoutGrid },
    { key: 'history', label: 'Empréstimos', icon: History },
    { key: 'readers', label: 'Leitores', icon: Users },
  ];

  const navItems = isLibrarian ? librarianNav : readerNav;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-700 rounded-xl flex items-center justify-center">
                <Library className="w-5 h-5 text-white" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="font-serif text-lg font-semibold text-gray-900 leading-none">
                  Biblioteca Digital
                </h1>
                <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
                  {isLibrarian ? 'Painel do bibliotecário' : 'Painel do leitor'}
                </p>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setPage(item.key)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    page === item.key
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3 pl-4 ml-2 border-l border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                  <span className="text-brand-700 font-medium text-sm">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-gray-600 max-w-[120px] truncate">{profile.name}</span>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                aria-label="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-50"
            >
              {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenu && (
          <div className="md:hidden border-t border-gray-100 bg-white animate-fade-in">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setPage(item.key); setMobileMenu(false); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    page === item.key
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                    <span className="text-brand-700 font-medium text-sm">
                      {profile.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">{profile.name}</span>
                </div>
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 text-sm text-red-500 px-3 py-2 rounded-lg hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {page === 'catalog' && <CatalogPage />}
        {page === 'my-loans' && <MyLoansPage />}
        {page === 'manage-items' && <ManageItemsPage />}
        {page === 'history' && <LoansHistoryPage />}
        {page === 'readers' && <ReadersPage />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-400">
            Biblioteca Digital · Empréstimos e devoluções online
          </p>
        </div>
      </footer>
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
