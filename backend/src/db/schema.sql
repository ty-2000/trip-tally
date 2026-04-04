-- Trip Tally Database Schema
-- PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- Trips
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS trips (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  currency    CHAR(3)     NOT NULL DEFAULT 'USD',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Members
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_member_name_per_trip UNIQUE (trip_id, name)
);

-- -------------------------------------------------------
-- Expenses
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id              UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  paid_by_member_id    UUID        NOT NULL REFERENCES members(id),
  title                VARCHAR(255) NOT NULL,
  amount               INTEGER     NOT NULL CHECK (amount > 0),  -- integer cents
  currency             CHAR(3)     NOT NULL,
  split_type           VARCHAR(20) NOT NULL
                         CHECK (split_type IN ('EQUAL', 'EXACT', 'PERCENTAGE')),
  receipt_s3_key       TEXT,       -- stored as S3 key, not full URL
  created_by_member_id UUID        REFERENCES members(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Expense Splits
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_splits (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID    NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id   UUID    NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount >= 0),   -- integer cents
  percentage  NUMERIC(5, 2),                          -- nullable; used for PERCENTAGE split
  CONSTRAINT uq_split_per_member_per_expense UNIQUE (expense_id, member_id)
);

-- -------------------------------------------------------
-- Activity Log
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id  UUID        REFERENCES members(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------
-- Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_members_trip_id
  ON members(trip_id);

CREATE INDEX IF NOT EXISTS idx_expenses_trip_id
  ON expenses(trip_id);

CREATE INDEX IF NOT EXISTS idx_expenses_paid_by
  ON expenses(paid_by_member_id);

CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id
  ON expense_splits(expense_id);

CREATE INDEX IF NOT EXISTS idx_expense_splits_member_id
  ON expense_splits(member_id);

CREATE INDEX IF NOT EXISTS idx_activity_trip_id_created_at
  ON activity_log(trip_id, created_at DESC);

-- -------------------------------------------------------
-- Trigger: auto-update updated_at on trips and expenses
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
