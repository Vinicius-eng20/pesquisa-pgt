import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, CATEGORIES, serviceStatusLabel, useMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/meus-servicos")({
  head: () => ({ meta: [{ title: "Meus serviços — Ofício" }, { name: "description", content: "Publique e gerencie seus serviços." }] }),
  component: MyServices,
});

function MyServices() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Design");
  const [price, setPrice] = useState("");

  const { data: services = [] } = useQuery({
    queryKey: ["services", "mine", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("owner_id", me!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const p = Number(price.replace(",", "."));
      if (!(p >= 0)) throw new Error("Informe um preço válido.");
      const { error } = await supabase.from("services").insert({ owner_id: me!.id, title, description, category, price: p });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço enviado para análise do administrador.");
      setTitle(""); setDescription(""); setPrice("");
      qc.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("row-level") ? "Não foi possível publicar." : e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });

  return (
    <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
        className="h-fit space-y-4 rounded-2xl border bg-card p-6 shadow-soft"
      >
        <h2 className="text-2xl font-semibold">Publicar serviço</h2>
        <div className="space-y-1.5"><Label>Título</Label><Input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Criação de logotipo" /></div>
        <div className="space-y-1.5"><Label>Descrição</Label><Textarea required rows={5} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Preço (R$)</Label><Input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="150,00" /></div>
        <Button className="w-full" disabled={create.isPending || me?.suspended}>Enviar para análise</Button>
      </form>

      <div>
        <h1 className="text-4xl font-semibold">Meus serviços</h1>
        {services.length === 0 ? (
          <p className="mt-6 text-muted-foreground">Você ainda não publicou nenhum serviço.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {services.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.category} · {brl(s.price)}</p>
                </div>
                <Badge variant={s.status === "approved" ? "default" : s.status === "removed" ? "destructive" : "secondary"}>
                  {serviceStatusLabel[s.status]}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => confirm("Excluir este serviço?") && remove.mutate(s.id)}>Excluir</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
