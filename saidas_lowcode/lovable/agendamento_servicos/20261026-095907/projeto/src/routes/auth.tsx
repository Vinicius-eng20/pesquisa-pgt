import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Agenda" },
      { name: "description", content: "Entre ou crie sua conta para marcar seus horários." },
      { property: "og:title", content: "Entrar — Agenda" },
      { property: "og:description", content: "Entre ou crie sua conta para marcar seus horários." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
      });
      if (error) toast.error(error.message);
      else if (!data.session) setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("E-mail ou senha incorretos.");
    }
    setBusy(false);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Não foi possível entrar com o Google.");
  };

  if (sent)
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
        <h1 className="text-2xl font-semibold">Confira seu e-mail</h1>
        <p className="mt-3 text-muted-foreground">
          Enviamos um link para <b>{email}</b>. Clique nele para ativar sua conta.
        </p>
      </div>
    );

  return (
    <div className="mx-auto mt-12 max-w-md rounded-2xl border bg-card p-8 shadow-soft">
      <h1 className="text-3xl font-semibold">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "login" ? "Acesse seus horários de qualquer aparelho." : "Leva menos de um minuto."}
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
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
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
      <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
      <Button variant="outline" className="w-full" onClick={google}>
        Continuar com Google
      </Button>
      <button
        className="mt-6 w-full text-sm text-primary underline-offset-4 hover:underline"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}
