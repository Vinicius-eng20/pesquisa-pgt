import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LOAN_DAYS = 14;

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      name: profile?.full_name || u.user.email || "",
      blocked: profile?.blocked ?? false,
      isLibrarian: (roles ?? []).some((r) => r.role === "librarian"),
    };
  },
});

export const itemsQuery = (userId: string) => queryOptions({
  queryKey: ["items", userId],
  queryFn: async () => {
    const [{ data: items, error }, { data: open }] = await Promise.all([
      supabase.from("items").select("*").order("title"),
      supabase.from("loans").select("item_id").eq("user_id", userId).is("returned_at", null),
    ]);
    if (error) throw error;
    const avail = await Promise.all(
      (items ?? []).map((i) => supabase.rpc("available_copies", { _item: i.id })),
    );
    return (items ?? []).map((i, idx) => ({
      ...i,
      available: avail[idx]?.data ?? 0,
      mine: (open ?? []).some((l) => l.item_id === i.id),
    }));
  },
});

export const myLoansQuery = (userId: string) =>
  queryOptions({
    queryKey: ["loans", "mine", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .eq("user_id", userId)
        .order("borrowed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const allLoansQuery = queryOptions({
  queryKey: ["loans", "all"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("loans")
      .select("*, profiles(full_name, email)")
      .order("borrowed_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const readersQuery = queryOptions({
  queryKey: ["readers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("full_name");
    if (error) throw error;
    return data ?? [];
  },
});

export function isOverdue(l: { due_at: string; returned_at: string | null }) {
  return !l.returned_at && new Date(l.due_at).getTime() < Date.now();
}

export const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR");
