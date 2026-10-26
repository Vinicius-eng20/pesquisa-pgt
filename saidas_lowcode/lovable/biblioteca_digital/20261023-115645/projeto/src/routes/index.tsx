import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estante — Biblioteca digital com empréstimos" },
      { name: "description", content: "Encontre livros, filmes e revistas do acervo e peça emprestado de qualquer aparelho." },
      { property: "og:title", content: "Estante — Biblioteca digital" },
      { property: "og:description", content: "Busque o acervo, pegue emprestado e devolva com sua conta." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-2xl font-bold text-primary">Estante</span>
        <Button asChild variant="outline"><Link to="/auth">Entrar</Link></Button>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-10 md:grid-cols-2 md:py-20">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">Biblioteca digital</p>
          <h1 className="text-5xl font-bold leading-tight md:text-6xl">O acervo inteiro, no seu bolso.</h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            Procure um título, pegue emprestado e devolva quando terminar — do computador ou do celular.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg"><Link to="/auth">Criar conta ou entrar</Link></Button>
          </div>
        </div>
        <img src={hero} alt="Estantes de uma biblioteca" width={1280} height={896} className="rounded-xl shadow-card" />
      </section>
    </main>
  );
}
