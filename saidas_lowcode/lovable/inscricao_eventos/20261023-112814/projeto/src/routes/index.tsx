import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarHeart, CheckCircle2, Smartphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inscreva — Portal de inscrição em eventos" },
      { name: "description", content: "Veja os eventos disponíveis, inscreva-se e acompanhe suas inscrições de qualquer aparelho." },
      { property: "og:title", content: "Inscreva — Portal de inscrição em eventos" },
      { property: "og:description", content: "Veja os eventos disponíveis, inscreva-se e acompanhe suas inscrições." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-8">
          <div className="flex items-center gap-2 font-display text-xl font-semibold">
            <CalendarHeart className="h-5 w-5 text-accent" /> Inscreva
          </div>
          <h1 className="mt-20 max-w-2xl text-5xl font-semibold leading-tight sm:text-6xl">
            Seu lugar no próximo evento, garantido.
          </h1>
          <p className="mt-5 max-w-xl text-lg opacity-85">
            Veja os eventos abertos, inscreva-se em segundos e acompanhe tudo do computador ou do celular.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth">Entrar ou criar conta</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto -mt-12 grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
        {[
          { icon: CheckCircle2, t: "Inscrição rápida", d: "Escolha o evento e confirme com um clique." },
          { icon: Smartphone, t: "Em qualquer aparelho", d: "Entre com sua conta e encontre tudo salvo." },
          { icon: Users, t: "Para organizadores", d: "Crie eventos e confirme a presença dos inscritos." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-xl border bg-card p-6 shadow-card">
            <Icon className="h-6 w-6 text-accent" />
            <h3 className="mt-3 text-lg font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
