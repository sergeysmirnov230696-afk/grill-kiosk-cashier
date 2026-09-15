import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Minus,
  Plus,
  Printer,
  Search,
  Settings2,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  categoriesQuery,
  employeesQuery,
  modifiersQuery,
  openShiftQuery,
  productsQuery,
  settingsQuery,
  type Employee,
  type Product,
} from "@/lib/pos-queries";
import {
  CASH_BILLS,
  cartSubtotal,
  formatKzt,
  formatTime,
  lineTotal,
  type CartLine,
  type CartModifier,
} from "@/lib/pos";
import { Receipt, type ReceiptData } from "@/components/pos/Receipt";
import { fiscalizeOrder, type KaspiResult } from "@/lib/kaspi.functions";
import { useAutoPrint } from "@/lib/use-auto-print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "Касса — продажи и расчёт сдачи" },
      {
        name: "description",
        content: "Экран кассира: товары, чек, скидка, оплата наличными и картой, сдача, смена.",
      },
      { property: "og:title", content: "Касса — продажи и расчёт сдачи" },
      { property: "og:description", content: "Быстрые продажи в тенге с печатью чека." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PosScreen,
});

function PosScreen() {
  const qc = useQueryClient();
  const categories = useQuery(categoriesQuery);
  const products = useQuery(productsQuery);
  const modifiers = useQuery(modifiersQuery);
  const employees = useQuery(employeesQuery);
  const settings = useQuery(settingsQuery);
  const shift = useQuery(openShiftQuery);

  const [cashier, setCashier] = useState<Employee | null>(null);
  const [pin, setPin] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<"cash" | "card" | "mixed">("cash");
  const [cashReceived, setCashReceived] = useState(0);
  const [cardPart, setCardPart] = useState(0);
  const [modProduct, setModProduct] = useState<Product | null>(null);
  const [pickedMods, setPickedMods] = useState<CartModifier[]>([]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [cashField, setCashField] = useState("");

  const subtotal = cartSubtotal(lines);
  const total = Math.max(0, subtotal - discount);
  const change = Math.max(0, cashReceived - (method === "mixed" ? total - cardPart : total));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products.data ?? []).filter(
      (p) =>
        p.is_active &&
        (!category || p.category_id === category) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
  }, [products.data, category, search]);

  function addProduct(p: Product, mods: CartModifier[] = []) {
    if (p.in_stop_list) {
      toast.error(`${p.name} в стоп-листе`);
      return;
    }
    const key = p.id + "|" + mods.map((m) => m.id).sort().join(",");
    setLines((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...prev,
        {
          key,
          productId: p.id,
          name: p.name,
          price: p.price,
          qty: 1,
          emoji: p.emoji,
          imageUrl: p.image_url,
          modifiers: mods,
          trackStock: p.track_stock,
        },
      ];
    });
  }

  function changeQty(key: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  const shiftMutation = useMutation({
    mutationFn: async (mode: "open" | "close") => {
      const amount = Math.round(Number(cashField.replace(/\s/g, "")) || 0);
      if (mode === "open") {
        const { error } = await supabase.from("shifts").insert({
          employee_id: cashier?.id ?? null,
          cash_start: amount,
          status: "open",
        });
        if (error) throw new Error(error.message);
      } else {
        if (!shift.data) return;
        const { error } = await supabase
          .from("shifts")
          .update({ cash_end: amount, closed_at: new Date().toISOString(), status: "closed" })
          .eq("id", shift.data.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      setShiftOpen(false);
      setCashField("");
      qc.invalidateQueries({ queryKey: ["shift"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Смена обновлена");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const cashPart = method === "card" ? 0 : method === "mixed" ? total - cardPart : total;
      const cardAmount = method === "cash" ? 0 : method === "mixed" ? cardPart : total;
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          shift_id: shift.data?.id ?? null,
          employee_id: cashier?.id ?? null,
          subtotal,
          discount,
          total,
          payment_method: method,
          cash_amount: cashPart,
          card_amount: cardAmount,
          cash_received: method === "card" ? 0 : cashReceived,
          change_given: method === "card" ? 0 : change,
          status: "paid",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const items = lines.map((l) => ({
        order_id: order.id,
        product_id: l.productId,
        name: l.name,
        price: l.price,
        qty: l.qty,
        modifiers: l.modifiers,
        total: lineTotal(l),
      }));
      const { error: itemsError } = await supabase.from("order_items").insert(items);
      if (itemsError) throw new Error(itemsError.message);

      const stock = lines
        .filter((l) => l.trackStock)
        .map((l) => ({
          product_id: l.productId,
          qty: -l.qty,
          type: "sale",
          note: `Продажа №${order.order_no}`,
        }));
      if (stock.length) await supabase.from("stock_movements").insert(stock);

      let fiscal: KaspiResult = { status: "not_configured" };
      if (settings.data?.kaspi_enabled) {
        try {
          fiscal = await fiscalize({
            data: {
              orderId: order.id,
              orderNo: Number(order.order_no),
              amount: total,
              method,
              cashAmount: cashPart,
              cardAmount,
            },
          });
        } catch (e) {
          fiscal = { status: "error", message: e instanceof Error ? e.message : "Ошибка Kaspi" };
        }
      }

      return { order, fiscal };
    },
    onSuccess: ({ order, fiscal }) => {
      if (fiscal.status === "error") toast.error(`Kaspi Касса: ${fiscal.message ?? "ошибка"}`);
      if (fiscal.status === "ok") toast.success("Чек отправлен в Kaspi Касса");
      setReceipt({
        orderNo: order.order_no,
        createdAt: order.created_at,
        cashier: cashier?.name ?? "—",
        lines: lines.map((l) => ({
          name: l.name,
          qty: l.qty,
          price: l.price,
          total: lineTotal(l),
          extra: l.modifiers.map((m) => m.name).join(", ") || undefined,
        })),
        subtotal,
        discount,
        total,
        paymentMethod: order.payment_method,
        cashAmount: order.cash_amount,
        cardAmount: order.card_amount,
        cashReceived: order.cash_received,
        change: order.change_given,
        fiscalNumber: fiscal.fiscalNumber,
        checkUrl: fiscal.checkUrl,
      });
      setLines([]);
      setDiscount(0);
      setPayOpen(false);
      setCashReceived(0);
      setCardPart(0);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useAutoPrint(!!receipt, settings.data?.auto_print ?? true, settings.data?.print_copies ?? 1);

  const activeEmployees = (employees.data ?? []).filter((e) => e.is_active);

  if (!cashier) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-2xl font-bold">Вход на кассу</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Выберите сотрудника и введите PIN-код
          </p>
          <div className="mt-6 grid gap-2">
            {activeEmployees.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  if (pin === e.pin) {
                    setCashier(e);
                    setPin("");
                  } else {
                    toast.error("Неверный PIN");
                  }
                }}
                className="tile-press flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left"
              >
                <User className="size-5 text-primary" />
                <span className="font-medium">{e.name}</span>
              </button>
            ))}
          </div>
          <Input
            value={pin}
            onChange={(ev) => setPin(ev.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="PIN"
            className="mt-4 text-center text-2xl tracking-[0.5em]"
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map((k) => (
              <Button
                key={k}
                variant="secondary"
                size="lg"
                onClick={() =>
                  setPin((p) =>
                    k === "C" ? "" : k === "←" ? p.slice(0, -1) : (p + k).slice(0, 4),
                  )
                }
              >
                {k}
              </Button>
            ))}
          </div>
          <Button asChild variant="ghost" className="mt-4 w-full">
            <Link to="/">
              <ArrowLeft className="size-4" /> На главную
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => setCashier(null)}>
          <User className="size-4" /> {cashier.name}
        </Button>
        <div className="text-sm text-muted-foreground">
          {shift.data
            ? `Смена открыта с ${formatTime(shift.data.opened_at)}`
            : "Смена закрыта"}
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant={shift.data ? "outline" : "default"}
            size="sm"
            onClick={() => setShiftOpen(true)}
          >
            <Wallet className="size-4" /> {shift.data ? "Закрыть смену" : "Открыть смену"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <Settings2 className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск товара"
              className="pl-9"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={category === null ? "default" : "secondary"}
              onClick={() => setCategory(null)}
            >
              Все
            </Button>
            {(categories.data ?? []).map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={category === c.id ? "default" : "secondary"}
                onClick={() => setCategory(c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => {
              const mods = (modifiers.data ?? []).filter(
                (m) => m.is_active && m.category_id === p.category_id,
              );
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (mods.length) {
                      setModProduct(p);
                      setPickedMods([]);
                    } else addProduct(p);
                  }}
                  className={`tile-press flex flex-col rounded-2xl border border-border bg-card p-3 text-left ${
                    p.in_stop_list ? "opacity-40" : ""
                  }`}
                >
                  <span className="flex h-20 items-center justify-center rounded-xl bg-muted text-4xl">
                    {p.emoji ?? "🍽"}
                  </span>
                  <span className="mt-2 line-clamp-2 text-sm font-medium">{p.name}</span>
                  <span className="mt-1 font-bold text-primary">{formatKzt(p.price)}</span>
                  {p.track_stock && (
                    <span className="text-xs text-muted-foreground">
                      Остаток: {Number(p.stock)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="flex flex-col rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Чек</h2>
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {lines.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Чек пуст</p>
            )}
            {lines.map((l) => (
              <div key={l.key} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{l.name}</p>
                    {l.modifiers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {l.modifiers.map((m) => m.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}>
                    <Trash2 className="size-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="secondary" onClick={() => changeQty(l.key, -1)}>
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-8 text-center font-semibold">{l.qty}</span>
                    <Button size="icon" variant="secondary" onClick={() => changeQty(l.key, 1)}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <span className="font-semibold">{formatKzt(lineTotal(l))}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Сумма</span>
              <span>{formatKzt(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <button
                className="text-muted-foreground underline"
                onClick={() => {
                  setDiscountInput("");
                  setDiscountOpen(true);
                }}
              >
                Скидка
              </button>
              <span>-{formatKzt(discount)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold">
              <span>Итого</span>
              <span>{formatKzt(total)}</span>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <Button
              size="lg"
              disabled={lines.length === 0}
              onClick={() => {
                if (!shift.data) {
                  toast.error("Сначала откройте смену");
                  return;
                }
                setMethod("cash");
                setCashReceived(0);
                setCardPart(0);
                setPayOpen(true);
              }}
            >
              Оплата · {formatKzt(total)}
            </Button>
            <Button
              variant="ghost"
              disabled={lines.length === 0}
              onClick={() => {
                setLines([]);
                setDiscount(0);
              }}
            >
              <X className="size-4" /> Очистить чек
            </Button>
          </div>
        </aside>
      </div>

      {/* Модификаторы */}
      <Dialog open={!!modProduct} onOpenChange={(o) => !o && setModProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {(modifiers.data ?? [])
              .filter((m) => m.is_active && m.category_id === modProduct?.category_id)
              .map((m) => {
                const active = pickedMods.some((x) => x.id === m.id);
                return (
                  <Button
                    key={m.id}
                    variant={active ? "default" : "secondary"}
                    onClick={() =>
                      setPickedMods((prev) =>
                        active
                          ? prev.filter((x) => x.id !== m.id)
                          : [...prev, { id: m.id, name: m.name, price: m.price }],
                      )
                    }
                  >
                    {m.name} {m.price > 0 ? `+${formatKzt(m.price)}` : ""}
                  </Button>
                );
              })}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (modProduct) addProduct(modProduct, pickedMods);
                setModProduct(null);
              }}
            >
              Добавить в чек
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Скидка */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Скидка на чек</DialogTitle>
          </DialogHeader>
          <Input
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value)}
            placeholder="Например 500 или 10%"
            inputMode="numeric"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDiscount(0)}>
              Сбросить
            </Button>
            <Button
              onClick={() => {
                const raw = discountInput.trim();
                const num = Number(raw.replace(/[%\s]/g, "")) || 0;
                const value = raw.includes("%")
                  ? Math.round((subtotal * num) / 100)
                  : Math.round(num);
                setDiscount(Math.min(subtotal, Math.max(0, value)));
                setDiscountOpen(false);
              }}
            >
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Оплата */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Оплата {formatKzt(total)}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            <Button variant={method === "cash" ? "default" : "secondary"} onClick={() => setMethod("cash")}>
              <Banknote className="size-4" /> Нал.
            </Button>
            <Button variant={method === "card" ? "default" : "secondary"} onClick={() => setMethod("card")}>
              <CreditCard className="size-4" /> Карта
            </Button>
            <Button variant={method === "mixed" ? "default" : "secondary"} onClick={() => setMethod("mixed")}>
              Смеш.
            </Button>
          </div>

          {method === "mixed" && (
            <div className="grid gap-1">
              <Label>Оплата картой</Label>
              <Input
                inputMode="numeric"
                value={cardPart || ""}
                onChange={(e) => setCardPart(Math.min(total, Number(e.target.value) || 0))}
              />
            </div>
          )}

          {method !== "card" && (
            <div className="grid gap-2">
              <Label>Получено наличными</Label>
              <Input
                inputMode="numeric"
                value={cashReceived || ""}
                onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
              />
              <div className="flex flex-wrap gap-2">
                {CASH_BILLS.map((b) => (
                  <Button key={b} size="sm" variant="secondary" onClick={() => setCashReceived((v) => v + b)}>
                    {b.toLocaleString("ru-RU")}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCashReceived(method === "mixed" ? total - cardPart : total)}
                >
                  Без сдачи
                </Button>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Сдача</span>
                <span>{formatKzt(change)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              size="lg"
              disabled={payMutation.isPending}
              onClick={() => payMutation.mutate()}
            >
              Провести продажу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Смена */}
      <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shift.data ? "Закрытие смены" : "Открытие смены"}</DialogTitle>
          </DialogHeader>
          <Label>{shift.data ? "Наличные в кассе на конец" : "Наличные в кассе на начало"}</Label>
          <Input
            inputMode="numeric"
            value={cashField}
            onChange={(e) => setCashField(e.target.value)}
            placeholder="0"
          />
          <DialogFooter>
            <Button onClick={() => shiftMutation.mutate(shift.data ? "close" : "open")}>
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Чек */}
      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Чек продажи</DialogTitle>
          </DialogHeader>
          {receipt && <Receipt data={receipt} settings={settings.data ?? null} />}
          <DialogFooter>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" /> Печать
            </Button>
            <Button onClick={() => setReceipt(null)}>Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
