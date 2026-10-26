import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { fetchCourses, type Course } from "@/lib/courses";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Saber+" },
      { name: "description", content: "Gerencie cursos e matrículas da plataforma." },
      { property: "og:title", content: "Administração — Saber+" },
      { property: "og:description", content: "Gerencie cursos e matrículas da plataforma." },
    ],
  }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.from("user_roles").select("role")
      .eq("user_id", u.user!.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/cursos" });
  },
  component: AdminPage,
});

type Confirm = { title: string; text: string; run: () => void } | null;

function AdminPage() {
  const [confirm, setConfirm] = useState<Confirm>(null);
  return (
    <div>
      <h1 className="text-4xl font-semibold">Administração</h1>
      <Tabs defaultValue="courses" className="mt-6">
        <TabsList>
          <TabsTrigger value="courses">Cursos</TabsTrigger>
          <TabsTrigger value="enrollments">Matrículas</TabsTrigger>
        </TabsList>
        <TabsContent value="courses"><CoursesAdmin onConfirm={setConfirm} /></TabsContent>
        <TabsContent value="enrollments"><EnrollmentsAdmin onConfirm={setConfirm} /></TabsContent>
      </Tabs>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { confirm?.run(); setConfirm(null); }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const empty = { title: "", description: "", instructor: "", workload_hours: 10 };

function CoursesAdmin({ onConfirm }: { onConfirm: (c: Confirm) => void }) {
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const [editing, setEditing] = useState<Course | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Course) => {
    setEditing(c);
    setForm({ title: c.title, description: c.description, instructor: c.instructor, workload_hours: c.workload_hours });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = editing
        ? await supabase.from("courses").update(form).eq("id", editing.id)
        : await supabase.from("courses").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Curso atualizado" : "Curso cadastrado");
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: () => toast.error("Não foi possível salvar o curso."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Curso removido"); qc.invalidateQueries(); },
    onError: () => toast.error("Não foi possível remover o curso."),
  });

  return (
    <div className="mt-4">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo curso</Button>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Professor</TableHead>
              <TableHead>Carga</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell>{c.instructor}</TableCell>
                <TableCell>{c.workload_hours}h</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /> Editar</Button>
                  <Button variant="ghost" size="sm" className="text-destructive"
                    onClick={() => onConfirm({
                      title: "Remover curso?",
                      text: `"${c.title}" e todas as matrículas nele serão removidos.`,
                      run: () => remove.mutate(c.id),
                    })}>
                    <Trash2 className="h-4 w-4" /> Remover
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {courses.data?.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum curso.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar curso" : "Novo curso"}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="t">Nome do curso</Label>
              <Input id="t" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d">Descrição</Label>
              <Textarea id="d" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="i">Professor</Label>
                <Input id="i" value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h">Carga horária (h)</Label>
                <Input id="h" type="number" min={0} value={form.workload_hours}
                  onChange={(e) => setForm({ ...form, workload_hours: Number(e.target.value) })} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={save.isPending}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EnrollmentsAdmin({ onConfirm }: { onConfirm: (c: Confirm) => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["all-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, created_at, profiles(full_name, email), courses(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("enrollments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Matrícula cancelada"); qc.invalidateQueries(); },
    onError: () => toast.error("Não foi possível cancelar."),
  });

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Curso</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.data?.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <div className="font-medium">{e.profiles?.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{e.profiles?.email}</div>
              </TableCell>
              <TableCell>{e.courses?.title}</TableCell>
              <TableCell>{new Date(e.created_at).toLocaleDateString("pt-BR")}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" className="text-destructive"
                  onClick={() => onConfirm({
                    title: "Cancelar matrícula?",
                    text: `${e.profiles?.full_name || e.profiles?.email} deixará de estar matriculado em "${e.courses?.title}".`,
                    run: () => cancel.mutate(e.id),
                  })}>
                  Cancelar
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {q.data?.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma matrícula ainda.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
