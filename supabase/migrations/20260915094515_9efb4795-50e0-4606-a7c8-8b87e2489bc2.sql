ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS auto_print boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS print_copies integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS kaspi_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kaspi_api_url text NOT NULL DEFAULT 'https://mtokentest.kaspi.kz:8545/r3/v01',
  ADD COLUMN IF NOT EXISTS kaspi_terminal_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS kaspi_bin text NOT NULL DEFAULT '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fiscal_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS fiscal_number text,
  ADD COLUMN IF NOT EXISTS fiscal_check_url text,
  ADD COLUMN IF NOT EXISTS kaspi_txn_id text,
  ADD COLUMN IF NOT EXISTS fiscal_error text;