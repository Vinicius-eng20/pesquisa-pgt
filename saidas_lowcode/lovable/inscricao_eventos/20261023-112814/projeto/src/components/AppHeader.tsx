import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarHeart, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/session";

export function AppHeader() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const linkCls =
    "rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
  const active = { className: "bg-secondary text-foreground" };

  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
        <Link to="/eventos" className="mr-auto flex items-center gap-2 font-display text-xl font-semibold">
          <CalendarHeart className="h-5 w-5 text-accent" /> Inscreva
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          <Link to="/eventos" className={linkCls} activeProps={active}>Eventos</Link>
          <Link to="/minhas-inscricoes" className={linkCls} activeProps={active}>Minhas inscrições</Link>
          {me?.isOrganizer && (
            <Link to="/organizador" className={linkCls} activeProps={active}>Organizador</Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">{me?.name}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
