import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function AppHeader() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const linkCls =
    "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground";
  const activeCls = "text-foreground bg-secondary";

  return (
    <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <Link to="/" className="mr-4 flex items-center gap-2 font-display text-xl font-semibold">
          <GraduationCap className="h-6 w-6 text-primary" /> Saber+
        </Link>
        {user && (
          <nav className="flex flex-wrap items-center gap-1">
            <Link to="/cursos" className={linkCls} activeProps={{ className: activeCls }}>
              Cursos
            </Link>
            <Link to="/meus-cursos" className={linkCls} activeProps={{ className: activeCls }}>
              Meus cursos
            </Link>
            {isAdmin && (
              <Link to="/admin" className={linkCls} activeProps={{ className: activeCls }}>
                Administração
              </Link>
            )}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
