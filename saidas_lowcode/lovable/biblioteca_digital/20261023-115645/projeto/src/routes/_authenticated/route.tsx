import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { meQuery } from "@/lib/library";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  const { data: me } = useQuery(meQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const link = "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary";
  const active = { className: "bg-secondary text-foreground" };

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to="/acervo" className="mr-4 font-display text-xl font-bold text-primary">Estante</Link>
          <nav className="flex flex-wrap gap-1">
            <Link to="/acervo" className={link} activeProps={active}>Acervo</Link>
            <Link to="/emprestimos" className={link} activeProps={active}>Meus empréstimos</Link>
            {me?.isLibrarian && <Link to="/painel" className={link} activeProps={active}>Painel do bibliotecário</Link>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{me?.name}</span>
            <Button size="sm" variant="outline" onClick={signOut}>Sair</Button>
          </div>
        </div>
      </header>
      {me?.blocked && (
        <div className="bg-destructive px-4 py-2 text-center text-sm text-destructive-foreground">
          Seus novos empréstimos estão bloqueados. Devolva os itens em atraso e procure o bibliotecário.
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8"><Outlet /></main>
    </div>
  );
}
