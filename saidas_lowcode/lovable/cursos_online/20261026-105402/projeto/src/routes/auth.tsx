import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Saber+" },
      { name: "description", content: "Entre ou crie sua conta na plataforma de cursos Saber+." },
      { property: "og:title", content: "Entrar — Saber+" },
      { property: "og:description", content: "Entre ou crie sua conta na plataforma de cursos Saber+." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/cursos", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/cursos", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
      });
      if (error) toast.error(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("E-mail ou senha incorretos, ou e-mail ainda não confirmado.");
    }
    setBusy(false);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Não foi possível entrar com o Google.");
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border bg-card p-8 shadow-card">
          {sent ? (
            <div className="text-center">
              <h1 className="text-2xl font-semibold">Confirme seu e-mail</h1>
              <p className="mt-3 text-muted-foreground">
                Enviamos um link para <strong>{email}</strong>. Clique nele para ativar sua conta e depois entre aqui.
              </p>
              <Button className="mt-6" variant="outline" onClick={() => { setSent(false); setMode("login"); }}>
                Voltar para entrar
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-semibold">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
              <p className="mt-2 text-muted-foreground">
                {mode === "login" ? "Bem-vindo de volta!" : "Leva menos de um minuto."}
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </Button>
              </form>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="w-full" onClick={google}>
                Continuar com Google
              </Button>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
                <button className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                  {mode === "login" ? "Criar conta" : "Entrar"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
