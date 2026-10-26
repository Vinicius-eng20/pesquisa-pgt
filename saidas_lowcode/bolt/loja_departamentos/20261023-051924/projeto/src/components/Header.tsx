import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, LogOut, LayoutGrid, Package } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const { count, setOpen } = useCart();
  const navigate = useNavigate();

  const isAdmin = profile?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Package size={20} />
          </div>
          <span>ShopHub</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          {user && isAdmin && (
            <Link
              to="/admin"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:flex"
            >
              <LayoutGrid size={16} />
              Painel
            </Link>
          )}
          {user && (
            <Link
              to="/orders"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:flex"
            >
              <User size={16} />
              Meus Pedidos
            </Link>
          )}
          <button
            onClick={() => setOpen(true)}
            className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </button>
          {user ? (
            <button
              onClick={() => {
                signOut();
                navigate('/');
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              <User size={16} />
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
