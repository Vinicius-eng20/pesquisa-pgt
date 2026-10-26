import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { itemsQuery, meQuery, LOAN_DAYS } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/acervo")({
  head: () => ({
    meta: [
      { title: "Acervo — Estante" },
      { name: "description", content: "Busque e peça emprestado itens do acervo." },
      { property: "og:title", content: "Acervo — Estante" },
      { property: "og:description", content: "Busque e peça emprestado itens do acervo." },
    ],
  }),
  component: Acervo,
});

function Acervo() {
  const { data: me } = useQuery(meQuery);
  const { data: items = [], isLoading } = useQuery({ ...itemsQuery(me?.id ?? ""), enabled: !!me });
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => [i.title, i.author, i.kind, String(i.year ?? "")].join(" ").toLowerCase().includes(t));
  }, [items, q]);

  async function borrow(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc("borrow_item", { _item: id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Emprestado! Devolva em até ${LOAN_DAYS} dias.`);
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["loans"] });
  }

  return (
    <div>
      <h1 className="text-4xl font-bold">Acervo</h1>
      <Input className="mt-6 h-12 max-w-xl text-base" placeholder="Buscar por título, autor, tipo ou ano…" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading && <p className="mt-8 text-muted-foreground">Carregando…</p>}
      {!isLoading && list.length === 0 && <p className="mt-8 text-muted-foreground">Nenhum item encontrado.</p>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((i) => (
          <article key={i.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary">{i.kind}</Badge>
              <span className={i.available > 0 ? "text-sm text-success" : "text-sm text-destructive"}>
                {i.available > 0 ? `${i.available} de ${i.copies} disponíveis` : "Indisponível"}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-bold">{i.title}</h2>
            <p className="text-sm text-muted-foreground">{i.author}{i.year ? ` · ${i.year}` : ""}</p>
            <p className="mt-3 flex-1 text-sm">{i.description}</p>
            <Button className="mt-4" disabled={i.mine || i.available <= 0 || me?.blocked || busy === i.id} onClick={() => borrow(i.id)}>
              {i.mine ? "Está com você" : me?.blocked ? "Empréstimos bloqueados" : "Pegar emprestado"}
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
