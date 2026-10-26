import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, currentMonth, dateLabel, monthLabel, monthRange } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Meus gastos — Caderneta" },
      { name: "description", content: "Seus gastos do mês por categoria." },
      { property: "og:title", content: "Meus gastos — Caderneta" },
      { property: "og:description", content: "Seus gastos do mês por categoria." },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState("todas");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ description: "", amount: "", category_id: "", spent_on: today });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, active").order("name");
      if (error) throw error;
      return data;
    },
  });

  const expenses = useQuery({
    queryKey: ["expenses", month],
    queryFn: async () => {
      const { start, end } = monthRange(month);
      const { data, error } = await supabase
        .from("expenses")
        .select("id, description, amount, spent_on, category_id")
        .gte("spent_on", start)
        .lt("spent_on", end)
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount.replace(",", "."));
      if (!(amount > 0)) throw new Error("Informe um valor maior que zero.");
      if (!form.category_id) throw new Error("Escolha uma categoria.");
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        description: form.description.trim(),
        amount,
        category_id: form.category_id,
        spent_on: form.spent_on,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gasto registrado!");
      setForm((f) => ({ ...f, description: "", amount: "" }));
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const catName = (id: string | null) => categories.data?.find((c) => c.id === id)?.name ?? "Sem categoria";
  const list = expenses.data ?? [];
  const total = list.reduce((s, e) => s + Number(e.amount), 0);
  const byCat = Object.entries(
    list.reduce<Record<string, number>>((acc, e) => {
      const k = catName(e.category_id);
      acc[k] = (acc[k] ?? 0) + Number(e.amount);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const shown = filter === "todas" ? list : list.filter((e) => e.category_id === filter);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm capitalize text-muted-foreground">{monthLabel(month)}</p>
          <h1 className="text-4xl font-bold md:text-5xl">{brl(total)}</h1>
          <p className="text-sm text-muted-foreground">gastos neste mês</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="month">Mês</Label>
          <Input id="month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
        className="grid gap-3 rounded-2xl border bg-card p-5 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="desc">Descrição</Label>
          <Input id="desc" placeholder="Ex.: Mercado" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Valor (R$)</Label>
          <Input id="amount" inputMode="decimal" placeholder="0,00" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
            <SelectTrigger aria-label="Categoria"><SelectValue placeholder="Escolha" /></SelectTrigger>
            <SelectContent>
              {categories.data?.filter((c) => c.active).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Data</Label>
          <Input id="date" type="date" required value={form.spent_on} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} />
        </div>
        <Button type="submit" disabled={add.isPending}>Adicionar</Button>
      </form>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-xl font-bold">Por categoria</h2>
          {byCat.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhum gasto neste mês.</p>}
          <ul className="mt-4 space-y-3">
            {byCat.map(([name, v]) => (
              <li key={name}>
                <div className="flex justify-between text-sm"><span>{name}</span><b>{brl(v)}</b></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (v / total) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Gastos</h2>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48" aria-label="Filtrar categoria"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {expenses.isLoading && <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>}
          {!expenses.isLoading && shown.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Nada por aqui ainda.</p>}
          <ul className="mt-3 divide-y">
            {shown.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.description || catName(e.category_id)}</p>
                  <p className="text-xs text-muted-foreground">{dateLabel(e.spent_on)} · {catName(e.category_id)}</p>
                </div>
                <b className="tabular-nums">{brl(e.amount)}</b>
                <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => confirm("Excluir este gasto?") && remove.mutate(e.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
