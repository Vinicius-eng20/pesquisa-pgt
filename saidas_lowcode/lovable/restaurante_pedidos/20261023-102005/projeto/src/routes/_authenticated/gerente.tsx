import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, STATUS_LABEL, brl } from "@/lib/auth";
import { useOrders } from "@/lib/use-orders";
import { useDishes } from "@/lib/dishes";
import { OrderCard } from "@/components/OrderCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/gerente")({
  head: () => ({
    meta: [
      { title: "Painel do gerente — Sabor da Casa" },
      { name: "description", content: "Gerencie o cardápio e os pedidos do restaurante." },
      { property: "og:title", content: "Painel do gerente — Sabor da Casa" },
      { property: "og:description", content: "Gerencie o cardápio e os pedidos do restaurante." },
    ],
  }),
  component: Manager,
});

function Manager() {
  const { isManager, loading } = useAuth();
  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!isManager) return <p className="text-muted-foreground">Esta área é só para o gerente do restaurante.</p>;
  return (
    <div>
      <h1 className="text-4xl font-semibold">Painel do gerente</h1>
      <Tabs defaultValue="pedidos" className="mt-6">
        <TabsList>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="cardapio">Cardápio</TabsTrigger>
        </TabsList>
        <TabsContent value="pedidos"><AllOrders /></TabsContent>
        <TabsContent value="cardapio"><DishesAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

function AllOrders() {
  const { data = [], isLoading, refetch } = useOrders("all");
  const [filter, setFilter] = useState("ativos");
  const { data: names = {} } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name]));
    },
  });
  const shown = data.filter((o) =>
    filter === "todos" ? true : filter === "ativos" ? !["entregue", "cancelado"].includes(o.status) : o.status === filter,
  );
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status: status as never }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Situação atualizada"); refetch(); }
  };
  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center gap-3">
        <Label>Mostrar:</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Em andamento</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {!isLoading && shown.length === 0 && <p className="text-muted-foreground">Nenhum pedido aqui.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            title={names[o.user_id] || "Cliente"}
            actions={
              <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            }
          />
        ))}
      </div>
    </div>
  );
}

type DishForm = { id?: string; name: string; description: string; category: string; price: string; image_url: string; available: boolean };
const empty: DishForm = { name: "", description: "", category: "Pratos", price: "", image_url: "", available: true };

function DishesAdmin() {
  const { data: dishes = [] } = useDishes();
  const qc = useQueryClient();
  const [form, setForm] = useState<DishForm | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["dishes"] });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const price = Number(form.price.replace(",", "."));
    if (!form.name.trim() || isNaN(price) || price < 0) { toast.error("Preencha nome e preço válidos."); return; }
    const row = { name: form.name.trim(), description: form.description, category: form.category.trim() || "Pratos", price, image_url: form.image_url || null, available: form.available };
    const { error } = form.id
      ? await supabase.from("dishes").update(row).eq("id", form.id)
      : await supabase.from("dishes").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success("Prato salvo");
    setForm(null);
    refresh();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}" do cardápio?`)) return;
    const { error } = await supabase.from("dishes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Prato removido"); refresh(); }
  };

  return (
    <div className="mt-4">
      <Button onClick={() => setForm(empty)}>+ Novo prato</Button>
      <div className="mt-4 divide-y rounded-xl border bg-card">
        {dishes.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{d.name} {!d.available && <span className="text-sm font-normal text-muted-foreground">(indisponível)</span>}</p>
              <p className="text-sm text-muted-foreground">{d.category} · {brl(d.price)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setForm({ id: d.id, name: d.name, description: d.description, category: d.category, price: String(d.price), image_url: d.image_url ?? "", available: d.available })}>Editar</Button>
            <Button variant="destructive" size="sm" onClick={() => remove(d.id, d.name)}>Remover</Button>
          </div>
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar prato" : "Novo prato"}</DialogTitle></DialogHeader>
          {form && (
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div className="space-y-1"><Label>Preço (R$)</Label><Input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
              </div>
              <div className="space-y-1"><Label>Link da foto (opcional)</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} /><Label>Disponível no cardápio</Label></div>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
