import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  employeesQuery,
  orderItemsQuery,
  ordersQuery,
} from "@/lib/pos-queries";
import { formatKzt, PAYMENT_LABELS } from "@/lib/pos";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Отчёты по продажам точки" },
      {
        name: "description",
        content: "Выручка, средний чек, топ товаров, продажи по кассирам и способам оплаты.",
      },
      { property: "og:title", content: "Отчёты по продажам точки" },
      { property: "og:description", content: "Аналитика продаж в тенге за день, неделю и месяц." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reports,
});

function rangeFor(period: "today" | "week" | "month") {
  const to = new Date();
  const from = new Date();
  if (period === "today") from.setHours(0, 0, 0, 0);
  if (period === "week") from.setDate(from.getDate() - 7);
  if (period === "month") from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

function Reports() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const { from, to } = useMemo(() => rangeFor(period), [period]);
  const orders = useQuery(ordersQuery(from, to));
  const items = useQuery(orderItemsQuery(from, to));
  const employees = useQuery(employeesQuery);

  const paid = (orders.data ?? []).filter((o) => o.status === "paid");
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const avg = paid.length ? Math.round(revenue / paid.length) : 0;
  const cash = paid.reduce((s, o) => s + o.cash_amount, 0);
  const card = paid.reduce((s, o) => s + o.card_amount, 0);
  const refunds = (orders.data ?? []).filter((o) => o.status === "refunded");

  const top = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; sum: number }>();
    for (const i of items.data ?? []) {
      if (i.orders?.status !== "paid") continue;
      const cur = map.get(i.name) ?? { name: i.name, qty: 0, sum: 0 };
      cur.qty += Number(i.qty);
      cur.sum += i.total;
      map.set(i.name, cur);
    }
    return [...map.values()].sort((a, b) => b.sum - a.sum).slice(0, 10);
  }, [items.data]);

  const byCashier = useMemo(() => {
    const map = new Map<string, { name: string; count: number; sum: number }>();
    for (const o of paid) {
      const name =
        (employees.data ?? []).find((e) => e.id === o.employee_id)?.name ?? "Без кассира";
      const cur = map.get(name) ?? { name, count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += o.total;
      map.set(name, cur);
    }
    return [...map.values()].sort((a, b) => b.sum - a.sum);
  }, [paid, employees.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Отчёты</h1>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Выручка" value={formatKzt(revenue)} />
        <Stat label="Чеков" value={String(paid.length)} />
        <Stat label="Средний чек" value={formatKzt(avg)} />
        <Stat label="Возвраты" value={String(refunds.length)} />
        <Stat label={PAYMENT_LABELS.cash} value={formatKzt(cash)} />
        <Stat label={PAYMENT_LABELS.card} value={formatKzt(card)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Топ товаров">
          {top.length === 0 && <Empty />}
          {top.map((t) => (
            <div key={t.name} className="flex justify-between border-b border-border py-2 text-sm">
              <span>
                {t.name} <span className="text-muted-foreground">× {t.qty}</span>
              </span>
              <span className="font-semibold">{formatKzt(t.sum)}</span>
            </div>
          ))}
        </Panel>
        <Panel title="По кассирам">
          {byCashier.length === 0 && <Empty />}
          {byCashier.map((c) => (
            <div key={c.name} className="flex justify-between border-b border-border py-2 text-sm">
              <span>
                {c.name} <span className="text-muted-foreground">· {c.count} чек(ов)</span>
              </span>
              <span className="font-semibold">{formatKzt(c.sum)}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-muted-foreground">Нет данных за период</p>;
}
