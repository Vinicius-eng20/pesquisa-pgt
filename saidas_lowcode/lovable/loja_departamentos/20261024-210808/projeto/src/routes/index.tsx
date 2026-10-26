import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Galeria — Loja de departamentos online" },
      { name: "description", content: "Eletrônicos, moda, casa, esportes e beleza em um só lugar." },
      { property: "og:title", content: "Galeria — Loja de departamentos online" },
      { property: "og:description", content: "Eletrônicos, moda, casa, esportes e beleza em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [cat, setCat] = useState("Todos");
  const [q, setQ] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );
  const shown = products.filter(
    (p) =>
      (cat === "Todos" || p.category === cat) &&
      p.name.toLowerCase().includes(q.toLowerCase()),
  );

  const add = useMutation({
    mutationFn: async (productId: string) => {
      const uid = session!.user.id;
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("product_id", productId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + 1 })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: uid, product_id: productId, quantity: 1 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Adicionado ao carrinho");
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <section className="bg-hero text-secondary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="text-sm uppercase tracking-[0.2em] opacity-80">Loja de departamentos</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold sm:text-6xl">
            Tudo o que você procura, num só lugar.
          </h1>
          <p className="mt-4 max-w-lg opacity-85">
            Eletrônicos, moda, casa, esportes e beleza — escolha, coloque no carrinho e receba em casa.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={c === cat ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setCat(c)}
              >
                {c}
              </Button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <p className="py-16 text-center text-muted-foreground">Carregando produtos…</p>
        ) : shown.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">Nenhum produto encontrado.</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {shown.map((p) => (
              <article
                key={p.id}
                className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-card"
              >
                <div className="aspect-square bg-muted">
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      width={816}
                      height={816}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {p.category}
                  </span>
                  <h3 className="mt-1 font-sans text-base font-semibold">{p.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-auto flex items-end justify-between pt-4">
                    <span className="text-lg font-bold text-primary">{formatBRL(p.price)}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.stock > 0 ? `${p.stock} em estoque` : "Esgotado"}
                    </span>
                  </div>
                  {session ? (
                    <Button
                      className="mt-3"
                      disabled={p.stock <= 0 || add.isPending}
                      onClick={() => add.mutate(p.id)}
                    >
                      Adicionar ao carrinho
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="mt-3">
                      <Link to="/entrar">Entre para comprar</Link>
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
