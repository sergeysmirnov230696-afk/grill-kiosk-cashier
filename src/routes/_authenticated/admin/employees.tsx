import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { employeesQuery, type Employee } from "@/lib/pos-queries";
import { ROLE_LABELS } from "@/lib/pos";
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

export const Route = createFileRoute("/_authenticated/admin/employees")({
  head: () => ({
    meta: [
      { title: "Сотрудники и PIN-коды кассы" },
      {
        name: "description",
        content: "Список кассиров, менеджеров и администраторов с PIN-кодами для входа на кассу.",
      },
      { property: "og:title", content: "Сотрудники и PIN-коды кассы" },
      { property: "og:description", content: "Управление персоналом точки." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeesPage,
});

type Role = "admin" | "manager" | "cashier";
type Draft = { id?: string; name: string; pin: string; role: Role; is_active: boolean };

const EMPTY: Draft = { name: "", pin: "", role: "cashier", is_active: true };

function EmployeesPage() {
  const qc = useQueryClient();
  const employees = useQuery(employeesQuery);
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!d.name.trim()) throw new Error("Введите имя сотрудника");
      if (!/^\d{4}$/.test(d.pin)) throw new Error("PIN должен состоять из 4 цифр");
      const payload = {
        name: d.name.trim(),
        pin: d.pin,
        role: d.role,
        is_active: d.is_active,
      };
      const res = d.id
        ? await supabase.from("employees").update(payload).eq("id", d.id)
        : await supabase.from("employees").insert(payload);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setDraft(null);
      toast.success("Сотрудник сохранён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Сотрудник удалён");
    },
    onError: () => toast.error("У сотрудника есть чеки — отключите его вместо удаления"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Сотрудники</h1>
        <Button onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="size-4" /> Добавить
        </Button>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-3">Имя</th>
              <th className="p-3">Роль</th>
              <th className="p-3">PIN</th>
              <th className="p-3">Статус</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {(employees.data ?? []).map((e: Employee) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{e.name}</td>
                <td className="p-3 text-muted-foreground">{ROLE_LABELS[e.role] ?? e.role}</td>
                <td className="p-3 tracking-widest">{e.pin}</td>
                <td className="p-3">
                  {e.is_active ? (
                    <span className="text-secondary">Активен</span>
                  ) : (
                    <span className="text-muted-foreground">Отключён</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          id: e.id,
                          name: e.name,
                          pin: e.pin,
                          role: e.role as Role,
                          is_active: e.is_active,
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(e.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(employees.data ?? []).length === 0 && (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={5}>
                  Нет сотрудников
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Редактирование" : "Новый сотрудник"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Имя</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>PIN (4 цифры)</Label>
                <Input
                  inputMode="numeric"
                  maxLength={4}
                  value={draft.pin}
                  onChange={(e) =>
                    setDraft({ ...draft, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Роль</Label>
                <Select
                  value={draft.role}
                  onValueChange={(v) => setDraft({ ...draft, role: v as Role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Кассир</SelectItem>
                    <SelectItem value="manager">Менеджер</SelectItem>
                    <SelectItem value="admin">Администратор</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <Label>Активен</Label>
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                />
              </div>
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
