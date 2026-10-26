import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const linkCls = "rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground";
  const active = { className: "rounded-full px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground" };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/explorar" className="font-display text-2xl font-semibold text-primary">ofício</Link>
          <nav className="flex flex-wrap gap-1">
            <Link to="/explorar" className={linkCls} activeProps={active}>Explorar</Link>
            <Link to="/meus-servicos" className={linkCls} activeProps={active}>Meus serviços</Link>
            <Link to="/contratos" className={linkCls} activeProps={active}>Contratos</Link>
            {me?.isAdmin && <Link to="/admin" className={linkCls} activeProps={active}>Administração</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{me?.name}</span>
            <Button variant="outline" size="sm" onClick={signOut}>Sair</Button>
          </div>
        </div>
      </header>
      {me?.suspended && (
        <div className="bg-destructive px-4 py-2 text-center text-sm text-destructive-foreground">
          Sua conta está suspensa. Você pode ver suas informações, mas não pode publicar nem contratar serviços.
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
