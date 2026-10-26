import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Package, Settings, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function SiteHeader() {
  const { session, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const uid = session?.user.id;
  const { data: count = 0 } = useQuery({
    queryKey: ["cart", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("cart_items").select("quantity");
      return (data ?? []).reduce((s, r) => s + r.quantity, 0);
    },
    select: (d) => (typeof d === "number" ? d : 0),
  });

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="font-display text-2xl font-semibold text-foreground">
          Galeria<span className="text-primary">.</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">
                <Settings /> <span className="hidden sm:inline">Gerenciar loja</span>
              </Link>
            </Button>
          )}
          {session && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/pedidos">
                <Package /> <span className="hidden sm:inline">Meus pedidos</span>
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="relative">
            <Link to="/carrinho">
              <ShoppingBag /> <span className="hidden sm:inline">Carrinho</span>
              {count > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>
          {session ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut /> <span className="hidden sm:inline">Sair</span>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/entrar">
                <User /> Entrar
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
