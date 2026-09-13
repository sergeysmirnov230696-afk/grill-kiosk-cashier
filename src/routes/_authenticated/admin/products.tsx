import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, productsQuery, type Product } from "@/lib/pos-queries";
import { formatKzt } from "@/lib/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/products")({
  head: () => ({
    meta: [
      { title: "Товары и цены — управление меню" },
      {
        name: "description",
        content: "Добавление товаров, категорий, цен в тенге, стоп-листа и учёта остатков.",
      },
      { property: "og:title", content: "Товары и цены — управление меню" },
      { property: "og:description", content: "Управление меню точки быстрого питания." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

type Draft = {
  id?: string;
  name: string;
  category_id: string | null;
  price: string;
  cost: string;
  unit: string;
  emoji: string;
  is_active: boolean;
  in_stop_list: boolean;
  track_stock: boolean;
  sort: string;
};

const EMPTY: Draft = {
  name: "",
  category_id: null,
  price: "0",
  cost: "0",
  unit: "шт",
  emoji: "",
  is_active: true,
  in_stop_list: false,
  track_stock: false,
  sort: "0",
};

function toDraft(p: Product): Draft {
  return {
    id: p.id,
    name: p.name,
    category_id: p.category_id,
    price: String(p.price),
    cost: String(p.cost),
    unit: p.unit,
    emoji: p.emoji ?? "",
    is_active: p.is_active,
    in_stop_list: p.in_stop_list,
    track_stock: p.track_stock,
    sort: String(p.sort),
  };
}

function ProductsPage() {
  const qc = useQueryClient();
  const products = useQuery(productsQuery);
  const categories = useQuery(categoriesQuery);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [catName, setCatName] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        name: d.name.trim(),
        category_id: d.category_id,
        price: Math.round(Number(d.price) || 0),
        cost: Math.round(Number(d.cost) || 0),
        unit: d.unit || "шт",
        emoji: d.emoji || null,
        is_active: d.is_active,
        in_stop_list: d.in_stop_list,
        track_stock: d.track_stock,
        sort: Math.round(Number(d.sort) || 0),
      };
      if (!payload.name) throw new Error("Введите название товара");
      const res = d.id
        ? await supabase.from("products").update(payload).eq("id", d.id)
        : await supabase.from("products").insert(payload);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setDraft(null);
      toast.success("Товар сохранён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Товар удалён");
    },
    onError: () =>
      toast.error("Товар участвует в чеках — отключите его вместо удаления"),
  });

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      if (!name.trim()) throw new Error("Введите название категории");
      const { error } = await supabase.from("categories").insert({ name: name.trim() });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setCatName("");
      toast.success("Категория добавлена");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (products.data ?? []).filter(
    (p) => filter === "all" || p.category_id === filter,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Товары</h1>
        <Button onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="size-4" /> Новый товар
        </Button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Категории</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "secondary"}
            onClick={() => setFilter("all")}
          >
            Все
          </Button>
          {(categories.data ?? []).map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={filter === c.id ? "default" : "secondary"}
              onClick={() => setFilter(c.id)}
            >
              {c.name}
            </Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Input
              value={catName}
              placeholder="Новая категория"
              className="w-48"
              onChange={(e) => setCatName(e.target.value)}
            />
            <Button variant="secondary" onClick={() => addCategory.mutate(catName)}>
              Добавить
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Название</th>
              <th className="p-3">Категория</th>
              <th className="p-3">Цена</th>
              <th className="p-3">Себест.</th>
              <th className="p-3">Остаток</th>
              <th className="p-3">Статус</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">
                  {p.emoji ? `${p.emoji} ` : ""}
                  {p.name}
                </td>
                <td className="p-3 text-muted-foreground">
                  {(categories.data ?? []).find((c) => c.id === p.category_id)?.name ?? "—"}
                </td>
                <td className="p-3">{formatKzt(p.price)}</td>
                <td className="p-3 text-muted-foreground">{formatKzt(p.cost)}</td>
                <td className="p-3">{p.track_stock ? `${p.stock} ${p.unit}` : "—"}</td>
                <td className="p-3">
                  {!p.is_active ? (
                    <span className="text-muted-foreground">Скрыт</span>
                  ) : p.in_stop_list ? (
                    <span className="text-destructive">Стоп-лист</span>
                  ) : (
                    <span className="text-secondary">В продаже</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setDraft(toDraft(p))}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={7}>
                  Нет товаров
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Редактирование товара" : "Новый товар"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <Field label="Название">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Категория">
                <Select
                  value={draft.category_id ?? "none"}
                  onValueChange={(v) =>
                    setDraft({ ...draft, category_id: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без категории</SelectItem>
                    {(categories.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Цена, ₸">
                  <Input
                    inputMode="numeric"
                    value={draft.price}
                    onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  />
                </Field>
                <Field label="Себестоимость, ₸">
                  <Input
                    inputMode="numeric"
                    value={draft.cost}
                    onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
                  />
                </Field>
                <Field label="Единица">
                  <Input
                    value={draft.unit}
                    onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  />
                </Field>
                <Field label="Эмодзи">
                  <Input
                    value={draft.emoji}
                    onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                  />
                </Field>
                <Field label="Сортировка">
                  <Input
                    inputMode="numeric"
                    value={draft.sort}
                    onChange={(e) => setDraft({ ...draft, sort: e.target.value })}
                  />
                </Field>
              </div>
              <Toggle
                label="В продаже"
                checked={draft.is_active}
                onChange={(v) => setDraft({ ...draft, is_active: v })}
              />
              <Toggle
                label="Стоп-лист"
                checked={draft.in_stop_list}
                onChange={(v) => setDraft({ ...draft, in_stop_list: v })}
              />
              <Toggle
                label="Вести учёт остатков"
                checked={draft.track_stock}
                onChange={(v) => setDraft({ ...draft, track_stock: v })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Отмена
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
