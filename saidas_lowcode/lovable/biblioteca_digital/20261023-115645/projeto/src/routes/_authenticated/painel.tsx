import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { allLoansQuery, fmt, isOverdue, itemsQuery, meQuery, readersQuery } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do bibliotecário — Estante" },
      { name: "description", content: "Gerencie o acervo, os leitores e o histórico de empréstimos." },
      { property: "og:title", content: "Painel do bibliotecário — Estante" },
      { property: "og:description", content: "Gestão da biblioteca." },
    ],
  }),
  component: Painel,
});

type Form = { id?: string; title: string; author: string; kind: string; year: string; description: string; copies: string };
const empty: Form = { title: "", author: "", kind: "Livro", year: "", description: "", copies: "1" };

function Painel() {
  const { data: me, isLoading } = useQuery(meQuery);
  if (isLoading) return null;
  if (!me?.isLibrarian) return <p className="text-muted-foreground">Esta área é só para o bibliotecário.</p>;
  return (
    <div>
      <h1 className="text-4xl font-bold">Painel do bibliotecário</h1>
      <Tabs defaultValue="acervo" className="mt-6">
        <TabsList><TabsTrigger value="acervo">Acervo</TabsTrigger><TabsTrigger value="leitores">Leitores</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList>
        <TabsContent value="acervo"><Items userId={me.id} /></TabsContent>
        <TabsContent value="leitores"><Readers myId={me.id} /></TabsContent>
        <TabsContent value="historico"><History /></TabsContent>
      </Tabs>
    </div>
  );
}

function Items({ userId }: { userId: string }) {
  const { data: items = [] } = useQuery(itemsQuery(userId));
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const row = { title: form.title, author: form.author, kind: form.kind, description: form.description, year: form.year ? Number(form.year) : null, copies: Math.max(0, Number(form.copies) || 0) };
    const { error } = form.id ? await supabase.from("items").update(row).eq("id", form.id) : await supabase.from("items").insert(row);
    if (error) { toast.error("Não foi possível salvar."); return; }
    toast.success("Item salvo.");
    setForm(null);
    qc.invalidateQueries({ queryKey: ["items"] });
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Remover "${title}" do acervo?`)) return;
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) { toast.error("Não foi possível remover."); return; }
    toast.success("Item removido.");
    qc.invalidateQueries({ queryKey: ["items"] });
  }

  const f = (k: keyof Form) => ({ value: form?.[k] ?? "", onChange: (e: { target: { value: string } }) => setForm((p) => p && { ...p, [k]: e.target.value }) });

  return (
    <div className="mt-4">
      <Button onClick={() => setForm(empty)}>+ Cadastrar item</Button>
      <ul className="mt-4 divide-y rounded-xl border bg-card">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex-1"><p className="font-semibold">{i.title}</p><p className="text-sm text-muted-foreground">{i.author} · {i.kind} · {i.available}/{i.copies} disponíveis</p></div>
            <Button size="sm" variant="outline" onClick={() => setForm({ id: i.id, title: i.title, author: i.author, kind: i.kind, year: i.year ? String(i.year) : "", description: i.description, copies: String(i.copies) })}>Editar</Button>
            <Button size="sm" variant="destructive" onClick={() => remove(i.id, i.title)}>Remover</Button>
          </li>
        ))}
      </ul>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1"><Label>Título</Label><Input required {...f("title")} /></div>
            <div className="space-y-1"><Label>Autor</Label><Input {...f("author")} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Tipo</Label><Input {...f("kind")} /></div>
              <div className="space-y-1"><Label>Ano</Label><Input type="number" {...f("year")} /></div>
              <div className="space-y-1"><Label>Exemplares</Label><Input type="number" min={0} required {...f("copies")} /></div>
            </div>
            <div className="space-y-1"><Label>Descrição</Label><Textarea {...f("description")} /></div>
            <Button className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Readers({ myId }: { myId: string }) {
  const { data: readers = [] } = useQuery(readersQuery);
  const { data: loans = [] } = useQuery(allLoansQuery);
  const qc = useQueryClient();

  async function toggle(id: string, blocked: boolean) {
    const { error } = await supabase.from("profiles").update({ blocked }).eq("id", id);
    if (error) { toast.error("Não foi possível alterar."); return; }
    toast.success(blocked ? "Novos empréstimos bloqueados." : "Leitor desbloqueado.");
    qc.invalidateQueries({ queryKey: ["readers"] });
  }

  return (
    <ul className="mt-4 divide-y rounded-xl border bg-card">
      {readers.filter((r) => r.id !== myId).map((r) => {
        const late = loans.filter((l) => l.user_id === r.id && isOverdue(l)).length;
        const open = loans.filter((l) => l.user_id === r.id && !l.returned_at).length;
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex-1"><p className="font-semibold">{r.full_name || r.email}</p><p className="text-sm text-muted-foreground">{r.email} · {open} com ele(a)</p></div>
            {late > 0 && <Badge variant="destructive">{late} em atraso</Badge>}
            <label className="flex items-center gap-2 text-sm">Bloquear <Switch checked={r.blocked} onCheckedChange={(v) => toggle(r.id, v)} /></label>
          </li>
        );
      })}
      {readers.length <= 1 && <li className="p-4 text-muted-foreground">Nenhum leitor cadastrado ainda.</li>}
    </ul>
  );
}

function History() {
  const { data: loans = [] } = useQuery(allLoansQuery);
  const [q, setQ] = useState("");
  const list = loans.filter((l) => `${l.item_title} ${l.profiles?.full_name ?? ""} ${l.profiles?.email ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mt-4">
      <Input className="max-w-md" placeholder="Filtrar por leitor ou item…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3">Leitor</th><th className="p-3">Item</th><th className="p-3">Pegou</th><th className="p-3">Prazo</th><th className="p-3">Situação</th></tr></thead>
          <tbody className="divide-y">
            {list.map((l) => (
              <tr key={l.id}>
                <td className="p-3">{l.profiles?.full_name || l.profiles?.email}</td>
                <td className="p-3">{l.item_title}</td>
                <td className="p-3">{fmt(l.borrowed_at)}</td>
                <td className="p-3">{fmt(l.due_at)}</td>
                <td className="p-3">{l.returned_at ? `Devolvido em ${fmt(l.returned_at)}` : isOverdue(l) ? <Badge variant="destructive">Atrasado</Badge> : <Badge>Emprestado</Badge>}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="p-4 text-muted-foreground">Nenhum empréstimo ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
