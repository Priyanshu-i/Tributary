import Database from 'better-sqlite3';

export const SCHEMA_SQL = `
-- Enforce Foreign Keys and WAL Mode
PRAGMA foreign_keys = ON;

-- 1. Deals Table
CREATE TABLE IF NOT EXISTS deals (
  deal_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('DRAFT', 'LOCKED')),
  created_at TEXT NOT NULL,
  locked_at TEXT
);

-- 2. Ledger State Table (1 row per deal)
CREATE TABLE IF NOT EXISTS ledger_state (
  deal_id TEXT PRIMARY KEY REFERENCES deals(deal_id) ON DELETE CASCADE,
  cumulative_net_cents INTEGER NOT NULL DEFAULT 0,
  recouped_cents INTEGER NOT NULL DEFAULT 0,
  available_reserve_cents INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 3. Payee Balances Sub-Ledger
CREATE TABLE IF NOT EXISTS payee_balances (
  deal_id TEXT NOT NULL REFERENCES deals(deal_id) ON DELETE CASCADE,
  payee_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  carried_forward_cents INTEGER NOT NULL DEFAULT 0,
  recovery_deficit_cents INTEGER NOT NULL DEFAULT 0,
  total_earned_cents INTEGER NOT NULL DEFAULT 0,
  total_paid_cents INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (deal_id, payee_id)
);

-- 4. Sales Table
CREATE TABLE IF NOT EXISTS sales (
  sale_id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(deal_id),
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  gross_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  fee_source TEXT NOT NULL,
  net_cents INTEGER NOT NULL,
  reserve_cents INTEGER NOT NULL,
  recoup_cents INTEGER NOT NULL,
  tier_applied TEXT NOT NULL,
  trace_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 5. Payout Batches (Layer 2 Idempotency: sender_batch_id UNIQUE)
CREATE TABLE IF NOT EXISTS payout_batches (
  sender_batch_id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  deal_hash TEXT NOT NULL,
  paypal_batch_id TEXT,
  batch_status TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  item_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. Payout Items
CREATE TABLE IF NOT EXISTS payout_items (
  item_id TEXT PRIMARY KEY,
  sender_batch_id TEXT NOT NULL REFERENCES payout_batches(sender_batch_id) ON DELETE CASCADE,
  payee_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  receiver_email TEXT NOT NULL,
  paypal_payout_item_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 7. Webhook Events (Layer 3 Idempotency: event_id PRIMARY KEY)
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  resource_id TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  received_at TEXT NOT NULL
);

-- 8. Out of Order Webhooks Queue
CREATE TABLE IF NOT EXISTS pending_out_of_order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 9. Cryptographically Hash-Chained Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
  prev_hash TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  entry_hash TEXT NOT NULL
);

-- Indexes for lightning queries
CREATE INDEX IF NOT EXISTS idx_sales_deal_id ON sales(deal_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_batch ON payout_items(sender_batch_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entry ON audit_log(entry_id);
`;

export function initDatabase(db: Database.Database): Database.Database {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}
