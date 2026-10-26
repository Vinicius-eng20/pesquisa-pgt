import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("full_name, active").eq("id", data.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    ]);
    if (!profile?.active) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { desativada: "1" } });
    }
    const isAdmin = !!roles?.some((r) => r.role === "admin");
    return { user: data.user, name: profile.full_name || data.user.email || "", isAdmin };
  },
  component: Layout,
});

function Layout() {
  const { name, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const link = "rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
  const active = "bg-primary text-primary-foreground hover:text-primary-foreground";

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/painel" className="flex items-center gap-2 font-display text-xl font-bold text-primary">
            <Wallet className="h-5 w-5" /> Caderneta
          </Link>
          <nav className="flex gap-1">
            <Link to="/painel" className={link} activeProps={{ className: active }}>
              Meus gastos
            </Link>
            {isAdmin && (
              <Link to="/admin" className={link} activeProps={{ className: active }}>
                Administração
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>
            <Button variant="ghost" size="sm" onClick={sair}>
              <LogOut /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
