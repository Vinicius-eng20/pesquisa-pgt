import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Sabor da Casa" },
      { name: "description", content: "Entre ou crie sua conta para fazer pedidos." },
      { property: "og:title", content: "Entrar — Sabor da Casa" },
      { property: "og:description", content: "Entre ou crie sua conta para fazer pedidos." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
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
    if (mode === "up") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
      });
      if (error) toast.error(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("E-mail ou senha incorretos (ou e-mail ainda não confirmado).");
    }
    setBusy(false);
  };

  if (sent)
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-warm">
        <h1 className="text-2xl font-semibold">Confira seu e-mail</h1>
        <p className="mt-3 text-muted-foreground">Enviamos um link para {email}. Clique nele para ativar sua conta e depois entre aqui.</p>
        <Button className="mt-6" onClick={() => { setSent(false); setMode("in"); }}>Voltar para entrar</Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 shadow-warm">
      <h1 className="text-3xl font-semibold">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "up" && (
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
          {busy ? "Aguarde..." : mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
      <button
        className="mt-4 w-full text-sm text-primary underline-offset-4 hover:underline"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "Não tem conta? Crie uma" : "Já tem conta? Entrar"}
      </button>
    </div>
  );
}
