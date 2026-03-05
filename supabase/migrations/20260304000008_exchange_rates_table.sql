-- ============================================================
-- Korakuen Management System — Exchange Rates Table
-- Migration: 20260304000008
-- Date: 2026-03-04
-- ============================================================

-- Master exchange rate table (Layer 1).
-- Stores daily SUNAT buy/sell/mid rates for PEN/USD.
-- Not FK'd to any financial table — purely a lookup/reference.

CREATE TABLE exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_date DATE NOT NULL UNIQUE,
  buy_rate NUMERIC(10,4) NOT NULL,
  sell_rate NUMERIC(10,4) NOT NULL,
  mid_rate NUMERIC(10,4) NOT NULL,
  source VARCHAR(50) DEFAULT 'SUNAT',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Auto-update trigger for updated_at
CREATE TRIGGER trg_exchange_rates_updated_at
  BEFORE UPDATE ON exchange_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: authenticated users can read, service role can write (bypasses RLS)
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read exchange rates"
  ON exchange_rates FOR SELECT
  TO authenticated
  USING (true);
