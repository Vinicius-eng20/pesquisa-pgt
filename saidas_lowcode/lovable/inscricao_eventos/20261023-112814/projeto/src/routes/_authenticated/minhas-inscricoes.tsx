import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, friendlyError, useMe } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/minhas-inscricoes")({
  head: () => ({
    meta: [
      { title: "Minhas inscrições — Inscreva" },
      { name: "description", content: "Veja e cancele suas inscrições em eventos." },
      { property: "og:title", content: "Minhas inscrições — Inscreva" },
      { property: "og:description", content: "Veja e cancele suas inscrições em eventos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyRegistrations,
});

function MyRegistrations() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-registrations-full"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("id, attended, created_at, events(id, title, starts_at, location, status)")
        .eq("user_id", me!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("registrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inscrição cancelada."); qc.invalidateQueries(); },
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <div>
      <h1 className="text-4xl font-semibold">Minhas inscrições</h1>
      {isLoading && <p className="mt-8 text-muted-foreground">Carregando...</p>}
      {!isLoading && data?.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Você ainda não se inscreveu em nenhum evento.{" "}
          <Link to="/eventos" className="font-medium text-foreground underline">Ver eventos</Link>
        </div>
      )}
      <div className="mt-8 space-y-3">
        {data?.map((r) => {
          const ev = r.events;
          if (!ev) return null;
          const past = new Date(ev.starts_at) < new Date();
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-card">
              <div className="mr-auto">
                <h2 className="text-xl font-semibold">{ev.title}</h2>
                <p className="text-sm text-muted-foreground">{formatDate(ev.starts_at)}{ev.location ? ` · ${ev.location}` : ""}</p>
              </div>
              {ev.status === "cancelled" && <Badge variant="destructive">Evento cancelado</Badge>}
              {r.attended && <Badge className="bg-success text-success-foreground">Presença confirmada</Badge>}
              {!past && ev.status === "active" && (
                <Button variant="outline" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>
                  Cancelar inscrição
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
