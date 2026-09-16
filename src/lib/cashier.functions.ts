import { createServerFn } from "@tanstack/react-start";
import type { KaspiResult, FulfillmentStatus } from "@/lib/pos";

/**
 * Серверные функции кассы. Кассир работает без почты и пароля:
 * каждая операция подтверждается его личным PIN-кодом.
 */

export type CashierEmployee = { id: string; name: string; role: string };

export type CashierProduct = {
  id: string;
  name: string;
  category_id: string | null;
  price: number;
  emoji: string | null;
  image_url: string | null;
  in_stop_list: boolean;
  track_stock: boolean;
  stock: number;
};

export type CashierCategory = { id: string; name: string; sort: number };
export type CashierModifier = { id: string; name: string; price: number; category_id: string | null };

export type CashierSettings = {
  shop_name: string;
  address: string;
  phone: string;
  receipt_footer: string;
  vat_percent: number;
  auto_print: boolean;
  print_copies: number;
  kaspi_enabled: boolean;
};

export type CashierShift = {
  id: string;
  opened_at: string;
  cash_start: number;
  employee_id: string | null;
} | null;

export type CashierOrder = {
  id: string;
  order_no: number;
  created_at: string;
  total: number;
  status: string;
  fulfillment_status: string;
  employee_id: string | null;
  items: { name: string; qty: number }[];
};

export type CashierLineInput = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  modifiers: { id: string; name: string; price: number }[];
  trackStock: boolean;
};

async function getDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function authorize(pin: string) {
  const clean = String(pin ?? "").replace(/\D/g, "").slice(0, 8);
  if (clean.length < 4) throw new Error("Введите PIN-код");
  const db = await getDb();
  const { data, error } = await db
    .from("employees")
    .select("id, name, role")
    .eq("pin", clean)
    .eq("is_active", true)
    .limit(1);
  if (error) throw new Error(error.message);
  const employee = data?.[0];
  if (!employee) throw new Error("Неверный PIN-код");
  return { db, employee: employee as CashierEmployee };
}

export const cashierLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { pin: string }) => input)
  .handler(async ({ data }): Promise<CashierEmployee> => {
    const { employee } = await authorize(data.pin);
    return employee;
  });

export const cashierData = createServerFn({ method: "POST" })
  .inputValidator((input: { pin: string }) => input)
  .handler(async ({ data }) => {
    const { db } = await authorize(data.pin);

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const [categories, products, modifiers, settings, shift, orders] = await Promise.all([
      db.from("categories").select("id, name, sort").order("sort"),
      db
        .from("products")
        .select(
          "id, name, category_id, price, emoji, image_url, in_stop_list, track_stock, stock",
        )
        .eq("is_active", true)
        .order("sort")
        .order("name"),
      db
        .from("modifiers")
        .select("id, name, price, category_id")
        .eq("is_active", true)
        .order("name"),
      db
        .from("settings")
        .select(
          "shop_name, address, phone, receipt_footer, vat_percent, auto_print, print_copies, kaspi_enabled",
        )
        .limit(1)
        .maybeSingle(),
      db
        .from("shifts")
        .select("id, opened_at, cash_start, employee_id")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("orders")
        .select("id, order_no, created_at, total, status, fulfillment_status, employee_id, order_items(name, qty)")
        .gte("created_at", dayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    type RawOrder = Omit<CashierOrder, "items"> & {
      order_items: { name: string; qty: number }[] | null;
    };

    return {
      categories: (categories.data ?? []) as CashierCategory[],
      products: ((products.data ?? []) as CashierProduct[]).map((p) => ({
        ...p,
        stock: Number(p.stock),
      })),
      modifiers: (modifiers.data ?? []) as CashierModifier[],
      settings: (settings.data ?? null) as CashierSettings | null,
      shift: (shift.data ?? null) as CashierShift,
      orders: ((orders.data ?? []) as unknown as RawOrder[]).map((o) => ({
        id: o.id,
        order_no: Number(o.order_no),
        created_at: o.created_at,
        total: o.total,
        status: o.status,
        fulfillment_status: o.fulfillment_status,
        employee_id: o.employee_id,
        items: (o.order_items ?? []).map((i) => ({ name: i.name, qty: Number(i.qty) })),
      })) as CashierOrder[],
    };
  });

export const cashierShift = createServerFn({ method: "POST" })
  .inputValidator((input: { pin: string; mode: "open" | "close"; amount: number }) => input)
  .handler(async ({ data }) => {
    const { db, employee } = await authorize(data.pin);
    const amount = Math.round(Number(data.amount) || 0);

    if (data.mode === "open") {
      const { error } = await db
        .from("shifts")
        .insert({ employee_id: employee.id, cash_start: amount, status: "open" });
      if (error) throw new Error(error.message);
    } else {
      const { data: open } = await db
        .from("shifts")
        .select("id")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!open) throw new Error("Открытой смены нет");
      const { error } = await db
        .from("shifts")
        .update({ cash_end: amount, closed_at: new Date().toISOString(), status: "closed" })
        .eq("id", open.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const cashierCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      pin: string;
      lines: CashierLineInput[];
      discount: number;
      method: "cash" | "card" | "mixed";
      cashReceived: number;
      cardPart: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { db, employee } = await authorize(data.pin);
    if (!data.lines.length) throw new Error("Чек пуст");

    const subtotal = data.lines.reduce(
      (sum, l) =>
        sum + Math.round((l.price + l.modifiers.reduce((s, m) => s + m.price, 0)) * l.qty),
      0,
    );
    const discount = Math.min(subtotal, Math.max(0, Math.round(data.discount || 0)));
    const total = Math.max(0, subtotal - discount);
    const cardAmount =
      data.method === "cash" ? 0 : data.method === "mixed" ? Math.round(data.cardPart) : total;
    const cashAmount = total - cardAmount;
    const cashReceived = data.method === "card" ? 0 : Math.round(data.cashReceived || 0);
    const change = Math.max(0, cashReceived - cashAmount);

    const { data: open } = await db
      .from("shifts")
      .select("id")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!open) throw new Error("Сначала откройте смену");

    const { data: order, error } = await db
      .from("orders")
      .insert({
        shift_id: open.id,
        employee_id: employee.id,
        subtotal,
        discount,
        total,
        payment_method: data.method,
        cash_amount: cashAmount,
        card_amount: cardAmount,
        cash_received: cashReceived,
        change_given: change,
        status: "paid",
        fulfillment_status: "cooking",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsError } = await db.from("order_items").insert(
      data.lines.map((l) => ({
        order_id: order.id,
        product_id: l.productId,
        name: l.name,
        price: l.price,
        qty: l.qty,
        modifiers: l.modifiers,
        total: Math.round((l.price + l.modifiers.reduce((s, m) => s + m.price, 0)) * l.qty),
      })),
    );
    if (itemsError) throw new Error(itemsError.message);

    const stock = data.lines
      .filter((l) => l.trackStock)
      .map((l) => ({
        product_id: l.productId,
        qty: -l.qty,
        type: "sale",
        note: `Продажа №${order.order_no}`,
      }));
    if (stock.length) await db.from("stock_movements").insert(stock);

    let fiscal: KaspiResult = { status: "not_configured" };
    try {
      const { runFiscalization } = await import("@/lib/kaspi.server");
      fiscal = await runFiscalization(db, {
        orderId: order.id,
        orderNo: Number(order.order_no),
        amount: total,
        method: data.method,
        cashAmount,
        cardAmount,
      });
    } catch (e) {
      fiscal = { status: "error", message: e instanceof Error ? e.message : "Ошибка Kaspi" };
    }

    return {
      order: {
        id: order.id as string,
        order_no: Number(order.order_no),
        created_at: order.created_at as string,
        subtotal,
        discount,
        total,
        payment_method: data.method,
        cash_amount: cashAmount,
        card_amount: cardAmount,
        cash_received: cashReceived,
        change_given: change,
      },
      cashier: employee.name,
      fiscal,
    };
  });

export const cashierSetStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { pin: string; orderId: string; status: FulfillmentStatus }) => input)
  .handler(async ({ data }) => {
    const { db } = await authorize(data.pin);
    if (!["cooking", "done", "cancelled"].includes(data.status))
      throw new Error("Неизвестный статус");
    const { error } = await db
      .from("orders")
      .update({ fulfillment_status: data.status })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
