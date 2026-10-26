import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, LogOut, Pencil, Plus, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  meQuery, profilesQuery, tasksQuery, STATUS_LABEL, STATUS_ORDER,
  type Task, type TaskStatus, type Profile,
} from "@/lib/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel de tarefas — Equipe em Dia" },
      { name: "description", content: "Suas tarefas e as da sua equipe." },
      { property: "og:title", content: "Painel de tarefas — Equipe em Dia" },
      { property: "og:description", content: "Suas tarefas e as da sua equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

const STATUS_DOT: Record<TaskStatus, string> = {
  pendente: "bg-status-pendente",
  em_andamento: "bg-status-andamento",
  concluida: "bg-status-concluida",
};

function Painel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery(meQuery);
  const profiles = useQuery(profilesQuery);
  const tasks = useQuery(tasksQuery);
  const [memberFilter, setMemberFilter] = useState("todos");
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  useEffect(() => {
    const ch = supabase
      .channel(`tasks-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const people = useMemo(() => {
    const m = new Map<string, Profile>();
    (profiles.data ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles.data]);

  const isManager = me.data?.isManager ?? false;
  const myId = me.data?.id;

  const visible = (tasks.data ?? []).filter((t) => memberFilter === "todos" || t.assigned_to === memberFilter);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function changeStatus(t: Task, status: TaskStatus) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("tasks").delete().eq("id", deleting.id);
    setDeleting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarefa removida");
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  if (me.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <span className="font-display text-lg font-bold">Equipe em Dia</span>
            <p className="text-sm text-muted-foreground">
              Olá, {me.data?.profile?.full_name || "você"} ·{" "}
              <span className="font-medium text-primary">{isManager ? "Gerente" : "Membro da equipe"}</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{isManager ? "Tarefas da equipe" : "Minhas tarefas"}</h1>
            <p className="text-muted-foreground">{visible.length} tarefa(s)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isManager && (
              <Select value={memberFilter} onValueChange={setMemberFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os membros</SelectItem>
                  {(profiles.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => setEditing("new")}><Plus /> Nova tarefa</Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {STATUS_ORDER.map((s) => {
            const col = visible.filter((t) => t.status === s);
            return (
              <section key={s} className="rounded-2xl bg-muted p-3">
                <h2 className="flex items-center gap-2 px-2 py-1 text-base font-semibold">
                  <span className={`size-2.5 rounded-full ${STATUS_DOT[s]}`} />
                  {STATUS_LABEL[s]}
                  <span className="ml-auto text-sm font-normal text-muted-foreground">{col.length}</span>
                </h2>
                <div className="mt-2 space-y-3">
                  {col.length === 0 && (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nada por aqui</p>
                  )}
                  {col.map((t) => {
                    const canEdit = isManager || t.created_by === myId;
                    const assignee = people.get(t.assigned_to);
                    const creator = people.get(t.created_by);
                    return (
                      <article key={t.id} className="rounded-xl border bg-card p-4 shadow-soft">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-sans font-semibold leading-snug">{t.title}</h3>
                          <div className="flex shrink-0">
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="size-7" aria-label="Editar" onClick={() => setEditing(t)}>
                                <Pencil />
                              </Button>
                            )}
                            {isManager && (
                              <Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label="Remover" onClick={() => setDeleting(t)}>
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        </div>
                        {t.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{t.description}</p>}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {isManager && (
                            <span className="flex items-center gap-1"><User className="size-3.5" />{assignee?.full_name || assignee?.email || "—"}</span>
                          )}
                          {t.due_date && (
                            <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{new Date(t.due_date + "T00:00").toLocaleDateString("pt-BR")}</span>
                          )}
                          {!isManager && t.created_by !== myId && creator && <span>Enviada por {creator.full_name}</span>}
                        </div>
                        <Select value={t.status} onValueChange={(v) => changeStatus(t, v as TaskStatus)}>
                          <SelectTrigger className="mt-3 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_ORDER.map((o) => <SelectItem key={o} value={o}>{STATUS_LABEL[o]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {editing && myId && (
        <TaskDialog
          task={editing === "new" ? null : editing}
          isManager={isManager}
          myId={myId}
          profiles={profiles.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tarefa?</AlertDialogTitle>
            <AlertDialogDescription>"{deleting?.title}" será apagada para todos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskDialog({
  task, isManager, myId, profiles, onClose,
}: {
  task: Task | null; isManager: boolean; myId: string; profiles: Profile[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? myId);
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      due_date: dueDate || null,
      assigned_to: isManager ? assignedTo : myId,
    };
    const { error } = task
      ? await supabase.from("tasks").update(isManager ? payload : { title: payload.title, description: payload.description, due_date: payload.due_date }).eq("id", task.id)
      : await supabase.from("tasks").insert({ ...payload, created_by: myId });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(task ? "Tarefa atualizada" : "Tarefa criada");
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t">Título</Label>
            <Input id="t" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d">Descrição</Label>
            <Textarea id="d" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {isManager && (
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}{p.id === myId ? " (você)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="due">Prazo (opcional)</Label>
            <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
