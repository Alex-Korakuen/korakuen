-- ============================================================
-- Fix: exchange_rates.source should be NOT NULL
-- Migration: 20260308000003
-- Date: 2026-03-08
-- ============================================================
-- Schema doc specifies NOT NULL but original CREATE TABLE omitted it.
-- Safe because DEFAULT 'SUNAT' exists and no null rows in production.

-- Backfill any nulls (defensive)
UPDATE exchange_rates SET source = 'SUNAT' WHERE source IS NULL;

-- Add NOT NULL constraint
ALTER TABLE exchange_rates ALTER COLUMN source SET NOT NULL;
