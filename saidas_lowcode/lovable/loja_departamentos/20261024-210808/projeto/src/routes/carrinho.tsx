import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginPrompt } from "@/components/LoginPrompt";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Galeria" },
      { name: "description", content: "Revise seus itens e finalize o pedido." },
      { property: "og:title", content: "Carrinho — Galeria" },
      { property: "og:description", content: "Revise seus itens e finalize o pedido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarrinhoPage,
});

function CarrinhoPage() {
  const { session, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const uid = session?.user.id;
  const [form, setForm] = useState({ name: "", address: "", phone: "" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["cart-items", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, quantity, products(id, name, price, image_url, stock)")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["cart-items"] });
    qc.invalidateQueries({ queryKey: ["cart"] });
  };

  const setQty = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } =
        quantity <= 0
          ? await supabase.from("cart_items").delete().eq("id", id)
          : await supabase.from("cart_items").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const place = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("place_order", {
        _customer_name: form.name,
        _address: form.address,
        _phone: form.phone,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido realizado!");
      refresh();
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/pedidos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return null;
  if (!session) return <LoginPrompt text="Para usar o carrinho, entre na sua conta." />;

  const total = items.reduce((s, i) => s + (i.products?.price ?? 0) * i.quantity, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Seu carrinho</h1>
      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border bg-card p-10 text-center">
          <p className="text-muted-foreground">Seu carrinho está vazio.</p>
          <Button asChild className="mt-4">
            <Link to="/">Ver produtos</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 rounded-xl border bg-card p-3">
                {i.products?.image_url && (
                  <img src={i.products.image_url} alt="" className="size-20 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{i.products?.name}</p>
                  <p className="text-sm text-muted-foreground">{formatBRL(i.products?.price ?? 0)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" onClick={() => setQty.mutate({ id: i.id, quantity: i.quantity - 1 })}>
                    <Minus />
                  </Button>
                  <span className="w-8 text-center">{i.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={i.quantity >= (i.products?.stock ?? 0)}
                    onClick={() => setQty.mutate({ id: i.id, quantity: i.quantity + 1 })}
                  >
                    <Plus />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setQty.mutate({ id: i.id, quantity: 0 })}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <form
            className="h-fit space-y-4 rounded-xl border bg-card p-5 shadow-card"
            onSubmit={(e) => {
              e.preventDefault();
              place.mutate();
            }}
          >
            <h2 className="text-xl font-semibold">Finalizar pedido</h2>
            <div className="space-y-1.5">
              <Label htmlFor="n">Nome completo</Label>
              <Input id="n" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a">Endereço de entrega</Label>
              <Input id="a" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Telefone</Label>
              <Input id="p" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="flex justify-between border-t pt-4 text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatBRL(total)}</span>
            </div>
            <Button type="submit" className="w-full" disabled={place.isPending}>
              Confirmar pedido
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
