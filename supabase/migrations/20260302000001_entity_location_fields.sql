-- ============================================================
-- Korakuen Management System — Entity Location Fields
-- Migration: 20260302000001
-- Date: 2026-03-02
-- Task: 3.11
-- ============================================================
-- Adds city and region to entities table for geographic filtering.
-- Both nullable VARCHAR — free text, no validation at DB level.
-- Rollback: ALTER TABLE entities DROP COLUMN city, DROP COLUMN region;

ALTER TABLE entities ADD COLUMN city VARCHAR, ADD COLUMN region VARCHAR;
