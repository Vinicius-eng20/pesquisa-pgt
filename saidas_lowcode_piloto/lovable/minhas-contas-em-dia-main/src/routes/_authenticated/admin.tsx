import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, currentMonth, monthLabel, monthRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Meu Bolso" },
      { name: "description", content: "Gerencie categorias, contas e veja o total de gastos de todos." },
      { property: "og:title", content: "Administração — Meu Bolso" },
      { property: "og:description", content: "Gerencie categorias, contas e veja o total de gastos de todos." },
    ],
  }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.rpc("has_role", { _user_id: u.user!.id, _role: "admin" });
    if (!data) throw redirect({ to: "/painel" });
  },
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const { start, next } = monthRange(month);
  const [newCat, setNewCat] = useState("");

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at")).data ?? [],
  });
  const { data: me } = useQuery({ queryKey: ["uid"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id });
  const { data: expenses = [] } = useQuery({
    queryKey: ["admin-expenses", month],
    queryFn: async () =>
      (await supabase.from("expenses").select("user_id, amount").gte("spent_on", start).lt("spent_on", next)).data ?? [],
  });

  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const perUser = (id: string) => expenses.filter((e) => e.user_id === id).reduce((s, e) => s + Number(e.amount), 0);

  const addCat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").insert({ name: newCat.trim() });
      if (error) throw new Error(error.code === "23505" ? "Essa categoria já existe" : error.message);
    },
    onSuccess: () => { setNewCat(""); qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Categoria criada"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const toggleCat = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("categories").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
  const toggleUser = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success(v.active ? "Conta reativada" : "Conta desativada"); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-ink p-6 text-ink-foreground shadow-soft">
        <div>
          <p className="text-sm capitalize opacity-70">Total de todos os usuários · {monthLabel(month)}</p>
          <h1 className="font-display text-5xl font-bold">{brl(totalAll)}</h1>
          <p className="opacity-70">{users.length} conta(s) · {expenses.length} lançamento(s)</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="am">Mês</Label>
          <Input id="am" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44 bg-card text-card-foreground" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card shadow-soft">
          <h2 className="border-b p-5 text-lg font-bold">Contas de usuários</h2>
          <ul className="divide-y">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.display_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{u.email} · {brl(perUser(u.id))} no mês</p>
                </div>
                <span className={`text-xs font-medium ${u.active ? "text-primary" : "text-destructive"}`}>{u.active ? "Ativa" : "Desativada"}</span>
                <Switch checked={u.active} disabled={u.id === me} onCheckedChange={(v) => toggleUser.mutate({ id: u.id, active: v })} aria-label="Ativar ou desativar conta" />
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border bg-card shadow-soft">
          <h2 className="border-b p-5 text-lg font-bold">Categorias de gasto</h2>
          <form className="flex gap-2 border-b p-4" onSubmit={(e: FormEvent) => { e.preventDefault(); if (newCat.trim()) addCat.mutate(); }}>
            <Input placeholder="Nova categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <Button type="submit" disabled={addCat.isPending}>Adicionar</Button>
          </form>
          <ul className="divide-y">
            {cats.map((c) => (
              <li key={c.id} className="flex items-center justify-between p-4">
                <span className={c.active ? "" : "text-muted-foreground line-through"}>{c.name}</span>
                <Switch checked={c.active} onCheckedChange={(v) => toggleCat.mutate({ id: c.id, active: v })} aria-label="Disponível" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
