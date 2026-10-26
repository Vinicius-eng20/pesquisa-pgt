import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("profiles").select("full_name, email").eq("id", u.user.id).maybeSingle(),
      ]);
      return {
        id: u.user.id,
        email: u.user.email ?? "",
        name: profile?.full_name || u.user.email || "",
        isOrganizer: !!roles?.some((r) => r.role === "organizer"),
      };
    },
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function friendlyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  if (msg.includes("duplicate key")) return "Você já está inscrito neste evento.";
  if (msg.includes("Invalid login")) return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (msg.includes("already registered")) return "Já existe uma conta com este e-mail.";
  return msg;
}
