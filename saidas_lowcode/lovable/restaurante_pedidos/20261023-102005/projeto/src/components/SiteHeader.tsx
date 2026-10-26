import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, isManager } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const link = "text-sm font-medium text-muted-foreground hover:text-foreground [&.active]:text-primary";
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="font-display text-2xl font-semibold text-primary">
          Sabor da Casa
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-5">
          <Link to="/" className={link} activeOptions={{ exact: true }}>Cardápio</Link>
          {user && <Link to="/pedidos" className={link}>Meus pedidos</Link>}
          {isManager && <Link to="/gerente" className={link}>Painel do gerente</Link>}
        </nav>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>Sair</Button>
          </div>
        ) : (
          <Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>
        )}
      </div>
    </header>
  );
}
