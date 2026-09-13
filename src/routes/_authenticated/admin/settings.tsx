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
  });

  useEffect(() => {
    if (!settings.data) return;
    setForm({
      shop_name: settings.data.shop_name,
      address: settings.data.address,
      phone: settings.data.phone,
      receipt_footer: settings.data.receipt_footer,
      vat_percent: String(settings.data.vat_percent),
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
        <Button className="justify-self-start" disabled={save.isPending} onClick={() => save.mutate()}>
          Сохранить
        </Button>
      </section>
    </div>
  );
}
