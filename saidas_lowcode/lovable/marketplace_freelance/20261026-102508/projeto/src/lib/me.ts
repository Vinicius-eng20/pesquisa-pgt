import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        id: user.id,
        email: user.email ?? "",
        name: profile?.display_name ?? "",
        suspended: profile?.suspended ?? false,
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      };
    },
  });
}

export const brl = (n: number) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const CATEGORIES = ["Design", "Desenvolvimento", "Redação", "Marketing", "Tradução", "Vídeo e áudio", "Consultoria", "Outros"];

export const contractStatusLabel: Record<string, string> = {
  requested: "Aguardando prestador",
  accepted: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export const serviceStatusLabel: Record<string, string> = {
  pending: "Em análise",
  approved: "Publicado",
  removed: "Removido",
};
