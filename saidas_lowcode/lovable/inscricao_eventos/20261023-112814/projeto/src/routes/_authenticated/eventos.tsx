import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, friendlyError, useMe } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos disponíveis — Inscreva" },
      { name: "description", content: "Veja os próximos eventos e faça sua inscrição." },
      { property: "og:title", content: "Eventos disponíveis — Inscreva" },
      { property: "og:description", content: "Veja os próximos eventos e faça sua inscrição." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventsPage,
});

function useEventsData() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const [{ data: events, error }, { data: counts }] = await Promise.all([
        supabase.from("events").select("*").order("starts_at"),
        supabase.rpc("event_counts"),
      ]);
      if (error) throw error;
      const map = new Map((counts ?? []).map((c) => [c.event_id, Number(c.total)]));
      return (events ?? []).map((e) => ({ ...e, taken: map.get(e.id) ?? 0 }));
    },
  });
}

function EventsPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: events, isLoading } = useEventsData();
  const { data: mine } = useQuery({
    queryKey: ["my-registrations"],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("registrations").select("id, event_id").eq("user_id", me!.id);
      return data ?? [];
    },
  });

  const register = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("registrations").insert({ event_id: eventId, user_id: me!.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inscrição feita!"); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("registrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inscrição cancelada."); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const upcoming = (events ?? []).filter((e) => e.status === "active" && new Date(e.starts_at) > new Date());

  return (
    <div>
      <h1 className="text-4xl font-semibold">Eventos disponíveis</h1>
      <p className="mt-2 text-muted-foreground">Escolha um evento e garanta sua vaga.</p>
      {isLoading && <p className="mt-8 text-muted-foreground">Carregando...</p>}
      {!isLoading && upcoming.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhum evento aberto no momento.
        </div>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {upcoming.map((ev) => {
          const reg = mine?.find((r) => r.event_id === ev.id);
          const full = ev.capacity != null && ev.taken >= ev.capacity;
          return (
            <article key={ev.id} className="flex flex-col rounded-xl border bg-card p-6 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-2xl font-semibold">{ev.title}</h2>
                {reg && <Badge className="bg-success text-success-foreground">Inscrito</Badge>}
              </div>
              {ev.description && <p className="mt-2 text-sm text-muted-foreground">{ev.description}</p>}
              <ul className="mt-4 space-y-1.5 text-sm">
                <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-accent" />{formatDate(ev.starts_at)}</li>
                {ev.location && <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" />{ev.location}</li>}
                <li className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" />
                  {ev.capacity != null ? `${ev.taken} de ${ev.capacity} vagas preenchidas` : `${ev.taken} inscritos`}
                </li>
              </ul>
              <div className="mt-auto pt-5">
                {reg ? (
                  <Button variant="outline" className="w-full" disabled={cancel.isPending} onClick={() => cancel.mutate(reg.id)}>
                    Cancelar inscrição
                  </Button>
                ) : (
                  <Button className="w-full" disabled={full || register.isPending} onClick={() => register.mutate(ev.id)}>
                    {full ? "Esgotado" : "Inscrever-se"}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
