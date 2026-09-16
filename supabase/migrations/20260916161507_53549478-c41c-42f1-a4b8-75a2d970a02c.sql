ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'cooking';
UPDATE public.orders SET fulfillment_status = 'done' WHERE fulfillment_status = 'cooking';
CREATE INDEX IF NOT EXISTS orders_fulfillment_status_idx ON public.orders (fulfillment_status);