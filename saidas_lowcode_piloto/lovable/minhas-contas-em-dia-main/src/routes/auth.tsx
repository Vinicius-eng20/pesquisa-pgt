import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Meu Bolso" },
      { name: "description", content: "Entre ou crie sua conta para controlar seus gastos pessoais." },
      { property: "og:title", content: "Entrar — Meu Bolso" },
      { property: "og:description", content: "Entre ou crie sua conta para controlar seus gastos pessoais." },
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
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/painel" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/painel", data: { display_name: name } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/painel" });
        else {
          toast.success("Conta criada! Confira seu e-mail e clique no link para confirmar.");
          setMode("in");
        }
      }
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(
        msg.includes("Invalid login") ? "E-mail ou senha incorretos." :
        msg.includes("not confirmed") ? "Confirme seu e-mail antes de entrar." :
        msg.includes("already registered") ? "Este e-mail já tem conta." : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-12 text-ink-foreground lg:flex">
        <div className="flex items-center gap-2 font-display text-2xl font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground"><Wallet className="h-5 w-5" /></span>
          Meu Bolso
        </div>
        <div>
          <h1 className="font-display text-5xl font-bold leading-tight">Saiba para onde vai cada real.</h1>
          <p className="mt-4 max-w-md text-lg opacity-80">Registre seus gastos, organize por categoria e veja o total do mês — no computador ou no celular.</p>
        </div>
        <p className="text-sm opacity-60">Seus dados ficam salvos com segurança na sua conta.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-3xl font-bold">{mode === "in" ? "Entrar" : "Criar conta"}</h2>
            <p className="mt-1 text-muted-foreground">{mode === "in" ? "Bem-vindo de volta." : "Leva menos de um minuto."}</p>
          </div>
          {mode === "up" && (
            <div className="space-y-2"><Label htmlFor="n">Seu nome</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          )}
          <div className="space-y-2"><Label htmlFor="e">E-mail</Label><Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="p">Senha</Label><Input id="p" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? "Aguarde..." : mode === "in" ? "Entrar" : "Criar conta"}</Button>
          <button type="button" className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
