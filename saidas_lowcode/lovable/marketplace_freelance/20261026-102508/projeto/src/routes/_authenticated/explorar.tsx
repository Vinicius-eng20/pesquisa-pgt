import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, CATEGORIES, useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/explorar")({
  head: () => ({ meta: [{ title: "Explorar serviços — Ofício" }, { name: "description", content: "Encontre e contrate serviços freelance." }] }),
  component: Explore,
});

type Svc = { id: string; title: string; description: string; category: string; price: number; owner_id: string; profiles: { display_name: string } | null };

function Explore() {
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [hiring, setHiring] = useState<Svc | null>(null);
  const [msg, setMsg] = useState("");
  const qc = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", "approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,title,description,category,price,owner_id,profiles!services_owner_id_fkey(display_name)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Svc[];
    },
  });

  const hire = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("hire_service", { _service_id: hiring!.id, _message: msg });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido enviado! Acompanhe em Contratos.");
      setHiring(null); setMsg("");
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = services.filter(
    (s) => (!cat || s.category === cat) && (s.title + s.description).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <h1 className="text-4xl font-semibold">Explorar serviços</h1>
      <Input className="mt-6 max-w-md" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant={cat ? "outline" : "default"} onClick={() => setCat(null)}>Todos</Button>
        {CATEGORIES.map((c) => (
          <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>{c}</Button>
        ))}
      </div>
      {isLoading ? <p className="mt-8 text-muted-foreground">Carregando…</p> : list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhum serviço publicado ainda. <Link to="/meus-servicos" className="text-primary underline">Publique o primeiro!</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <div key={s.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-soft">
              <Badge variant="secondary" className="self-start">{s.category}</Badge>
              <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">por {s.profiles?.display_name}</p>
              <p className="mt-3 line-clamp-4 flex-1 text-sm">{s.description}</p>
              <div className="mt-5 flex items-center justify-between">
                <span className="font-display text-2xl font-semibold text-primary">{brl(s.price)}</span>
                {s.owner_id === me?.id ? (
                  <span className="text-xs text-muted-foreground">Seu serviço</span>
                ) : (
                  <Button size="sm" disabled={me?.suspended} onClick={() => setHiring(s)}>Contratar</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!hiring} onOpenChange={(o) => !o && setHiring(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contratar “{hiring?.title}”</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Valor: <b className="text-foreground">{hiring && brl(hiring.price)}</b></p>
          <Textarea placeholder="Conte ao prestador o que você precisa (opcional)" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <DialogFooter>
            <Button onClick={() => hire.mutate()} disabled={hire.isPending}>Enviar pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
