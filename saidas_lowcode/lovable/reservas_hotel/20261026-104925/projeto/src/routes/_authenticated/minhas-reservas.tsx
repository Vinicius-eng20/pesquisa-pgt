import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/minhas-reservas")({
  head: () => ({
    meta: [
      { title: "Minhas reservas — Casa Jardim" },
      { name: "description", content: "Veja e cancele suas reservas no Casa Jardim." },
      { property: "og:title", content: "Minhas reservas — Casa Jardim" },
      { property: "og:description", content: "Veja e cancele suas reservas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyBookings,
});

function MyBookings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, rooms(name)")
        .eq("user_id", user!.id)
        .order("check_in", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancel = async (id: string) => {
    if (!confirm("Cancelar esta reserva?")) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Reserva cancelada.");
    qc.invalidateQueries();
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-5xl text-primary">Minhas reservas</h1>
      {isLoading && <p className="mt-6 text-muted-foreground">Carregando…</p>}
      {data?.length === 0 && <p className="mt-6 text-muted-foreground">Você ainda não fez nenhuma reserva.</p>}
      <div className="mt-8 space-y-4">
        {data?.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl">{b.rooms?.name ?? "Quarto removido"}</h2>
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {b.guests} hóspede(s) · {brl(b.total_price)}
              </p>
            </div>
            {(b.status === "pending" || b.status === "confirmed") && (
              <Button variant="outline" onClick={() => cancel(b.id)}>Cancelar</Button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
