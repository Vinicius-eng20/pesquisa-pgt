import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meu Bolso — Controle de despesas pessoais" },
      { name: "description", content: "Registre seus gastos, organize por categoria e veja quanto gastou no mês." },
      { property: "og:title", content: "Meu Bolso — Controle de despesas pessoais" },
      { property: "og:description", content: "Registre seus gastos, organize por categoria e veja quanto gastou no mês." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/painel" : "/auth" });
  },
});
