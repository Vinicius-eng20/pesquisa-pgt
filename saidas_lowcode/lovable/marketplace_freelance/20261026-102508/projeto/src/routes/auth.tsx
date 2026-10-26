import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Ofício" },
      { name: "description", content: "Entre ou crie sua conta no Ofício para publicar e contratar serviços freelance." },
      { property: "og:title", content: "Entrar — Ofício" },
      { property: "og:description", content: "Entre ou crie sua conta no Ofício." },
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
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/explorar", data: { display_name: name } },
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/explorar" });
      }
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(msg.includes("Invalid login") ? "E-mail ou senha incorretos." : msg.includes("not confirmed") ? "Confirme seu e-mail antes de entrar." : msg);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("Não foi possível entrar com Google."); return; }
    if (r.redirected) return;
    navigate({ to: "/explorar" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-soft">
        <h1 className="font-display text-4xl font-semibold text-primary">ofício</h1>
        {sent ? (
          <p className="mt-6 text-sm">Enviamos um link para <b>{email}</b>. Abra seu e-mail e clique no link para confirmar sua conta.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{mode === "in" ? "Entre na sua conta" : "Crie sua conta grátis"}</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "up" && (
                <div className="space-y-1.5"><Label>Seu nome</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
              )}
              <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Senha</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button className="w-full" disabled={busy}>{mode === "in" ? "Entrar" : "Criar conta"}</Button>
            </form>
            <Button variant="outline" className="mt-3 w-full" onClick={google}>Continuar com Google</Button>
            <button className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
