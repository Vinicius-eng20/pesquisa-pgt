import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useDishes } from "@/lib/dishes";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, brl } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cardápio — Sabor da Casa" },
      { name: "description", content: "Veja o cardápio do Sabor da Casa e faça seu pedido online." },
      { property: "og:title", content: "Cardápio — Sabor da Casa" },
      { property: "og:description", content: "Veja o cardápio do Sabor da Casa e faça seu pedido online." },
    ],
  }),
  component: Menu,
});

function Menu() {
  const { data: dishes = [], isLoading } = useDishes();
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const available = dishes.filter((d) => d.available);
  const categories = [...new Set(available.map((d) => d.category))];

  const order = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("place_order", {
      _items: cart.items.map((i) => ({ dish_id: i.dish_id, quantity: i.quantity })),
      _notes: notes,
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível enviar o pedido: " + error.message);
      return;
    }
    cart.clear();
    setNotes("");
    toast.success("Pedido enviado!");
    navigate({ to: "/pedidos" });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section>
        <h1 className="text-4xl font-semibold">Cardápio</h1>
        <p className="mt-1 text-muted-foreground">Comida caseira, feita na hora.</p>
        {isLoading && <p className="mt-8 text-muted-foreground">Carregando...</p>}
        {categories.map((cat) => (
          <div key={cat} className="mt-8">
            <h2 className="mb-3 text-2xl font-semibold text-primary">{cat}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {available.filter((d) => d.category === cat).map((d) => (
                <div key={d.id} className="flex flex-col rounded-xl border bg-card p-4">
                  {d.image_url && <img src={d.image_url} alt={d.name} className="mb-3 h-36 w-full rounded-lg object-cover" />}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{d.name}</h3>
                    <span className="whitespace-nowrap font-semibold">{brl(d.price)}</span>
                  </div>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{d.description}</p>
                  <Button variant="secondary" size="sm" className="mt-3 self-start" onClick={() => cart.add(d)}>
                    Adicionar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <aside className="h-fit rounded-xl border bg-card p-5 shadow-warm lg:sticky lg:top-20">
        <h2 className="text-2xl font-semibold">Seu pedido</h2>
        {cart.items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum item ainda.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {cart.items.map((i) => (
                <li key={i.dish_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1">{i.name}</span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => cart.setQty(i.dish_id, i.quantity - 1)}>−</Button>
                    <span className="w-6 text-center">{i.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => cart.setQty(i.dish_id, i.quantity + 1)}>+</Button>
                  </div>
                  <span className="w-20 text-right">{brl(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <Textarea className="mt-4" placeholder="Observações (ex.: sem cebola)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="mt-4 flex justify-between border-t pt-3 text-lg font-semibold">
              <span>Total</span><span>{brl(cart.total)}</span>
            </div>
            {user ? (
              <Button className="mt-4 w-full" disabled={busy} onClick={order}>{busy ? "Enviando..." : "Fazer pedido"}</Button>
            ) : (
              <Button asChild className="mt-4 w-full"><Link to="/auth">Entre para fazer o pedido</Link></Button>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
