import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KaspiResult = {
  status: "ok" | "not_configured" | "error";
  message?: string;
  fiscalNumber?: string;
  checkUrl?: string;
  txnId?: string;
};

type KaspiPayload = {
  orderId: string;
  orderNo: number;
  amount: number;
  method: "cash" | "card" | "mixed";
  cashAmount: number;
  cardAmount: number;
};

async function callKaspi(
  baseUrl: string,
  path: string,
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...body, DeviceToken: token }),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error(String(json['message'] ?? `Kaspi ${res.status}`));
  return json;
}

function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  const data = obj['data'];
  if (data && typeof data === "object") return pick(data as Record<string, unknown>, keys);
  return undefined;
}

/**
 * Отправляет чек на Kaspi Касса (терминал Kaspi Pay) для фискализации.
 * Возвращает номер фискального чека и ссылку для QR-кода.
 */
export const fiscalizeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: KaspiPayload) => input)
  .handler(async ({ data, context }): Promise<KaspiResult> => {
    const token = process.env['KASPI_DEVICE_TOKEN'];

    const { data: settings } = await context.supabase
      .from("settings")
      .select("kaspi_enabled, kaspi_api_url, kaspi_terminal_id")
      .limit(1)
      .maybeSingle();

    if (!settings?.kaspi_enabled) return { status: "not_configured", message: "Kaspi Касса выключена в настройках" };
    if (!token) return { status: "not_configured", message: "Не задан токен устройства Kaspi" };
    if (!settings.kaspi_api_url) return { status: "not_configured", message: "Не указан адрес Kaspi API" };

    try {
      const created = await callKaspi(settings.kaspi_api_url, "/payment/create", token, {
        TransactionId: data.orderId,
        ExternalId: String(data.orderNo),
        Amount: data.amount,
        OwnerId: settings.kaspi_terminal_id || undefined,
        PaymentMethod: data.method === "cash" ? "Cash" : "Card",
        CashAmount: data.cashAmount,
        CardAmount: data.cardAmount,
      });

      const txnId = pick(created, ["QrPaymentId", "TransactionId", "PaymentId", "id"]) ?? data.orderId;
      const fiscalNumber = pick(created, ["FiscalNumber", "ReceiptNumber", "CheckNumber"]);
      const checkUrl = pick(created, ["CheckUrl", "TicketUrl", "QrCodeLink", "Link"]);

      const patch = {
        fiscal_status: "ok",
        fiscal_number: fiscalNumber ?? null,
        fiscal_check_url: checkUrl ?? null,
        kaspi_txn_id: txnId,
        fiscal_error: null,
      };
      await context.supabase.from("orders").update(patch).eq("id", data.orderId);

      const result: KaspiResult = { status: "ok", txnId };
      if (fiscalNumber) result.fiscalNumber = fiscalNumber;
      if (checkUrl) result.checkUrl = checkUrl;
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка Kaspi";
      await context.supabase
        .from("orders")
        .update({ fiscal_status: "error", fiscal_error: message })
        .eq("id", data.orderId);
      return { status: "error", message };
    }
  });
