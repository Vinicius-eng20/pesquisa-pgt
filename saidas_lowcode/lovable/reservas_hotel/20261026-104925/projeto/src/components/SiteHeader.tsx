import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

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

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="font-display text-2xl font-semibold text-primary">
          Casa Jardim
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Quartos</Link>
          </Button>
          {user && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/minhas-reservas">Minhas reservas</Link>
            </Button>
          )}
          {isManager && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/gerente">Painel do gerente</Link>
            </Button>
          )}
          {user ? (
            <Button variant="outline" size="sm" onClick={signOut}>
              Sair
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
