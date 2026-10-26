import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Smartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Saber+ — Cursos online com matrícula" },
      { name: "description", content: "Veja os cursos disponíveis, matricule-se e acompanhe seus cursos de qualquer aparelho." },
      { property: "og:title", content: "Saber+ — Cursos online com matrícula" },
      { property: "og:description", content: "Veja os cursos disponíveis, matricule-se e acompanhe seus cursos de qualquer aparelho." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <AppHeader />
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">
            Plataforma de cursos
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Aprenda algo novo, no seu ritmo, de qualquer lugar.
          </h1>
          <p className="mt-6 max-w-xl text-lg opacity-85">
            Escolha um curso, faça sua matrícula em um clique e encontre tudo salvo no computador ou no celular.
          </p>
          <div className="mt-10">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to={user ? "/cursos" : "/auth"}>{user ? "Ver cursos" : "Começar agora"}</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-3">
        {[
          { icon: BookOpen, t: "Cursos variados", d: "Veja todos os cursos disponíveis e matricule-se quando quiser." },
          { icon: Smartphone, t: "Em qualquer aparelho", d: "Entre com sua conta e encontre as mesmas informações em todo lugar." },
          { icon: ShieldCheck, t: "Tudo salvo", d: "Suas matrículas ficam guardadas com segurança na plataforma." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-xl border bg-card p-6 shadow-card">
            <Icon className="h-7 w-7 text-primary" />
            <h3 className="mt-4 text-xl font-semibold">{t}</h3>
            <p className="mt-2 text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
