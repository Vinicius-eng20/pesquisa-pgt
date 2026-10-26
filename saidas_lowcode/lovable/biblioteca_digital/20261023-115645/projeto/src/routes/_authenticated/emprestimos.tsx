import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmt, isOverdue, meQuery, myLoansQuery } from "@/lib/library";

export const Route = createFileRoute("/_authenticated/emprestimos")({
  head: () => ({
    meta: [
      { title: "Meus empréstimos — Estante" },
      { name: "description", content: "Veja e devolva os itens que você pegou emprestado." },
      { property: "og:title", content: "Meus empréstimos — Estante" },
      { property: "og:description", content: "Veja e devolva seus empréstimos." },
    ],
  }),
  component: Emprestimos,
});

function Emprestimos() {
  const { data: me } = useQuery(meQuery);
  const { data: loans = [] } = useQuery({ ...myLoansQuery(me?.id ?? ""), enabled: !!me });
  const qc = useQueryClient();
  const open = loans.filter((l) => !l.returned_at);
  const past = loans.filter((l) => l.returned_at);

  async function giveBack(id: string) {
    const { error } = await supabase.rpc("return_loan", { _loan: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Item devolvido. Obrigado!");
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["items"] });
  }

  return (
    <div>
      <h1 className="text-4xl font-bold">Meus empréstimos</h1>
      <h2 className="mt-8 text-xl font-bold">Com você agora</h2>
      {open.length === 0 && <p className="mt-2 text-muted-foreground">Você não está com nenhum item.</p>}
      <div className="mt-4 space-y-3">
        {open.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
            <div className="flex-1">
              <p className="font-semibold">{l.item_title}</p>
              <p className="text-sm text-muted-foreground">Pegou em {fmt(l.borrowed_at)} · devolver até {fmt(l.due_at)}</p>
            </div>
            {isOverdue(l) && <Badge variant="destructive">Atrasado</Badge>}
            <Button onClick={() => giveBack(l.id)}>Devolver</Button>
          </div>
        ))}
      </div>
      <h2 className="mt-10 text-xl font-bold">Já devolvidos</h2>
      {past.length === 0 && <p className="mt-2 text-muted-foreground">Nada por aqui ainda.</p>}
      <ul className="mt-4 divide-y rounded-xl border bg-card">
        {past.map((l) => (
          <li key={l.id} className="flex justify-between gap-3 p-4 text-sm">
            <span className="font-medium">{l.item_title}</span>
            <span className="text-muted-foreground">{fmt(l.borrowed_at)} → {fmt(l.returned_at!)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
