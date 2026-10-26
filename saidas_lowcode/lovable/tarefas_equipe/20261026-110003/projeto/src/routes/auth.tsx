import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Equipe em Dia" },
      { name: "description", content: "Entre ou crie sua conta na Equipe em Dia." },
      { property: "og:title", content: "Entrar — Equipe em Dia" },
      { property: "og:description", content: "Entre ou crie sua conta na Equipe em Dia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "entrar" | "criar" | "esqueci";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/painel", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("E-mail ou senha incorretos, ou e-mail ainda não confirmado.");
      } else if (mode === "criar") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/painel", data: { full_name: name } },
        });
        if (error) throw error;
        setSent("Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar a conta.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setSent("Se o e-mail existir, você receberá um link para criar uma nova senha.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Não foi possível entrar com o Google");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-soft">
        <Link to="/" className="font-display text-lg font-bold">Equipe em Dia</Link>
        <h1 className="mt-6 text-2xl font-bold">
          {mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Recuperar senha"}
        </h1>
        {sent ? (
          <p className="mt-4 rounded-lg bg-secondary p-4 text-sm">{sent}</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
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
            {mode !== "esqueci" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Enviar link"}
            </Button>
            {mode !== "esqueci" && (
              <Button type="button" variant="outline" className="w-full" onClick={google}>
                Continuar com Google
              </Button>
            )}
          </form>
        )}
        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          {mode !== "entrar" && (
            <button className="underline" onClick={() => { setMode("entrar"); setSent(null); }}>Já tenho conta</button>
          )}
          {mode === "entrar" && (
            <>
              <button className="block w-full underline" onClick={() => setMode("criar")}>Criar uma conta</button>
              <button className="block w-full underline" onClick={() => setMode("esqueci")}>Esqueci minha senha</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
