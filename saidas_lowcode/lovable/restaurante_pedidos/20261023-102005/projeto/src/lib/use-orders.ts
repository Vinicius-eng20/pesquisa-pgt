import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OrderRow } from "@/components/OrderCard";

// RLS returns only the user's own orders, or all orders for the manager.
export function useOrders(key: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["orders", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, dish_name, quantity, unit_price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderRow[];
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("orders-" + key)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        setTimeout(() => qc.invalidateQueries({ queryKey: ["orders", key] }), 400);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [key, qc]);
  return q;
}
