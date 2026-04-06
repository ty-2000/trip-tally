/**
 * One-shot schema migration Lambda.
 * Invoke once after first deploy (safe to re-run — all DDL uses IF NOT EXISTS).
 *
 *   aws lambda invoke \
 *     --function-name trip-tally-migrate \
 *     --region us-east-2 \
 *     --payload '{}' \
 *     /tmp/migrate-out.json \
 *   && cat /tmp/migrate-out.json
 */
import { withTransaction } from '../db/client';

// Schema SQL embedded as a string — no file I/O at runtime.
const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS trips (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  currency    CHAR(3)     NOT NULL DEFAULT 'USD',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_member_name_per_trip UNIQUE (trip_id, name)
);

CREATE TABLE IF NOT EXISTS expenses (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id              UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  paid_by_member_id    UUID        NOT NULL REFERENCES members(id),
  title                VARCHAR(255) NOT NULL,
  amount               INTEGER     NOT NULL CHECK (amount > 0),
  currency             CHAR(3)     NOT NULL,
  split_type           VARCHAR(20) NOT NULL
                         CHECK (split_type IN ('EQUAL', 'EXACT', 'PERCENTAGE')),
  receipt_s3_key       TEXT,
  created_by_member_id UUID        REFERENCES members(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID    NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id   UUID    NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount >= 0),
  percentage  NUMERIC(5, 2),
  CONSTRAINT uq_split_per_member_per_expense UNIQUE (expense_id, member_id)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id  UUID        REFERENCES members(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_trip_id             ON members(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id            ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by            ON expenses(paid_by_member_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id   ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_member_id    ON expense_splits(member_id);
CREATE INDEX IF NOT EXISTS idx_activity_trip_id_created_at ON activity_log(trip_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const handler = async () => {
  const results: string[] = [];

  try {
    await withTransaction(async (client) => {
      // Split on semicolons, but skip those inside dollar-quoted blocks ($func$...$func$)
      const statements: string[] = [];
      let current = '';
      let inDollarQuote = false;
      for (const line of SCHEMA.split('\n')) {
        if (line.includes('$func$')) inDollarQuote = !inDollarQuote;
        current += line + '\n';
        if (!inDollarQuote && line.trimEnd().endsWith(';')) {
          const stmt = current.trim();
          if (stmt.length > 0) statements.push(stmt);
          current = '';
        }
      }
      if (current.trim().length > 0) statements.push(current.trim());

      for (const stmt of statements) {
        await client.query(stmt);
        results.push(`OK: ${stmt.slice(0, 80).replace(/\s+/g, ' ')}`);
      }
    });

    console.log('Migration complete:\n' + results.join('\n'));
    return { success: true, results };
  } catch (err) {
    console.error('Migration failed:', err);
    return { success: false, error: (err as Error).message, results };
  }
};
