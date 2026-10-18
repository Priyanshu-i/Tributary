import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { canonicalJson } from './canonical-json.js';

export const GENESIS_HASH = '0'.repeat(64);

export type AuditEventType =
  | 'DEAL_CREATED'
  | 'DEAL_SIGNED'
  | 'SALE_CAPTURED'
  | 'WATERFALL_COMPUTED'
  | 'PAYOUT_BATCH_CREATED'
  | 'PAYOUT_ITEM_UPDATED'
  | 'REFUND_CLAWBACK_APPLIED'
  | 'WEBHOOK_PROCESSED'
  | 'INVARIANT_HALT';

export interface AuditEntry {
  entryId: number;
  prevHash: string;
  timestamp: string;
  eventType: AuditEventType;
  payload: Record<string, unknown>;
  entryHash: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  totalEntries: number;
  headHash: string;
  corruptedAtIndex?: number;
  error?: string;
  expectedHash?: string;
  actualHash?: string;
}

/**
 * Computes deterministic SHA-256 hash for an audit log entry.
 */
export function computeEntryHash(
  prevHash: string,
  timestamp: string,
  eventType: string,
  payload: unknown
): string {
  const serialized = canonicalJson(payload);
  const dataToHash = `${prevHash}${timestamp}${eventType}${serialized}`;
  return crypto.createHash('sha256').update(dataToHash, 'utf8').digest('hex');
}

/**
 * Appends a tamper-evident, cryptographically chained audit log entry.
 */
export function appendAuditEntry(
  db: Database.Database,
  eventType: AuditEventType,
  payload: Record<string, unknown>,
  timestamp = new Date().toISOString()
): AuditEntry {
  const lastRow = db
    .prepare('SELECT entry_hash FROM audit_log ORDER BY entry_id DESC LIMIT 1')
    .get() as { entry_hash: string } | undefined;

  const prevHash = lastRow?.entry_hash || GENESIS_HASH;
  const entryHash = computeEntryHash(prevHash, timestamp, eventType, payload);
  const payloadJson = canonicalJson(payload);

  const stmt = db.prepare(`
    INSERT INTO audit_log (prev_hash, timestamp, event_type, payload_json, entry_hash)
    VALUES (?, ?, ?, ?, ?)
  `);

  const info = stmt.run(prevHash, timestamp, eventType, payloadJson, entryHash);
  const entryId = Number(info.lastInsertRowid);

  return {
    entryId,
    prevHash,
    timestamp,
    eventType,
    payload,
    entryHash,
  };
}

/**
 * Verifies the entire cryptographic continuity of the audit log table.
 * Detects any tampering, altered payloads, deleted rows, or corrupted timestamps.
 */
export function verifyAuditChain(db: Database.Database): AuditVerificationResult {
  const rows = db
    .prepare(
      'SELECT entry_id, prev_hash, timestamp, event_type, payload_json, entry_hash FROM audit_log ORDER BY entry_id ASC'
    )
    .all() as Array<{
    entry_id: number;
    prev_hash: string;
    timestamp: string;
    event_type: string;
    payload_json: string;
    entry_hash: string;
  }>;

  if (rows.length === 0) {
    return {
      valid: true,
      totalEntries: 0,
      headHash: GENESIS_HASH,
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. Verify prev_hash link
    if (i === 0) {
      if (row.prev_hash !== GENESIS_HASH) {
        return {
          valid: false,
          totalEntries: rows.length,
          headHash: rows[rows.length - 1].entry_hash,
          corruptedAtIndex: 0,
          error: `Genesis row prev_hash mismatch: expected ${GENESIS_HASH}, got ${row.prev_hash}`,
        };
      }
    } else {
      const prevRow = rows[i - 1];
      if (row.prev_hash !== prevRow.entry_hash) {
        return {
          valid: false,
          totalEntries: rows.length,
          headHash: rows[rows.length - 1].entry_hash,
          corruptedAtIndex: i,
          error: `Broken chain link at index ${i}: expected prev_hash ${prevRow.entry_hash}, got ${row.prev_hash}`,
        };
      }
    }

    // 2. Re-compute and verify hash integrity
    let payloadParsed: unknown;
    try {
      payloadParsed = JSON.parse(row.payload_json);
    } catch {
      return {
        valid: false,
        totalEntries: rows.length,
        headHash: rows[rows.length - 1].entry_hash,
        corruptedAtIndex: i,
        error: `Invalid JSON payload in entry ${row.entry_id}`,
      };
    }

    const expectedHash = computeEntryHash(
      row.prev_hash,
      row.timestamp,
      row.event_type,
      payloadParsed
    );

    if (row.entry_hash !== expectedHash) {
      return {
        valid: false,
        totalEntries: rows.length,
        headHash: rows[rows.length - 1].entry_hash,
        corruptedAtIndex: i,
        expectedHash,
        actualHash: row.entry_hash,
        error: `Payload tampering detected at index ${i} (entry_id ${row.entry_id})`,
      };
    }
  }

  return {
    valid: true,
    totalEntries: rows.length,
    headHash: rows[rows.length - 1].entry_hash,
  };
}
