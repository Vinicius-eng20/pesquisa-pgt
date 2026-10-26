import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, fmtDate } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/gerente")({
  head: () => ({
    meta: [
      { title: "Painel do gerente — Casa Jardim" },
      { name: "description", content: "Gerencie quartos e reservas do Casa Jardim." },
      { property: "og:title", content: "Painel do gerente — Casa Jardim" },
      { property: "og:description", content: "Gerencie quartos e reservas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagerPage,
});

type Room = Tables<"rooms">;

function ManagerPage() {
  const { isManager, loading } = useAuth();
  if (loading) return <main className="mx-auto max-w-6xl px-4 py-12 text-muted-foreground">Carregando…</main>;
  if (!isManager)
    return <main className="mx-auto max-w-6xl px-4 py-12">Esta área é só para o gerente do hotel.</main>;
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-5xl text-primary">Painel do gerente</h1>
      <Tabs defaultValue="bookings" className="mt-8">
        <TabsList>
          <TabsTrigger value="bookings">Reservas</TabsTrigger>
          <TabsTrigger value="rooms">Quartos</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings"><AllBookings /></TabsContent>
        <TabsContent value="rooms"><RoomsAdmin /></TabsContent>
      </Tabs>
    </main>
  );
}

function AllBookings() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const { data } = useQuery({
    queryKey: ["all-bookings"],
    queryFn: async () => {
      const [{ data: b, error }, { data: p }] = await Promise.all([
        supabase.from("bookings").select("*, rooms(name)").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      if (error) throw error;
      const byId = new Map((p ?? []).map((x) => [x.id, x]));
      return (b ?? []).map((x) => ({ ...x, guest: byId.get(x.user_id) }));
    },
  });

  const setStatus = async (id: string, status: "confirmed" | "rejected") => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "confirmed" ? "Reserva confirmada." : "Reserva recusada.");
    qc.invalidateQueries();
  };

  const list = (data ?? []).filter((b) => filter === "all" || b.status === filter);
  const filters: [string, string][] = [
    ["all", "Todas"], ["pending", "Aguardando"], ["confirmed", "Confirmadas"], ["rejected", "Recusadas"], ["cancelled", "Canceladas"],
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        {filters.map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{l}</Button>
        ))}
      </div>
      {list.length === 0 && <p className="mt-6 text-muted-foreground">Nenhuma reserva aqui.</p>}
      <div className="mt-6 space-y-3">
        {list.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl">{b.rooms?.name ?? "Quarto removido"}</h3>
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-1 text-sm">{b.guest?.full_name || "Hóspede"} · {b.guest?.email}</p>
              <p className="text-sm text-muted-foreground">
                {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {b.guests} hóspede(s) · {brl(b.total_price)}
              </p>
            </div>
            {b.status === "pending" && (
              <div className="flex gap-2">
                <Button onClick={() => setStatus(b.id, "confirmed")}>Confirmar</Button>
                <Button variant="outline" onClick={() => setStatus(b.id, "rejected")}>Recusar</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomsAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Room> | null>(null);
  const { data } = useQuery({
    queryKey: ["rooms-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rooms").select("*").order("price_per_night");
      if (error) throw error;
      return data;
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Remover este quarto? As reservas dele também serão apagadas.")) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Quarto removido.");
    qc.invalidateQueries();
  };

  return (
    <div className="mt-6">
      <Button onClick={() => setEditing({ name: "", description: "", capacity: 2, price_per_night: 0, image_url: "" })}>
        Cadastrar quarto
      </Button>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {data?.map((r) => (
          <div key={r.id} className="rounded-lg border bg-card p-5">
            <h3 className="text-2xl">{r.name}</h3>
            <p className="text-sm text-muted-foreground">{brl(r.price_per_night)} / noite · até {r.capacity} pessoas</p>
            <p className="mt-2 text-sm">{r.description}</p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(r)}>Editar</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}>Remover</Button>
            </div>
          </div>
        ))}
      </div>
      <RoomDialog room={editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries()} />
    </div>
  );
}

function RoomDialog({ room, onClose, onSaved }: { room: Partial<Room> | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Room>>({});
  const [lastRoom, setLastRoom] = useState<Partial<Room> | null>(null);
  if (room !== lastRoom) {
    setLastRoom(room);
    setForm(room ?? {});
  }
  const set = (k: keyof Room, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name ?? "",
      description: form.description ?? "",
      capacity: Number(form.capacity) || 1,
      price_per_night: Number(form.price_per_night) || 0,
      image_url: form.image_url || null,
    };
    const { error } = form.id
      ? await supabase.from("rooms").update(payload).eq("id", form.id)
      : await supabase.from("rooms").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Quarto salvo.");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!room} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{form.id ? "Editar quarto" : "Novo quarto"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5"><Label>Nome</Label><Input required value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Capacidade</Label><Input type="number" min={1} required value={form.capacity ?? 1} onChange={(e) => set("capacity", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Preço por noite (R$)</Label><Input type="number" min={0} step="0.01" required value={form.price_per_night ?? 0} onChange={(e) => set("price_per_night", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Link de uma foto (opcional)</Label><Input value={form.image_url ?? ""} onChange={(e) => set("image_url", e.target.value)} /></div>
          <Button type="submit" className="w-full">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
