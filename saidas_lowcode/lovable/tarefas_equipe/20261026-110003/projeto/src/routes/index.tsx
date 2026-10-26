import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Users, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Equipe em Dia — Tarefas da equipe num só lugar" },
      { name: "description", content: "Distribua, acompanhe e conclua as tarefas da sua equipe, do computador ou do celular." },
      { property: "og:title", content: "Equipe em Dia — Tarefas da equipe num só lugar" },
      { property: "og:description", content: "Distribua, acompanhe e conclua as tarefas da sua equipe, do computador ou do celular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-bold">Equipe em Dia</span>
        <Button asChild variant="outline">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-12 md:pt-24">
        <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] md:text-7xl">
          Cada tarefa no lugar certo, <span className="text-accent">com a pessoa certa.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          O gerente distribui, a equipe acompanha e atualiza. Tudo salvo e sincronizado em qualquer aparelho.
        </p>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Começar agora</Link>
          </Button>
        </div>
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { icon: Users, t: "Para gerente e equipe", d: "Cada um vê exatamente o que precisa." },
            { icon: CheckCircle2, t: "Situação sempre clara", d: "A fazer, em andamento ou concluída." },
            { icon: Smartphone, t: "Em qualquer aparelho", d: "Comece no computador e continue no celular." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl border bg-card p-6 shadow-soft">
              <Icon className="size-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
