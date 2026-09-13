import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { productsQuery, stockMovementsQuery } from "@/lib/pos-queries";
import { formatDateTime } from "@/lib/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/stock")({
  head: () => ({
    meta: [
      { title: "Склад и остатки точки" },
      {
        name: "description",
        content: "Приход, списание и корректировка остатков по товарам с историей движений.",
      },
      { property: "og:title", content: "Склад и остатки точки" },
      { property: "og:description", content: "Учёт остатков и движений товара." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StockPage,
});

const TYPE_LABELS: Record<string, string> = {
  in: "Приход",
  out: "Списание",
  adjust: "Корректировка",
};

function StockPage() {
  const qc = useQueryClient();
  const products = useQuery(productsQuery);
  const movements = useQuery(stockMovementsQuery);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"in" | "out" | "adjust">("in");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");

  const tracked = (products.data ?? []).filter((p) => p.track_stock);

  const add = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("Выберите товар");
      const value = Number(qty);
      if (!value || Number.isNaN(value)) throw new Error("Укажите количество");
      const signed = type === "out" ? -Math.abs(value) : value;
      const { error } = await supabase.from("stock_movements").insert({
        product_id: productId,
        qty: signed,
        type,
        note: note.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setQty("1");
      setNote("");
      toast.success("Движение записано");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const productName = (id: string) =>
    (products.data ?? []).find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Склад</h1>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Новое движение</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="grid gap-1.5 md:col-span-2">
            <Label>Товар</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите товар" />
              </SelectTrigger>
              <SelectContent>
                {tracked.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Тип</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Приход</SelectItem>
                <SelectItem value="out">Списание</SelectItem>
                <SelectItem value="adjust">Корректировка</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Количество</Label>
            <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Комментарий</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <Button className="mt-3" disabled={add.isPending} onClick={() => add.mutate()}>
          Записать
        </Button>
        {tracked.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Включите учёт остатков у товара в разделе «Товары».
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 text-lg font-semibold">Текущие остатки</h2>
          {tracked.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-border py-2 text-sm">
              <span>{p.name}</span>
              <span
                className={Number(p.stock) <= 0 ? "font-semibold text-destructive" : "font-semibold"}
              >
                {p.stock} {p.unit}
              </span>
            </div>
          ))}
          {tracked.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Нет товаров с учётом</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-2 text-lg font-semibold">История движений</h2>
          {(movements.data ?? []).map((m) => (
            <div key={m.id} className="border-b border-border py-2 text-sm last:border-0">
              <div className="flex justify-between">
                <span>{productName(m.product_id)}</span>
                <span className={Number(m.qty) < 0 ? "text-destructive" : "text-secondary"}>
                  {Number(m.qty) > 0 ? "+" : ""}
                  {m.qty}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {TYPE_LABELS[m.type] ?? m.type} · {formatDateTime(m.created_at)}
                {m.note ? ` · ${m.note}` : ""}
              </p>
            </div>
          ))}
          {(movements.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Движений пока нет</p>
          )}
        </section>
      </div>
    </div>
  );
}
