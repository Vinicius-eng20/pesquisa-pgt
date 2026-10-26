import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarHeart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Inscreva" },
      { name: "description", content: "Entre ou crie sua conta para se inscrever em eventos." },
      { property: "og:title", content: "Entrar — Inscreva" },
      { property: "og:description", content: "Entre ou crie sua conta para se inscrever em eventos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/eventos" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/eventos", data: { full_name: name } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/eventos" });
        else setSent(true);
      }
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-card">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold">
          <CalendarHeart className="h-5 w-5 text-accent" /> Inscreva
        </Link>
        {sent ? (
          <div className="mt-6">
            <h1 className="text-2xl font-semibold">Confira seu e-mail</h1>
            <p className="mt-2 text-muted-foreground">
              Enviamos um link de confirmação para <b>{email}</b>. Clique nele para ativar sua conta e depois entre aqui.
            </p>
            <Button className="mt-6 w-full" onClick={() => { setSent(false); setMode("login"); }}>
              Voltar para entrar
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <h1 className="text-2xl font-semibold">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
            {mode === "signup" && (
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
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
