import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/pos-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Настройки точки и чека" },
      {
        name: "description",
        content: "Название точки, адрес, телефон, НДС и текст в подвале кассового чека.",
      },
      { property: "og:title", content: "Настройки точки и чека" },
      { property: "og:description", content: "Реквизиты точки и оформление чека." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery(settingsQuery);
  const [form, setForm] = useState({
    shop_name: "",
    address: "",
    phone: "",
    receipt_footer: "",
    vat_percent: "0",
    auto_print: true,
    print_copies: "1",
    kaspi_enabled: false,
    kaspi_api_url: "",
    kaspi_terminal_id: "",
    kaspi_bin: "",
  });

  useEffect(() => {
    if (!settings.data) return;
    setForm({
      shop_name: settings.data.shop_name,
      address: settings.data.address,
      phone: settings.data.phone,
      receipt_footer: settings.data.receipt_footer,
      vat_percent: String(settings.data.vat_percent),
      auto_print: settings.data.auto_print,
      print_copies: String(settings.data.print_copies),
      kaspi_enabled: settings.data.kaspi_enabled,
      kaspi_api_url: settings.data.kaspi_api_url,
      kaspi_terminal_id: settings.data.kaspi_terminal_id,
      kaspi_bin: settings.data.kaspi_bin,
    });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        id: true,
        shop_name: form.shop_name.trim() || "Точка",
        address: form.address,
        phone: form.phone,
        receipt_footer: form.receipt_footer,
        vat_percent: Number(form.vat_percent) || 0,
        auto_print: form.auto_print,
        print_copies: Math.min(3, Math.max(1, Number(form.print_copies) || 1)),
        kaspi_enabled: form.kaspi_enabled,
        kaspi_api_url: form.kaspi_api_url.trim(),
        kaspi_terminal_id: form.kaspi_terminal_id.trim(),
        kaspi_bin: form.kaspi_bin.trim(),
      };
      const { error } = await supabase.from("settings").upsert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Настройки сохранены");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Настройки</h1>
      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Точка и чек</h2>
        <div className="grid gap-1.5">
          <Label>Название точки</Label>
          <Input
            value={form.shop_name}
            onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Адрес</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Телефон</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label>НДС, %</Label>
          <Input
            inputMode="decimal"
            value={form.vat_percent}
            onChange={(e) => setForm({ ...form, vat_percent: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Текст внизу чека</Label>
          <Textarea
            rows={3}
            value={form.receipt_footer}
            onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Печать чеков</h2>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Печатать чек автоматически после оплаты</span>
          <Switch
            checked={form.auto_print}
            onCheckedChange={(v) => setForm({ ...form, auto_print: v })}
          />
        </label>
        <div className="grid gap-1.5">
          <Label>Копий чека</Label>
          <Input
            inputMode="numeric"
            value={form.print_copies}
            onChange={(e) => setForm({ ...form, print_copies: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Чек уходит на принтер, выбранный по умолчанию в системе планшета или компьютера. Чтобы
          печать шла без окна подтверждения, откройте кассу в браузере Chrome, запущенном с
          режимом киоска (ярлык с параметром --kiosk-printing).
        </p>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Kaspi Касса</h2>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Отправлять чеки в Kaspi Касса (фискализация и QR)</span>
          <Switch
            checked={form.kaspi_enabled}
            onCheckedChange={(v) => setForm({ ...form, kaspi_enabled: v })}
          />
        </label>
        <div className="grid gap-1.5">
          <Label>Адрес Kaspi API</Label>
          <Input
            value={form.kaspi_api_url}
            placeholder="https://mtoken.kaspi.kz:8545/r3/v01"
            onChange={(e) => setForm({ ...form, kaspi_api_url: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Номер терминала Kaspi Pay</Label>
          <Input
            value={form.kaspi_terminal_id}
            onChange={(e) => setForm({ ...form, kaspi_terminal_id: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>БИН / ИИН точки</Label>
          <Input
            value={form.kaspi_bin}
            onChange={(e) => setForm({ ...form, kaspi_bin: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Токен устройства Kaspi хранится отдельно и в настройках не показывается.
        </p>
      </section>

      <Button className="justify-self-start" disabled={save.isPending} onClick={() => save.mutate()}>
        Сохранить
      </Button>
    </div>
  );
}
