export const CURRENCY = "₸";

export function formatKzt(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU").replace(/\u00A0/g, " ")} ${CURRENCY}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  mixed: "Смешанная",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  cashier: "Кассир",
};

export const CASH_BILLS = [500, 1000, 2000, 5000, 10000, 20000];

export type CartModifier = { id: string; name: string; price: number };

export type CartLine = {
  key: string;
  productId: string;
  name: string;
  price: number;
  qty: number;
  emoji: string | null;
  imageUrl: string | null;
  modifiers: CartModifier[];
  trackStock: boolean;
};

export function lineTotal(line: CartLine): number {
  const mods = line.modifiers.reduce((sum, m) => sum + m.price, 0);
  return Math.round((line.price + mods) * line.qty);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}
