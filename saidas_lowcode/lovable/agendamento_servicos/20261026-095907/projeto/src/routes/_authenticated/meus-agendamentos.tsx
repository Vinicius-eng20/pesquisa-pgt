import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLiveUpdates } from "@/hooks/use-live";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/meus-agendamentos")({
  head: () => ({
    meta: [
      { title: "Meus horários — Agenda" },
      { name: "description", content: "Veja e cancele os horários que você marcou." },
      { property: "og:title", content: "Meus horários — Agenda" },
      { property: "og:description", content: "Veja e cancele os horários que você marcou." },
    ],
  }),
  component: MyBookings,
});

function MyBookings() {
  useLiveUpdates();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, slots(starts_at, services(name))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      qc.invalidateQueries();
    },
    onError: () => toast.error("Não foi possível cancelar."),
  });

  return (
    <div className="pt-10">
      <h1 className="text-4xl font-semibold">Meus horários</h1>
      <div className="mt-6 space-y-3">
        {q.data?.length === 0 && (
          <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
            Você ainda não marcou nenhum horário.
          </p>
        )}
        {q.data?.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5 shadow-soft">
            <div>
              <p className="text-lg font-semibold">{b.slots?.services?.name}</p>
              <p className="text-muted-foreground">{b.slots && fmtDateTime(b.slots.starts_at)}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={b.status} />
              {(b.status === "pending" || b.status === "confirmed") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => confirm("Cancelar este horário?") && cancel.mutate(b.id)}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
