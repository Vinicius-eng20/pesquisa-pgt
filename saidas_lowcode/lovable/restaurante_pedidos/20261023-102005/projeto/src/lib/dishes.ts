import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDishes() {
  return useQuery({
    queryKey: ["dishes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dishes").select("*").order("category").order("name");
      if (error) throw error;
      return data;
    },
  });
}
