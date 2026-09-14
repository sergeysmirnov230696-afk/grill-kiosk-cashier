import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  employeesQuery,
  ordersQuery,
  settingsQuery,
  shiftsQuery,
  type Order,
  type OrderItem,
} from "@/lib/pos-queries";
import { formatDateTime, formatKzt, formatTime, PAYMENT_LABELS } from "@/lib/pos";
import { Receipt, type ReceiptData } from "@/components/pos/Receipt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Чеки и смены — касса точки" },
      {
        name: "description",
        content: "История чеков, возвраты продаж, X- и Z-отчёты по сменам кассиров.",
      },
      { property: "og:title", content: "Чеки и смены — касса точки" },
      { property: "og:description", content: "История продаж, возвраты и отчёты по сменам." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function rangeFor(period: "today" | "week" | "month") {
  const to = new Date();
  const from = new Date();
  if (period === "today") from.setHours(0, 0, 0, 0);
  if (period === "week") from.setDate(from.getDate() - 7);
  if (period === "month") from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

function OrdersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"orders" | "shifts">("orders");
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const { from, to } = useMemo(() => rangeFor(period), [period]);

  const orders = useQuery(ordersQuery(from, to));
  const employees = useQuery(employeesQuery);
  const settings = useQuery(settingsQuery);
  const shifts = useQuery(shiftsQuery);

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [shiftReport, setShiftReport] = useState<string | null>(null);

  const employeeName = (id: string | null) =>
    (employees.data ?? []).find((e) => e.id === id)?.name ?? "—";

  const openReceipt = useMutation({
    mutationFn: async (order: Order) => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);
      if (error) throw new Error(error.message);
      return { order, items: (data ?? []) as OrderItem[] };
    },
    onSuccess: ({ order, items }) => {
      setReceipt({
        orderNo: order.order_no,
        createdAt: order.created_at,
        cashier: employeeName(order.employee_id),
        lines: items.map((i) => ({
          name: i.name,
          qty: Number(i.qty),
          price: i.price,
          total: i.total,
          extra:
            (Array.isArray(i.modifiers) ? (i.modifiers as { name: string }[]) : [])
              .map((m) => m.name)
              .join(", ") || undefined,
        })),
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        paymentMethod: order.payment_method,
        cashAmount: order.cash_amount,
        cardAmount: order.card_amount,
        cashReceived: order.cash_received,
        change: order.change_given,
        refunded: order.status === "refunded",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refund = useMutation({
    mutationFn: async (order: Order) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "refunded" })
        .eq("id", order.id);
      if (error) throw new Error(error.message);

      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, qty")
        .eq("order_id", order.id);
      const moves = (items ?? [])
        .filter((i) => i.product_id)
        .map((i) => ({
          product_id: i.product_id as string,
          qty: Number(i.qty),
          type: "refund",
          note: `Возврат по чеку №${order.order_no}`,
        }));
      if (moves.length) await supabase.from("stock_movements").insert(moves);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      toast.success("Возврат оформлен");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = orders.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Чеки и смены</h1>
        <Button size="sm" variant={tab === "orders" ? "default" : "secondary"} onClick={() => setTab("orders")}>
          Чеки
        </Button>
        <Button size="sm" variant={tab === "shifts" ? "default" : "secondary"} onClick={() => setTab("shifts")}>
          Смены
        </Button>
      </div>

      {tab === "orders" && (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["today", "Сегодня"],
                ["week", "7 дней"],
                ["month", "30 дней"],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={period === k ? "default" : "secondary"}
                onClick={() => setPeriod(k)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">№</th>
                  <th className="p-3">Время</th>
                  <th className="p-3">Кассир</th>
                  <th className="p-3">Оплата</th>
                  <th className="p-3 text-right">Сумма</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      Чеков за период нет
                    </td>
                  </tr>
                )}
                {list.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="p-3 font-semibold">{o.order_no}</td>
                    <td className="p-3">{formatDateTime(o.created_at)}</td>
                    <td className="p-3">{employeeName(o.employee_id)}</td>
                    <td className="p-3">{PAYMENT_LABELS[o.payment_method] ?? o.payment_method}</td>
                    <td className="p-3 text-right font-semibold">{formatKzt(o.total)}</td>
                    <td className="p-3">
                      {o.status === "refunded" ? (
                        <span className="text-destructive">Возврат</span>
                      ) : (
                        <span className="text-secondary">Оплачен</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openReceipt.mutate(o)}>
                          <Printer className="size-4" />
                        </Button>
                        {o.status !== "refunded" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Оформить возврат по чеку №${o.order_no}?`)) refund.mutate(o);
                            }}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "shifts" && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Открыта</th>
                <th className="p-3">Закрыта</th>
                <th className="p-3">Кассир</th>
                <th className="p-3 text-right">Касса на начало</th>
                <th className="p-3 text-right">Касса на конец</th>
                <th className="p-3">Статус</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {(shifts.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Смен пока нет
                  </td>
                </tr>
              )}
              {(shifts.data ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3">{formatDateTime(s.opened_at)}</td>
                  <td className="p-3">{s.closed_at ? formatDateTime(s.closed_at) : "—"}</td>
                  <td className="p-3">{employeeName(s.employee_id)}</td>
                  <td className="p-3 text-right">{formatKzt(s.cash_start)}</td>
                  <td className="p-3 text-right">{s.cash_end == null ? "—" : formatKzt(s.cash_end)}</td>
                  <td className="p-3">{s.status === "open" ? "Открыта" : "Закрыта"}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setShiftReport(s.id)}>
                      {s.status === "open" ? "X-отчёт" : "Z-отчёт"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Чек</DialogTitle>
          </DialogHeader>
          {receipt && <Receipt data={receipt} settings={settings.data ?? null} />}
          <DialogFooter>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Печать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShiftReportDialog
        shiftId={shiftReport}
        onClose={() => setShiftReport(null)}
        employeeName={employeeName}
      />
    </div>
  );
}

function ShiftReportDialog({
  shiftId,
  onClose,
  employeeName,
}: {
  shiftId: string | null;
  onClose: () => void;
  employeeName: (id: string | null) => string;
}) {
  const shifts = useQuery(shiftsQuery);
  const shift = (shifts.data ?? []).find((s) => s.id === shiftId) ?? null;

  const report = useQuery({
    queryKey: ["shift-report", shiftId],
    enabled: !!shiftId,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("shift_id", shiftId!);
      if (error) throw new Error(error.message);
      return (data ?? []) as Order[];
    },
  });

  const paid = (report.data ?? []).filter((o) => o.status === "paid");
  const refunded = (report.data ?? []).filter((o) => o.status === "refunded");
  const cash = paid.reduce((s, o) => s + o.cash_amount, 0);
  const card = paid.reduce((s, o) => s + o.card_amount, 0);
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const expected = (shift?.cash_start ?? 0) + cash;
  const diff = shift?.cash_end == null ? null : shift.cash_end - expected;

  return (
    <Dialog open={!!shiftId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{shift?.status === "open" ? "X-отчёт (без закрытия)" : "Z-отчёт смены"}</DialogTitle>
        </DialogHeader>
        {shift && (
          <div className="space-y-2 text-sm">
            <Row label="Кассир" value={employeeName(shift.employee_id)} />
            <Row label="Открыта" value={formatTime(shift.opened_at)} />
            <Row label="Закрыта" value={shift.closed_at ? formatTime(shift.closed_at) : "—"} />
            <hr className="border-border" />
            <Row label="Чеков" value={String(paid.length)} />
            <Row label="Возвратов" value={String(refunded.length)} />
            <Row label="Выручка" value={formatKzt(revenue)} />
            <Row label={PAYMENT_LABELS.cash} value={formatKzt(cash)} />
            <Row label={PAYMENT_LABELS.card} value={formatKzt(card)} />
            <hr className="border-border" />
            <Row label="Касса на начало" value={formatKzt(shift.cash_start)} />
            <Row label="Наличных должно быть" value={formatKzt(expected)} />
            <Row
              label="Фактически в кассе"
              value={shift.cash_end == null ? "—" : formatKzt(shift.cash_end)}
            />
            {diff != null && (
              <Row
                label={diff === 0 ? "Расхождений нет" : diff > 0 ? "Излишек" : "Недостача"}
                value={formatKzt(Math.abs(diff))}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
