import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarHeart, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const linkCls = "rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground";
  const activeCls = { className: "rounded-full px-3 py-2 text-sm font-semibold bg-accent text-accent-foreground" };

  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold">
          <CalendarHeart className="h-6 w-6 text-primary" /> Agenda
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          <Link to="/" className={linkCls} activeProps={activeCls} activeOptions={{ exact: true }}>
            Serviços
          </Link>
          {user && (
            <Link to="/meus-agendamentos" className={linkCls} activeProps={activeCls}>
              Meus horários
            </Link>
          )}
          {isAdmin && (
            <Link to="/painel" className={linkCls} activeProps={activeCls}>
              Painel do negócio
            </Link>
          )}
          {user ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
