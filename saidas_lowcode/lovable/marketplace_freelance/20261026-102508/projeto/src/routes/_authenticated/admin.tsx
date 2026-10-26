import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, contractStatusLabel, serviceStatusLabel, useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONTRACT_SELECT, type ContractRow } from "./contratos";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — Ofício" }, { name: "description", content: "Painel do administrador." }] }),
  component: Admin,
});

function Admin() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const isAdmin = !!me?.isAdmin;

  const services = useQuery({
    queryKey: ["services", "all"], enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("services")
        .select("*, profiles!services_owner_id_fkey(display_name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Array<{ id: string; title: string; category: string; price: number; status: string; profiles: { display_name: string } | null }>;
    },
  });
  const users = useQuery({
    queryKey: ["profiles", "all"], enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const contracts = useQuery({
    queryKey: ["contracts", "all"], enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select(CONTRACT_SELECT).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ContractRow[];
    },
  });

  const setSvc = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "removed" }) => {
      const { error } = await supabase.from("services").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Serviço atualizado."); qc.invalidateQueries({ queryKey: ["services"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setUser = useMutation({
    mutationFn: async ({ id, suspended }: { id: string; suspended: boolean }) => {
      const { error } = await supabase.from("profiles").update({ suspended }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Conta atualizada."); qc.invalidateQueries({ queryKey: ["profiles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;
  if (!isAdmin) return <p className="text-muted-foreground">Esta área é exclusiva do administrador.</p>;

  const pending = services.data?.filter((s) => s.status === "pending").length ?? 0;

  return (
    <div>
      <h1 className="text-4xl font-semibold">Administração</h1>
      <Tabs defaultValue="services" className="mt-6">
        <TabsList>
          <TabsTrigger value="services">Serviços {pending > 0 && `(${pending} pendentes)`}</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-3">
          {services.data?.length === 0 && <p className="text-muted-foreground">Nenhum serviço.</p>}
          {services.data?.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.profiles?.display_name} · {s.category} · {brl(s.price)}</p>
              </div>
              <Badge variant={s.status === "approved" ? "default" : s.status === "removed" ? "destructive" : "secondary"}>{serviceStatusLabel[s.status]}</Badge>
              {s.status !== "approved" && <Button size="sm" onClick={() => setSvc.mutate({ id: s.id, status: "approved" })}>Aprovar</Button>}
              {s.status !== "removed" && <Button size="sm" variant="outline" onClick={() => setSvc.mutate({ id: s.id, status: "removed" })}>Remover</Button>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="users" className="space-y-3">
          {users.data?.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
              <p className="flex-1 font-semibold">{u.display_name}{u.id === me?.id && " (você)"}</p>
              {u.suspended && <Badge variant="destructive">Suspensa</Badge>}
              {u.id !== me?.id && (
                <Button size="sm" variant={u.suspended ? "default" : "outline"} onClick={() => setUser.mutate({ id: u.id, suspended: !u.suspended })}>
                  {u.suspended ? "Reativar" : "Suspender"}
                </Button>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="contracts" className="space-y-3">
          {contracts.data?.length === 0 && <p className="text-muted-foreground">Nenhum contrato.</p>}
          {contracts.data?.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.services?.title}</p>
                <p className="text-sm text-muted-foreground">
                  {c.client?.display_name} contratou {c.provider?.display_name} · {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <span className="font-display text-lg text-primary">{brl(c.price)}</span>
              <Badge variant="secondary">{contractStatusLabel[c.status]}</Badge>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
