import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLiveUpdates } from "@/hooks/use-live";
import { fmtDateTime, fmtPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel do negócio — Agenda" },
      { name: "description", content: "Gerencie serviços, horários e agendamentos." },
      { property: "og:title", content: "Painel do negócio — Agenda" },
      { property: "og:description", content: "Gerencie serviços, horários e agendamentos." },
    ],
  }),
  component: Panel,
});

function Panel() {
  useLiveUpdates();
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin)
    return <p className="pt-16 text-center text-muted-foreground">Esta área é só para o responsável pelo negócio.</p>;
  return (
    <div className="pt-10">
      <h1 className="text-4xl font-semibold">Painel do negócio</h1>
      <Tabs defaultValue="bookings" className="mt-6">
        <TabsList>
          <TabsTrigger value="bookings">Agendamentos</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="slots">Horários</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings"><BookingsTab /></TabsContent>
        <TabsContent value="services"><ServicesTab /></TabsContent>
        <TabsContent value="slots"><SlotsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

const card = "rounded-2xl border bg-card p-5 shadow-soft";

function BookingsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");
  const q = useQuery({
    queryKey: ["all-bookings"],
    queryFn: async () => {
      const [{ data: bookings, error }, { data: profiles }] = await Promise.all([
        supabase.from("bookings").select("*, slots(starts_at, services(name))").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, phone"),
      ]);
      if (error) throw error;
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (bookings ?? []).map((b) => ({ ...b, profile: byId.get(b.user_id) }));
    },
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "confirmed" | "rejected" }) => {
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: () => toast.error("Não foi possível atualizar."),
  });

  const list = (q.data ?? []).filter((b) => filter === "all" || b.status === filter);
  const filters = [
    ["pending", "Aguardando"],
    ["confirmed", "Confirmados"],
    ["all", "Todos"],
  ];

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        {filters.map(([k, l]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
            {l}
          </Button>
        ))}
      </div>
      {list.length === 0 && <p className="text-muted-foreground">Nenhum agendamento aqui.</p>}
      {list.map((b) => (
        <div key={b.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div>
            <p className="font-semibold">{b.slots?.services?.name} — {b.slots && fmtDateTime(b.slots.starts_at)}</p>
            <p className="text-sm text-muted-foreground">
              Cliente: {b.profile?.full_name || "Sem nome"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={b.status} />
            {b.status === "pending" && (
              <>
                <Button size="sm" onClick={() => setStatus.mutate({ id: b.id, status: "confirmed" })}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: b.id, status: "rejected" })}>Recusar</Button>
              </>
            )}
            {b.status === "confirmed" && (
              <Button size="sm" variant="outline" onClick={() => confirm("Desmarcar este cliente?") && setStatus.mutate({ id: b.id, status: "rejected" })}>
                Desmarcar
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

type ServiceForm = { id?: string; name: string; description: string; duration_min: number; price: number; active: boolean };
const emptyService: ServiceForm = { name: "", description: "", duration_min: 60, price: 0, active: true };

function useAllServices() {
  return useQuery({
    queryKey: ["services", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

function ServicesTab() {
  const qc = useQueryClient();
  const services = useAllServices();
  const [form, setForm] = useState<ServiceForm>(emptyService);
  const save = useMutation({
    mutationFn: async (f: ServiceForm) => {
      const { id, ...rest } = f;
      const { error } = id
        ? await supabase.from("services").update(rest).eq("id", id)
        : await supabase.from("services").insert(rest);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço salvo.");
      setForm(emptyService);
      qc.invalidateQueries();
    },
    onError: () => toast.error("Não foi possível salvar."),
  });

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <form
        className={`${card} space-y-3`}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
      >
        <h2 className="text-xl font-semibold">{form.id ? "Editar serviço" : "Novo serviço"}</h2>
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Descrição</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Duração (min)</Label>
            <Input type="number" min={5} required value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: +e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Preço (R$)</Label>
            <Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Visível para clientes
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>Salvar</Button>
          {form.id && <Button type="button" variant="ghost" onClick={() => setForm(emptyService)}>Cancelar edição</Button>}
        </div>
      </form>
      <div className="space-y-3">
        {services.data?.length === 0 && <p className="text-muted-foreground">Cadastre seu primeiro serviço.</p>}
        {services.data?.map((s) => (
          <div key={s.id} className={`${card} flex items-center justify-between gap-3`}>
            <div>
              <p className="font-semibold">{s.name} {!s.active && <span className="text-xs text-muted-foreground">(oculto)</span>}</p>
              <p className="text-sm text-muted-foreground">{s.duration_min} min · {fmtPrice(s.price)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setForm({ ...s, price: Number(s.price) })}>Editar</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlotsTab() {
  const qc = useQueryClient();
  const services = useAllServices();
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("18:00");
  const [every, setEvery] = useState(60);

  const slots = useQuery({
    queryKey: ["admin-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slots")
        .select("*, services(name)")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const rows: { service_id: string; starts_at: string }[] = [];
      const start = new Date(`${date}T${from}`);
      const end = new Date(`${date}T${to}`);
      for (let t = start; t < end; t = new Date(t.getTime() + every * 60000)) {
        rows.push({ service_id: serviceId, starts_at: t.toISOString() });
      }
      if (!rows.length) throw new Error("vazio");
      const { error } = await supabase.from("slots").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} horário(s) criado(s).`);
      qc.invalidateQueries();
    },
    onError: () => toast.error("Confira o serviço, a data e os horários."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <form
        className={`${card} space-y-3`}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <h2 className="text-xl font-semibold">Abrir horários</h2>
        <div className="space-y-1.5">
          <Label>Serviço</Label>
          <select
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              const s = services.data?.find((x) => x.id === e.target.value);
              if (s) setEvery(s.duration_min);
            }}
          >
            <option value="">Escolha…</option>
            {services.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Dia</Label>
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Das</Label><Input type="time" required value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Até</Label><Input type="time" required value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>A cada (min)</Label><Input type="number" min={5} required value={every} onChange={(e) => setEvery(+e.target.value)} /></div>
        </div>
        <Button type="submit" disabled={create.isPending}>Criar horários</Button>
      </form>
      <div className="space-y-2">
        {slots.data?.length === 0 && <p className="text-muted-foreground">Nenhum horário futuro aberto.</p>}
        {slots.data?.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5">
            <div className="text-sm">
              <span className="font-semibold">{fmtDateTime(s.starts_at)}</span>
              <span className="text-muted-foreground"> · {s.services?.name}</span>
            </div>
            {s.booked ? (
              <span className="text-xs font-semibold text-primary">Reservado</span>
            ) : (
              <Button size="icon" variant="ghost" aria-label="Remover horário" onClick={() => remove.mutate(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
