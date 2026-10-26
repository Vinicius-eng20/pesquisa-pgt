import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ofício — Marketplace de serviços freelance" },
      { name: "description", content: "Publique seus serviços, contrate profissionais e acompanhe seus contratos em um só lugar." },
      { property: "og:title", content: "Ofício — Marketplace de serviços freelance" },
      { property: "og:description", content: "Publique seus serviços, contrate profissionais e acompanhe seus contratos." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <span className="font-display text-2xl font-semibold text-primary">ofício</span>
        <Button asChild variant="outline"><Link to="/auth">Entrar</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Marketplace freelance</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-7xl">
          Talento de verdade, <em className="text-primary">contratado</em> sem complicação.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Ofereça o que você sabe fazer, encontre quem faz o que você precisa e acompanhe cada contrato — do computador ou do celular.
        </p>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg"><Link to="/auth">Começar agora</Link></Button>
        </div>
        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            ["Publique", "Descreva seu serviço e defina seu preço. Nossa equipe revisa antes de ir ao ar."],
            ["Contrate", "Encontre profissionais por categoria e faça seu pedido em um clique."],
            ["Acompanhe", "Veja todos os contratos de que você participa e o andamento de cada um."],
          ].map(([t, d], i) => (
            <div key={t} className="rounded-2xl border bg-card p-6 shadow-soft">
              <span className="font-display text-4xl text-accent">0{i + 1}</span>
              <h3 className="mt-3 text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
