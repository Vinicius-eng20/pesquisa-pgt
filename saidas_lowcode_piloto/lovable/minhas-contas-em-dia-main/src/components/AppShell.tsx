import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet, LogOut, ShieldCheck, LayoutDashboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const linkCls =
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
  const activeCls = "bg-ink text-ink-foreground hover:text-ink-foreground";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/painel" className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Wallet className="h-5 w-5" />
            </span>
            Meu Bolso
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/painel" className={linkCls} activeProps={{ className: activeCls }}>
              <LayoutDashboard className="h-4 w-4" /> Meus gastos
            </Link>
            {me?.isAdmin && (
              <Link to="/admin" className={linkCls} activeProps={{ className: activeCls }}>
                <ShieldCheck className="h-4 w-4" /> Administração
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? null : me && !me.active ? (
          <div className="rounded-2xl border bg-card p-8 text-center shadow-soft">
            <h1 className="text-2xl font-bold">Conta desativada</h1>
            <p className="mt-2 text-muted-foreground">
              Sua conta foi desativada pelo administrador. Entre em contato com ele para reativá-la.
            </p>
            <Button className="mt-6" onClick={signOut}>Sair</Button>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
