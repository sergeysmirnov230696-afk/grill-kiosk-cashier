import { formatDateTime, formatKzt, PAYMENT_LABELS } from "@/lib/pos";
import type { Settings } from "@/lib/pos-queries";

export type ReceiptData = {
  orderNo: number | string;
  createdAt: string;
  cashier: string;
  lines: { name: string; qty: number; price: number; total: number; extra?: string | undefined }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashAmount: number;
  cardAmount: number;
  cashReceived: number;
  change: number;
  refunded?: boolean;
};

export function Receipt({ data, settings }: { data: ReceiptData; settings: Settings | null }) {
  return (
    <div
      id="receipt-print"
      className="mx-auto w-full max-w-[320px] rounded-xl bg-white p-4 font-mono text-[12px] leading-5 text-black"
    >
      <div className="text-center">
        <div className="text-sm font-bold uppercase">{settings?.shop_name ?? "Гриль & Донер"}</div>
        {settings?.address ? <div>{settings.address}</div> : null}
        {settings?.phone ? <div>{settings.phone}</div> : null}
      </div>
      <Divider />
      <div className="flex justify-between">
        <span>Чек №{data.orderNo}</span>
        <span>{formatDateTime(data.createdAt)}</span>
      </div>
      <div>Кассир: {data.cashier}</div>
      {data.refunded ? <div className="font-bold">*** ВОЗВРАТ ***</div> : null}
      <Divider />
      {data.lines.map((l, i) => (
        <div key={i} className="mb-1">
          <div>{l.name}</div>
          {l.extra ? <div className="pl-2 text-[11px]">+ {l.extra}</div> : null}
          <div className="flex justify-between">
            <span>
              {l.qty} x {formatKzt(l.price)}
            </span>
            <span>{formatKzt(l.total)}</span>
          </div>
        </div>
      ))}
      <Divider />
      <Row label="Сумма" value={formatKzt(data.subtotal)} />
      {data.discount > 0 && <Row label="Скидка" value={"-" + formatKzt(data.discount)} />}
      {settings && Number(settings.vat_percent) > 0 && (
        <Row
          label={`в т.ч. НДС ${settings.vat_percent}%`}
          value={formatKzt((data.total * Number(settings.vat_percent)) / (100 + Number(settings.vat_percent)))}
        />
      )}
      <div className="flex justify-between text-sm font-bold">
        <span>ИТОГО</span>
        <span>{formatKzt(data.total)}</span>
      </div>
      <Divider />
      <Row label="Оплата" value={PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod} />
      {data.cashAmount > 0 && <Row label="Наличными" value={formatKzt(data.cashAmount)} />}
      {data.cardAmount > 0 && <Row label="Картой" value={formatKzt(data.cardAmount)} />}
      {data.cashReceived > 0 && <Row label="Получено" value={formatKzt(data.cashReceived)} />}
      {data.change > 0 && <Row label="Сдача" value={formatKzt(data.change)} />}
      <Divider />
      <div className="text-center">{settings?.receipt_footer ?? "Спасибо за покупку!"}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-black/40" />;
}
