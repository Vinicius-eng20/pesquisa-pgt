import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useOrders } from "@/lib/use-orders";
import { OrderCard } from "@/components/OrderCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Sabor da Casa" },
      { name: "description", content: "Acompanhe a situação dos seus pedidos." },
      { property: "og:title", content: "Meus pedidos — Sabor da Casa" },
      { property: "og:description", content: "Acompanhe a situação dos seus pedidos." },
    ],
  }),
  component: MyOrders,
});

function MyOrders() {
  const { user } = useAuth();
  const { data = [], isLoading } = useOrders("mine");
  const mine = data.filter((o) => o.user_id === user?.id);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-4xl font-semibold">Meus pedidos</h1>
      <p className="mt-1 text-muted-foreground">A situação atualiza sozinha quando o restaurante muda.</p>
      <div className="mt-6 space-y-4">
        {isLoading && <p className="text-muted-foreground">Carregando...</p>}
        {!isLoading && mine.length === 0 && (
          <div className="rounded-xl border bg-card p-8 text-center">
            <p className="text-muted-foreground">Você ainda não fez pedidos.</p>
            <Button asChild className="mt-4"><Link to="/">Ver cardápio</Link></Button>
          </div>
        )}
        {mine.map((o) => <OrderCard key={o.id} order={o} />)}
      </div>
    </div>
  );
}
