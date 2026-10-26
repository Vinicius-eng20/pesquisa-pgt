import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoginPrompt } from "@/components/LoginPrompt";
import { OrderCard } from "@/components/OrderCard";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, STATUS_LABEL, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Gerenciar loja — Galeria" },
      { name: "description", content: "Área do dono da loja: produtos e pedidos." },
      { property: "og:title", content: "Gerenciar loja — Galeria" },
      { property: "og:description", content: "Área do dono da loja: produtos e pedidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type ProductForm = {
  id?: string;
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  image_url: string;
  active: boolean;
};
const empty: ProductForm = {
  name: "",
  description: "",
  category: "",
  price: "",
  stock: "0",
  image_url: "",
  active: true,
};

function AdminPage() {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!session) return <LoginPrompt text="Entre com a conta do dono da loja." />;
  if (!isAdmin)
    return (
      <p className="py-24 text-center text-muted-foreground">Esta área é só para o dono da loja.</p>
    );
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Gerenciar loja</h1>
      <Tabs defaultValue="pedidos" className="mt-6">
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>
        <TabsContent value="pedidos">
          <AdminOrders />
        </TabsContent>
        <TabsContent value="produtos">
          <AdminProducts />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminOrders() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["all-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: status as "pendente" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Situação atualizada");
      qc.invalidateQueries({ queryKey: ["all-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="mt-6 text-muted-foreground">Carregando…</p>;
  if (orders.length === 0) return <p className="mt-6 text-muted-foreground">Nenhum pedido ainda.</p>;
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {orders.map((o) => (
        <OrderCard
          key={o.id}
          order={o}
          action={
            <Select value={o.status} onValueChange={(v) => update.mutate({ id: o.id, status: v })}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      ))}
    </div>
  );
}

function AdminProducts() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const save = useMutation({
    mutationFn: async (f: ProductForm) => {
      const row = {
        name: f.name,
        description: f.description,
        category: f.category || "Geral",
        price: Number(f.price.replace(",", ".")),
        stock: parseInt(f.stock) || 0,
        image_url: f.image_url || null,
        active: f.active,
      };
      const { error } = f.id
        ? await supabase.from("products").update(row).eq("id", f.id)
        : await supabase.from("products").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto salvo");
      setEditing(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto removido");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6">
      <Button onClick={() => setEditing({ ...empty })}>
        <Plus /> Novo produto
      </Button>
      <div className="mt-4 divide-y rounded-xl border bg-card">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-4 p-3">
            {p.image_url ? (
              <img src={p.image_url} alt="" className="size-14 rounded-lg object-cover" />
            ) : (
              <div className="size-14 rounded-lg bg-muted" />
            )}
            <div className="flex-1">
              <p className="font-semibold">
                {p.name} {!p.active && <span className="text-xs text-muted-foreground">(oculto)</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                {p.category} · {formatBRL(p.price)} · {p.stock} em estoque
              </p>
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={() =>
                setEditing({
                  id: p.id,
                  name: p.name,
                  description: p.description,
                  category: p.category,
                  price: String(p.price),
                  stock: String(p.stock),
                  image_url: p.image_url ?? "",
                  active: p.active,
                })
              }
            >
              <Pencil />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (confirm(`Remover "${p.name}"?`)) remove.mutate(p.id);
              }}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(editing);
              }}
            >
              <Field label="Nome">
                <Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="Descrição">
                <Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Categoria">
                  <Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                </Field>
                <Field label="Preço (R$)">
                  <Input required inputMode="decimal" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
                </Field>
                <Field label="Estoque">
                  <Input type="number" min={0} value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} />
                </Field>
              </div>
              <Field label="Link da foto">
                <Input placeholder="https://..." value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                Mostrar na loja
              </label>
              <Button type="submit" className="w-full" disabled={save.isPending}>
                Salvar
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
