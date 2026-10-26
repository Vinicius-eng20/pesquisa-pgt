import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LoginPrompt } from "@/components/LoginPrompt";
import { OrderCard } from "@/components/OrderCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Galeria" },
      { name: "description", content: "Acompanhe seus pedidos na Galeria." },
      { property: "og:title", content: "Meus pedidos — Galeria" },
      { property: "og:description", content: "Acompanhe seus pedidos na Galeria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PedidosPage,
});

function PedidosPage() {
  const { session, loading } = useAuth();
  const uid = session?.user.id;
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loading) return null;
  if (!session) return <LoginPrompt text="Entre para ver seus pedidos." />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Meus pedidos</h1>
      <div className="mt-8 space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : orders.length === 0 ? (
          <p className="text-muted-foreground">Você ainda não fez nenhum pedido.</p>
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} />)
        )}
      </div>
    </div>
  );
}
