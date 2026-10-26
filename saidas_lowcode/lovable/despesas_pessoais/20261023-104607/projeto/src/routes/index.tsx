import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wallet, PieChart, Smartphone, Tags } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Caderneta — Controle de despesas pessoais" },
      { name: "description", content: "Anote seus gastos, organize por categoria e veja quanto gastou no mês, no computador ou no celular." },
      { property: "og:title", content: "Caderneta — Controle de despesas pessoais" },
      { property: "og:description", content: "Anote seus gastos e veja quanto gastou no mês." },
    ],
  }),
  component: Index,
});

function Index() {
  const items = [
    { icon: Wallet, t: "Anote cada gasto", d: "Valor, data, descrição e categoria em segundos." },
    { icon: Tags, t: "Por categoria", d: "Veja onde o dinheiro está indo." },
    { icon: PieChart, t: "Total do mês", d: "Saiba exatamente quanto gastou." },
    { icon: Smartphone, t: "Em qualquer aparelho", d: "Tudo fica salvo na sua conta." },
  ];
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center px-4 py-5">
        <span className="flex items-center gap-2 font-display text-2xl font-bold text-primary">
          <Wallet className="h-6 w-6" /> Caderneta
        </span>
        <Button asChild variant="ghost" className="ml-auto">
          <Link to="/painel">Entrar</Link>
        </Button>
      </header>
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-12 md:pt-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground">Controle de despesas pessoais</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.05] md:text-7xl">
          Seu dinheiro, <span className="italic text-primary">anotado</span> com calma.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Registre seus gastos, organize por categoria e acompanhe o total do mês — do computador ou do celular.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link to="/auth">Começar agora</Link></Button>
        </div>
        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: I, t, d }) => (
            <div key={t} className="rounded-2xl border bg-card p-5">
              <I className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-lg font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
