import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, contractStatusLabel, useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/contratos")({
  head: () => ({ meta: [{ title: "Meus contratos — Ofício" }, { name: "description", content: "Contratos de que você participa." }] }),
  component: Contracts,
});

export const CONTRACT_SELECT =
  "*, services(title), client:profiles!contracts_client_id_fkey(display_name), provider:profiles!contracts_provider_id_fkey(display_name)";

export type ContractRow = {
  id: string; status: string; price: number; message: string; created_at: string;
  client_id: string; provider_id: string;
  services: { title: string } | null;
  client: { display_name: string } | null;
  provider: { display_name: string } | null;
};

function Contracts() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["contracts", "mine", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts").select(CONTRACT_SELECT)
        .or(`client_id.eq.${me!.id},provider_id.eq.${me!.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ContractRow[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "completed" | "cancelled" }) => {
      const { error } = await supabase.from("contracts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contrato atualizado."); qc.invalidateQueries({ queryKey: ["contracts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="text-4xl font-semibold">Meus contratos</h1>
      {rows.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Nenhum contrato ainda.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((c) => {
            const iAmProvider = c.provider_id === me?.id;
            const open = c.status === "requested" || c.status === "accepted";
            return (
              <li key={c.id} className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline">{iAmProvider ? "Você presta" : "Você contratou"}</Badge>
                  <p className="flex-1 font-semibold">{c.services?.title ?? "Serviço"}</p>
                  <span className="font-display text-xl text-primary">{brl(c.price)}</span>
                  <Badge variant={c.status === "cancelled" ? "destructive" : c.status === "completed" ? "default" : "secondary"}>
                    {contractStatusLabel[c.status]}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {iAmProvider ? `Cliente: ${c.client?.display_name}` : `Prestador: ${c.provider?.display_name}`} · {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
                {c.message && <p className="mt-2 text-sm italic">“{c.message}”</p>}
                {open && !me?.suspended && (
                  <div className="mt-4 flex gap-2">
                    {iAmProvider && c.status === "requested" && <Button size="sm" onClick={() => setStatus.mutate({ id: c.id, status: "accepted" })}>Aceitar</Button>}
                    {iAmProvider && c.status === "accepted" && <Button size="sm" onClick={() => setStatus.mutate({ id: c.id, status: "completed" })}>Marcar como concluído</Button>}
                    <Button size="sm" variant="outline" onClick={() => confirm("Cancelar este contrato?") && setStatus.mutate({ id: c.id, status: "cancelled" })}>Cancelar</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
