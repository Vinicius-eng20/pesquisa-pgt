import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, friendlyError, useMe } from "@/lib/session";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/organizador")({
  head: () => ({
    meta: [
      { title: "Painel do organizador — Inscreva" },
      { name: "description", content: "Crie e gerencie eventos e confirme a presença dos inscritos." },
      { property: "og:title", content: "Painel do organizador — Inscreva" },
      { property: "og:description", content: "Crie e gerencie eventos e confirme a presença dos inscritos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrganizerPage,
});

type EventRow = Tables<"events">;

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function OrganizerPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EventRow | "new" | null>(null);

  const { data: events } = useQuery({
    queryKey: ["org-events"],
    enabled: !!me?.isOrganizer,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: regs } = useQuery({
    queryKey: ["org-registrations"],
    enabled: !!me?.isOrganizer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("id, attended, created_at, event_id, profiles(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("events").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.status === "cancelled" ? "Evento cancelado." : "Evento reativado."); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const setAttended = useMutation({
    mutationFn: async ({ id, attended }: { id: string; attended: boolean }) => {
      const { error } = await supabase.from("registrations").update({ attended }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-registrations"] }),
    onError: (e) => toast.error(friendlyError(e)),
  });

  if (meLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!me?.isOrganizer)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        Esta área é só para o organizador. <Link to="/eventos" className="underline">Voltar aos eventos</Link>
      </div>
    );

  const eventName = (id: string) => events?.find((e) => e.id === id)?.title ?? "";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">Painel do organizador</h1>
          <p className="mt-2 text-muted-foreground">Gerencie eventos e acompanhe os inscritos.</p>
        </div>
        <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Novo evento</Button>
      </div>

      <Tabs defaultValue="events" className="mt-8">
        <TabsList>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="all">Todas as inscrições ({regs?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-4 space-y-4">
          {events?.length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              Nenhum evento criado ainda. Clique em "Novo evento".
            </div>
          )}
          {events?.map((ev) => {
            const list = regs?.filter((r) => r.event_id === ev.id) ?? [];
            return (
              <details key={ev.id} className="group rounded-xl border bg-card p-5 shadow-card">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                  <div className="mr-auto">
                    <h2 className="text-xl font-semibold">{ev.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(ev.starts_at)}{ev.location ? ` · ${ev.location}` : ""} · {list.length}
                      {ev.capacity != null ? `/${ev.capacity}` : ""} inscritos · {list.filter((r) => r.attended).length} presentes
                    </p>
                  </div>
                  {ev.status === "cancelled" && <Badge variant="destructive">Cancelado</Badge>}
                  <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); setEditing(ev); }}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  {ev.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={(e) => {
                      e.preventDefault();
                      if (confirm("Cancelar este evento? Os inscritos verão que ele foi cancelado.")) setStatus.mutate({ id: ev.id, status: "cancelled" });
                    }}>Cancelar evento</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); setStatus.mutate({ id: ev.id, status: "active" }); }}>
                      Reativar
                    </Button>
                  )}
                </summary>
                <div className="mt-4 border-t pt-4">
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ninguém inscrito ainda.</p>
                  ) : (
                    <ul className="divide-y">
                      {list.map((r) => (
                        <li key={r.id} className="flex items-center gap-3 py-2">
                          <Checkbox
                            id={r.id}
                            checked={r.attended}
                            onCheckedChange={(v) => setAttended.mutate({ id: r.id, attended: v === true })}
                          />
                          <label htmlFor={r.id} className="mr-auto cursor-pointer">
                            <span className="font-medium">{r.profiles?.full_name || "Sem nome"}</span>
                            <span className="ml-2 text-sm text-muted-foreground">{r.profiles?.email}</span>
                          </label>
                          <span className="text-xs text-muted-foreground">{r.attended ? "Presente" : "Marcar presença"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            );
          })}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Participante</th><th className="p-3">E-mail</th>
                  <th className="p-3">Evento</th><th className="p-3">Inscrito em</th><th className="p-3">Presença</th>
                </tr>
              </thead>
              <tbody>
                {regs?.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium">{r.profiles?.full_name || "Sem nome"}</td>
                    <td className="p-3 text-muted-foreground">{r.profiles?.email}</td>
                    <td className="p-3">{eventName(r.event_id)}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                    <td className="p-3">
                      <Checkbox checked={r.attended} onCheckedChange={(v) => setAttended.mutate({ id: r.id, attended: v === true })} />
                    </td>
                  </tr>
                ))}
                {regs?.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhuma inscrição ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <EventDialog
        event={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); qc.invalidateQueries(); }}
      />
    </div>
  );
}

function EventDialog({ event, onClose, onSaved }: { event: EventRow | "new" | null; onClose: () => void; onSaved: () => void }) {
  const open = event !== null;
  const ev = event && event !== "new" ? event : null;
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cap = String(f.get("capacity") || "").trim();
    const payload = {
      title: String(f.get("title")),
      description: String(f.get("description") || ""),
      location: String(f.get("location") || ""),
      starts_at: new Date(String(f.get("starts_at"))).toISOString(),
      capacity: cap ? Number(cap) : null,
    };
    setSaving(true);
    const { error } = ev
      ? await supabase.from("events").update(payload).eq("id", ev.id)
      : await supabase.from("events").insert(payload);
    setSaving(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success(ev ? "Evento atualizado." : "Evento criado.");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ev ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <form key={ev?.id ?? "new"} onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="title">Nome do evento</Label>
            <Input id="title" name="title" required defaultValue={ev?.title} /></div>
          <div className="space-y-1.5"><Label htmlFor="description">Descrição</Label>
            <Textarea id="description" name="description" defaultValue={ev?.description} /></div>
          <div className="space-y-1.5"><Label htmlFor="location">Local</Label>
            <Input id="location" name="location" defaultValue={ev?.location} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="starts_at">Data e hora</Label>
              <Input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={ev ? toLocalInput(ev.starts_at) : ""} /></div>
            <div className="space-y-1.5"><Label htmlFor="capacity">Vagas (vazio = sem limite)</Label>
              <Input id="capacity" name="capacity" type="number" min={1} defaultValue={ev?.capacity ?? ""} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
