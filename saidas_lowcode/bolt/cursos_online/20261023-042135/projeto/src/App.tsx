import { useState } from 'react';
import { BookOpen, GraduationCap, LayoutDashboard, Users } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import AuthPage from '@/pages/AuthPage';
import Header, { type Page } from '@/components/Header';
import CatalogPage from '@/pages/CatalogPage';
import MyCoursesPage from '@/pages/MyCoursesPage';
import AdminCoursesPage from '@/pages/AdminCoursesPage';
import AdminEnrollmentsPage from '@/pages/AdminEnrollmentsPage';
import { FullScreenLoader } from '@/components/ui';

function AppShell() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState<Page>('catalog');

  if (loading) return <FullScreenLoader />;

  if (!session || !profile) return <AuthPage />;

  const isAdmin = profile.role === 'admin';

  const navItems = isAdmin
    ? [
        { label: 'Cursos', icon: BookOpen, page: 'admin-courses' as Page },
        { label: 'Matrículas', icon: Users, page: 'admin-enrollments' as Page },
        { label: 'Catálogo', icon: GraduationCap, page: 'catalog' as Page },
      ]
    : [
        { label: 'Catálogo', icon: BookOpen, page: 'catalog' as Page },
        { label: 'Meus cursos', icon: GraduationCap, page: 'my-courses' as Page },
      ];

  const renderPage = () => {
    switch (page) {
      case 'catalog':
        return <CatalogPage />;
      case 'my-courses':
        return <MyCoursesPage />;
      case 'admin-courses':
        return isAdmin ? <AdminCoursesPage /> : <CatalogPage />;
      case 'admin-enrollments':
        return isAdmin ? <AdminEnrollmentsPage /> : <MyCoursesPage />;
      default:
        return <CatalogPage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header current={page} onNavigate={setPage} navItems={navItems} />
      <main>{renderPage()}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
