import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Category = Tables<"categories">;
export type Product = Tables<"products">;
export type Modifier = Tables<"modifiers">;
export type Employee = Tables<"employees">;
export type Shift = Tables<"shifts">;
export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type Settings = Tables<"settings">;
export type StockMovement = Tables<"stock_movements">;

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: () => unwrap<Category[]>(supabase.from("categories").select("*").order("sort")),
});

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: () =>
    unwrap<Product[]>(supabase.from("products").select("*").order("sort").order("name")),
});

export const modifiersQuery = queryOptions({
  queryKey: ["modifiers"],
  queryFn: () => unwrap<Modifier[]>(supabase.from("modifiers").select("*").order("name")),
});

export const employeesQuery = queryOptions({
  queryKey: ["employees"],
  queryFn: () => unwrap<Employee[]>(supabase.from("employees").select("*").order("name")),
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Settings | null;
  },
});

export const openShiftQuery = queryOptions({
  queryKey: ["shift", "open"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Shift | null;
  },
});

export const shiftsQuery = queryOptions({
  queryKey: ["shifts"],
  queryFn: () =>
    unwrap<Shift[]>(
      supabase.from("shifts").select("*").order("opened_at", { ascending: false }).limit(100),
    ),
});

export function ordersQuery(from: string, to: string) {
  return queryOptions({
    queryKey: ["orders", from, to],
    queryFn: () =>
      unwrap<Order[]>(
        supabase
          .from("orders")
          .select("*")
          .gte("created_at", from)
          .lte("created_at", to)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function orderItemsQuery(from: string, to: string) {
  return queryOptions({
    queryKey: ["order_items", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, orders!inner(created_at, status)")
        .gte("orders.created_at", from)
        .lte("orders.created_at", to);
      if (error) throw new Error(error.message);
      return (data ?? []) as (OrderItem & { orders: { created_at: string; status: string } })[];
    },
  });
}

export const stockMovementsQuery = queryOptions({
  queryKey: ["stock_movements"],
  queryFn: () =>
    unwrap<StockMovement[]>(
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(200),
    ),
});
