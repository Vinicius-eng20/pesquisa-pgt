import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, currentMonth, monthLabel, monthRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Meus gastos — Meu Bolso" },
      { name: "description", content: "Seus gastos do mês, organizados por categoria." },
      { property: "og:title", content: "Meus gastos — Meu Bolso" },
      { property: "og:description", content: "Seus gastos do mês, organizados por categoria." },
    ],
  }),
  component: Painel,
});

function Painel() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState("all");
  const { start, next } = monthRange(month);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["my-expenses", month],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("expenses").select("*").eq("user_id", u.user!.id)
        .gte("spent_on", start).lt("spent_on", next).order("spent_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "Sem categoria";
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCat = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      const k = e.category_id ?? "none";
      acc[k] = (acc[k] ?? 0) + Number(e.amount);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const shown = filter === "all" ? expenses : expenses.filter((e) => (e.category_id ?? "none") === filter);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-expenses"] }); toast.success("Gasto apagado"); },
    onError: () => toast.error("Não foi possível apagar"),
  });

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium capitalize text-muted-foreground">{monthLabel(month)}</p>
          <h1 className="font-display text-5xl font-bold">{brl(total)}</h1>
          <p className="text-muted-foreground">gastos neste mês · {expenses.length} registro(s)</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="mes">Mês</Label>
          <Input id="mes" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
        </div>
      </section>

      <NewExpense cats={cats.filter((c) => c.active)} />

      {byCat.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="mb-4 text-lg font-bold">Por categoria</h2>
          <div className="space-y-3">
            {byCat.map(([id, v]) => (
              <button key={id} onClick={() => setFilter(filter === id ? "all" : id)} className="block w-full text-left">
                <div className="flex justify-between text-sm">
                  <span className={filter === id ? "font-bold" : ""}>{id === "none" ? "Sem categoria" : catName(id)}</span>
                  <span className="font-medium">{brl(v)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(v / total) * 100}%` }} />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-lg font-bold">Lançamentos</h2>
          {filter !== "all" && <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>Mostrar todos</Button>}
        </div>
        {shown.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">Nenhum gasto registrado neste mês.</p>
        ) : (
          <ul className="divide-y">
            {shown.map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {catName(e.category_id)} · {new Date(e.spent_on + "T12:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="font-semibold">{brl(Number(e.amount))}</span>
                <Button variant="ghost" size="icon" aria-label="Apagar" onClick={() => confirm("Apagar este gasto?") && del.mutate(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NewExpense({ cats }: { cats: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const add = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(",", "."));
      if (!(value > 0)) throw new Error("Informe um valor maior que zero");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("expenses").insert({
        user_id: u.user!.id, description, amount: value, category_id: category || null, spent_on: date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-expenses"] });
      setDescription(""); setAmount("");
      toast.success("Gasto registrado");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <form
      onSubmit={(e: FormEvent) => { e.preventDefault(); add.mutate(); }}
      className="grid gap-3 rounded-2xl bg-ink p-5 text-ink-foreground shadow-soft sm:grid-cols-[2fr_1fr_1.3fr_1.2fr_auto] sm:items-end"
    >
      <div className="space-y-1"><Label htmlFor="d">O que foi?</Label>
        <Input id="d" className="bg-card text-card-foreground" placeholder="Ex.: Mercado" value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
      <div className="space-y-1"><Label htmlFor="v">Valor (R$)</Label>
        <Input id="v" className="bg-card text-card-foreground" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <div className="space-y-1"><Label>Categoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="bg-card text-card-foreground"><SelectValue placeholder="Escolha" /></SelectTrigger>
          <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select></div>
      <div className="space-y-1"><Label htmlFor="dt">Data</Label>
        <Input id="dt" type="date" className="bg-card text-card-foreground" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
      <Button type="submit" variant="secondary" disabled={add.isPending}><Plus className="h-4 w-4" /> Adicionar</Button>
    </form>
  );
}
