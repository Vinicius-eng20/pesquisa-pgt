import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { brl, currentMonth, monthLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/painel" });
  },
  head: () => ({
    meta: [
      { title: "Administração — Caderneta" },
      { name: "description", content: "Categorias, contas e totais de todos os usuários." },
      { property: "og:title", content: "Administração — Caderneta" },
      { property: "og:description", content: "Categorias, contas e totais de todos os usuários." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [newCat, setNewCat] = useState("");
  const month = currentMonth();

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name, active").order("name");
      if (error) throw error;
      return data;
    },
  });

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_totals", { _month: `${month}-01` });
      if (error) throw error;
      return data;
    },
  });

  const addCat = useMutation({
    mutationFn: async () => {
      const name = newCat.trim();
      if (!name) throw new Error("Digite o nome da categoria.");
      const { error } = await supabase.from("categories").insert({ name });
      if (error) throw new Error(error.code === "23505" ? "Essa categoria já existe." : error.message);
    },
    onSuccess: () => { setNewCat(""); toast.success("Categoria criada"); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCat = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("categories").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleUser = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => { toast.success(v.active ? "Conta reativada" : "Conta desativada"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = users.data ?? [];
  const grand = rows.reduce((s, r) => s + Number(r.total), 0);
  const grandMonth = rows.reduce((s, r) => s + Number(r.month_total), 0);

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Administração</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total gasto por todos" value={brl(grand)} />
        <Stat label={`Total em ${monthLabel(month)}`} value={brl(grandMonth)} />
        <Stat label="Contas" value={String(rows.length)} />
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-bold">Usuários</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2">Nome</th><th>E-mail</th><th className="text-right">No mês</th><th className="text-right">Total</th><th className="text-right">Ativa</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.user_id}>
                  <td className="py-3 font-medium">{r.full_name || "—"}</td>
                  <td className="text-muted-foreground">{r.email}</td>
                  <td className="text-right tabular-nums">{brl(r.month_total)}</td>
                  <td className="text-right font-semibold tabular-nums">{brl(r.total)}</td>
                  <td className="text-right">
                    <Switch
                      aria-label={`Conta de ${r.email} ativa`}
                      checked={r.active}
                      disabled={r.user_id === user.id}
                      onCheckedChange={(v) => toggleUser.mutate({ id: r.user_id, active: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-bold">Categorias de gasto</h2>
        <form onSubmit={(e) => { e.preventDefault(); addCat.mutate(); }} className="mt-4 flex gap-2">
          <Input placeholder="Nova categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="max-w-xs" />
          <Button type="submit" disabled={addCat.isPending}>Adicionar</Button>
        </form>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {categories.data?.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span className={c.active ? "" : "text-muted-foreground line-through"}>{c.name}</span>
              <Switch aria-label={`Categoria ${c.name} disponível`} checked={c.active} onCheckedChange={(v) => toggleCat.mutate({ id: c.id, active: v })} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Categorias desligadas não aparecem para novos gastos, mas os gastos antigos são mantidos.</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}
