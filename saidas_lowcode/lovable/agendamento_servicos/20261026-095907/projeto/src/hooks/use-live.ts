import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Refresh data whenever someone changes services, slots or bookings. */
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel(`live-${Math.random().toString(36).slice(2)}`);
    for (const table of ["services", "slots", "bookings"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryClient.invalidateQueries();
      });
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
