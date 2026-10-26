import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLiveUpdates } from "@/hooks/use-live";
import { fmtDate, fmtPrice, fmtTime } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agenda — Serviços e horários livres" },
      { name: "description", content: "Escolha um serviço, veja os horários livres e marque o seu." },
      { property: "og:title", content: "Agenda — Serviços e horários livres" },
      { property: "og:description", content: "Escolha um serviço, veja os horários livres e marque o seu." },
    ],
  }),
  component: Index,
});

function Index() {
  useLiveUpdates();
  const [selected, setSelected] = useState<string | null>(null);
  const services = useQuery({
    queryKey: ["services", "public"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <section className="bg-hero -mx-4 px-4 pb-10 pt-14">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">
          Marque seu horário em poucos toques.
        </h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Escolha o serviço, veja os horários livres e pronto — você recebe a confirmação aqui mesmo.
        </p>
      </section>

      {services.isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {services.data?.length === 0 && (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          Ainda não há serviços cadastrados.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {services.data?.map((s) => (
          <article
            key={s.id}
            className={`rounded-2xl border bg-card p-6 shadow-soft transition ${selected === s.id ? "ring-2 ring-primary md:col-span-2" : ""}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{s.name}</h2>
                {s.description && <p className="mt-1 text-muted-foreground">{s.description}</p>}
                <p className="mt-3 flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" /> {s.duration_min} min
                  </span>
                  <span className="font-semibold text-primary">{fmtPrice(s.price)}</span>
                </p>
              </div>
              <Button variant={selected === s.id ? "secondary" : "default"} onClick={() => setSelected(selected === s.id ? null : s.id)}>
                {selected === s.id ? "Fechar" : "Ver horários"}
              </Button>
            </div>
            {selected === s.id && <SlotPicker serviceId={s.id} />}
          </article>
        ))}
      </div>
    </>
  );
}

function SlotPicker({ serviceId }: { serviceId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const slots = useQuery({
    queryKey: ["slots", serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slots")
        .select("*")
        .eq("service_id", serviceId)
        .eq("booked", false)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  const book = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase.from("bookings").insert({ slot_id: slotId, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido enviado! Aguarde a confirmação.");
      qc.invalidateQueries();
      navigate({ to: "/meus-agendamentos" });
    },
    onError: () => toast.error("Esse horário acabou de ser ocupado. Escolha outro."),
  });

  const groups = new Map<string, NonNullable<typeof slots.data>>();
  for (const sl of slots.data ?? []) {
    const k = new Date(sl.starts_at).toDateString();
    groups.set(k, [...(groups.get(k) ?? []), sl]);
  }

  return (
    <div className="mt-6 border-t pt-5">
      {slots.isLoading && <p className="text-sm text-muted-foreground">Carregando horários…</p>}
      {slots.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário livre no momento.</p>}
      {!user && slots.data && slots.data.length > 0 && (
        <p className="mb-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
          Para marcar, você precisa <button className="font-semibold underline" onClick={() => navigate({ to: "/auth" })}>entrar ou criar conta</button>.
        </p>
      )}
      <div className="space-y-5">
        {[...groups.values()].map((list) => (
          <div key={list[0].id}>
            <h3 className="mb-2 text-base font-semibold capitalize">{fmtDate(list[0].starts_at)}</h3>
            <div className="flex flex-wrap gap-2">
              {list.map((sl) => (
                <Button
                  key={sl.id}
                  variant="outline"
                  disabled={!user || book.isPending}
                  onClick={() => {
                    if (confirm(`Marcar para ${fmtDate(sl.starts_at)} às ${fmtTime(sl.starts_at)}?`)) book.mutate(sl.id);
                  }}
                >
                  {fmtTime(sl.starts_at)}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
