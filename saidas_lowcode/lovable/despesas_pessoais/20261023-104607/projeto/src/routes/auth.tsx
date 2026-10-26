import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { desativada?: string } =>
    typeof s["desativada"] === "string" ? { desativada: s["desativada"] } : {},
  head: () => ({
    meta: [
      { title: "Entrar — Caderneta" },
      { name: "description", content: "Entre ou crie sua conta na Caderneta." },
      { property: "og:title", content: "Entrar — Caderneta" },
      { property: "og:description", content: "Entre ou crie sua conta na Caderneta." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { desativada } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "criar") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/painel", data: { full_name: name } },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/painel" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error(
        msg.includes("Invalid login") ? "E-mail ou senha incorretos." :
        msg.includes("not confirmed") ? "Confirme seu e-mail antes de entrar." :
        msg.includes("already registered") ? "Este e-mail já tem conta." : msg,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-3xl font-bold text-primary">
          <Wallet className="h-7 w-7" /> Caderneta
        </Link>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          {desativada && (
            <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Sua conta foi desativada pelo administrador.
            </p>
          )}
          {sent ? (
            <div className="text-center">
              <h2 className="text-xl font-bold">Confira seu e-mail</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Enviamos um link para <b>{email}</b>. Clique nele para ativar sua conta.
              </p>
              <Button variant="link" onClick={() => { setSent(false); setMode("entrar"); }}>
                Voltar para entrar
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{mode === "entrar" ? "Entrar" : "Criar conta"}</h1>
              <form onSubmit={submit} className="mt-5 space-y-4">
                {mode === "criar" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Seu nome</Label>
                    <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Aguarde..." : mode === "entrar" ? "Entrar" : "Criar conta"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {mode === "entrar" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
                <button className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setMode(mode === "entrar" ? "criar" : "entrar")}>
                  {mode === "entrar" ? "Criar conta" : "Entrar"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
