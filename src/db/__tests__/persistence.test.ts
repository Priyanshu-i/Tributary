import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabase } from '../schema.js';
import { TributaryRepository } from '../repository.js';
import { appendAuditEntry, verifyAuditChain, GENESIS_HASH } from '../audit-chain.js';
import { DealSpec, SaleInput, WaterfallResult } from '../../core-engine/types.js';
import { executeSaleWaterfall } from '../../core-engine/waterfall.js';

describe('Phase 2: Persistence, Hash-Chained Audit Log & 3-Layer Idempotency', () => {
  let db: Database.Database;
  let repo: TributaryRepository;

  const testDeal: DealSpec = {
    dealId: 'deal_moonlit_p2',
    version: 1,
    title: 'Moonlit Phase 2 Test Deal',
    payees: [
      { id: 'maya', name: 'Maya Lin', email: 'maya@test.com', tier1Bps: 4000, tier2Bps: 2500 },
      { id: 'arjun', name: 'Arjun Rao', email: 'arjun@test.com', tier1Bps: 3000, tier2Bps: 2500 },
      { id: 'lina', name: 'Lina Chen', email: 'lina@test.com', tier1Bps: 2000, tier2Bps: 2500 },
      { id: 'dev', name: 'Dev Patel', email: 'dev@test.com', tier1Bps: 1000, tier2Bps: 2500 },
    ],
    recoupBucket: {
      payeeId: 'maya',
      totalCents: 40000,
      feeBasis: 'NET_OF_FEES',
    },
    tierThresholdNetCents: 200000,
    reserveBps: 1000,
    holdbackDays: 14,
    minPayoutCents: 2500,
    clawbackRule: 'PRO_RATA_SALE_SHARE',
  };

  beforeEach(() => {
    // In-memory SQLite for deterministic, lightning-fast tests
    db = new Database(':memory:');
    initDatabase(db);
    repo = new TributaryRepository(db);
  });

  describe('1. 3-Layer Idempotency Guardrails', () => {
    it('Layer 1: generates deterministic PayPal-Request-Id', () => {
      const id1 = repo.generatePayPalRequestId('capture', 'order_123');
      const id2 = repo.generatePayPalRequestId('capture', 'order_123');
      const id3 = repo.generatePayPalRequestId('capture', 'order_456');

      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id1.length).toBeLessThanOrEqual(36);
    });

    it('Layer 2: duplicate payout batch creation for (saleId, dealHash) returns existing batch without double-execution', () => {
      const saleId = 'sale_abc_001';
      const dealHash = 'hash_1234567890abcdef';

      // First payout creation attempt
      const first = repo.getOrCreatePayoutBatch(saleId, dealHash, 8642, 4);
      expect(first.isDuplicate).toBe(false);
      expect(first.batch.senderBatchId).toMatch(/^trib_[0-9a-f]{19}$/);
      expect(first.batch.batchStatus).toBe('PENDING');

      // Second identical payout creation attempt (e.g. concurrent network retry or double-click)
      const second = repo.getOrCreatePayoutBatch(saleId, dealHash, 8642, 4);
      expect(second.isDuplicate).toBe(true);
      expect(second.batch.senderBatchId).toBe(first.batch.senderBatchId);
      expect(second.batch.totalAmountCents).toBe(8642);

      // Verify only 1 row exists in DB
      const count = db.prepare('SELECT COUNT(*) as cnt FROM payout_batches').get() as { cnt: number };
      expect(count.cnt).toBe(1);
    });

    it('Layer 3: duplicate webhook event_id returns { duplicate: true } with zero state mutation', () => {
      const eventId = 'WH-12345-67890';
      const payload = {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAP-999', amount: { value: '100.00' } },
      };

      // First delivery: success
      const first = repo.recordWebhookEvent(eventId, 'PAYMENT.CAPTURE.COMPLETED', 'CAP-999', payload);
      expect(first.duplicate).toBe(false);

      // Duplicate delivery (e.g. network resend from PayPal): blocked
      const second = repo.recordWebhookEvent(eventId, 'PAYMENT.CAPTURE.COMPLETED', 'CAP-999', payload);
      expect(second.duplicate).toBe(true);

      // Verify exactly 1 webhook record in database
      const rowCount = db.prepare('SELECT COUNT(*) as cnt FROM webhook_events').get() as { cnt: number };
      expect(rowCount.cnt).toBe(1);
    });
  });

  describe('2. Cryptographic Hash-Chained Audit Log', () => {
    it('initializes audit chain with genesis hash and valid sequential links', () => {
      const e1 = appendAuditEntry(db, 'DEAL_CREATED', { dealId: 'deal_1' });
      expect(e1.prevHash).toBe(GENESIS_HASH);

      const e2 = appendAuditEntry(db, 'DEAL_SIGNED', { dealId: 'deal_1', version: 1 });
      expect(e2.prevHash).toBe(e1.entryHash);

      const e3 = appendAuditEntry(db, 'SALE_CAPTURED', { saleId: 'sale_1', gross: 10000 });
      expect(e3.prevHash).toBe(e2.entryHash);

      const verification = verifyAuditChain(db);
      expect(verification.valid).toBe(true);
      expect(verification.totalEntries).toBe(3);
      expect(verification.headHash).toBe(e3.entryHash);
    });

    it('detects tampering with historical row payload_json', () => {
      appendAuditEntry(db, 'DEAL_CREATED', { dealId: 'deal_1' });
      appendAuditEntry(db, 'SALE_CAPTURED', { saleId: 'sale_1', gross: 10000 });
      appendAuditEntry(db, 'PAYOUT_BATCH_CREATED', { batchId: 'b_1' });

      // Deliberately tamper with row 2 (gross: 10000 -> 99999)
      db.prepare(`
        UPDATE audit_log
        SET payload_json = '{"gross":99999,"saleId":"sale_1"}'
        WHERE entry_id = 2
      `).run();

      const verification = verifyAuditChain(db);
      expect(verification.valid).toBe(false);
      expect(verification.corruptedAtIndex).toBe(1); // 0-indexed second row
      expect(verification.error).toContain('Payload tampering detected');
    });

    it('detects tampering with entry_hash or broken prev_hash link', () => {
      appendAuditEntry(db, 'DEAL_CREATED', { dealId: 'deal_1' });
      appendAuditEntry(db, 'SALE_CAPTURED', { saleId: 'sale_1' });

      // Corrupt the prev_hash in row 2
      db.prepare(`
        UPDATE audit_log
        SET prev_hash = ?
        WHERE entry_id = 2
      `).run('f'.repeat(64));

      const verification = verifyAuditChain(db);
      expect(verification.valid).toBe(false);
      expect(verification.corruptedAtIndex).toBe(1);
      expect(verification.error).toContain('Broken chain link');
    });
  });

  describe('3. End-to-End Deal & Waterfall Persistence Flow', () => {
    it('saves, locks, computes waterfall, and persists state transitions cleanly', () => {
      // 1. Save and lock deal
      repo.saveDeal(testDeal, 'DRAFT');
      const saved = repo.getDeal('deal_moonlit_p2');
      expect(saved?.status).toBe('DRAFT');
      expect(saved?.spec.sha256Hash).toBeDefined();

      const lockedSpec = repo.lockDeal('deal_moonlit_p2');
      expect(repo.getDeal('deal_moonlit_p2')?.status).toBe('LOCKED');

      // 2. Initial ledger state
      const initialLedger = repo.getLedgerState('deal_moonlit_p2');
      expect(initialLedger.cumulativeNetCents).toBe(0);
      expect(initialLedger.recoupedCents).toBe(0);

      // 3. Compute and record sale
      const sale: SaleInput = {
        saleId: 'sale_p2_001',
        grossCents: 10000,
        paypalFeeCents: 398,
      };

      const trace: WaterfallResult = executeSaleWaterfall(
        sale,
        { ...lockedSpec, minPayoutCents: 0 },
        initialLedger
      );

      repo.recordSaleTrace('deal_moonlit_p2', sale, trace, 'ORD-001', 'CAP-001');

      // 4. Verify updated ledger state in DB
      const updatedLedger = repo.getLedgerState('deal_moonlit_p2');
      expect(updatedLedger.cumulativeNetCents).toBe(9602);
      // Since prior recoup was 0 of 40000, the full distributable 8642 went to Maya's recoup
      expect(updatedLedger.recoupedCents).toBe(8642);
      expect(updatedLedger.availableReserveCents).toBe(960);
      expect(updatedLedger.payeeLedgers['maya'].totalEarnedCents).toBe(8642);

      // 5. Verify entire audit chain remains cryptographically valid
      const chainCheck = verifyAuditChain(db);
      expect(chainCheck.valid).toBe(true);
      expect(chainCheck.totalEntries).toBeGreaterThanOrEqual(4);
    });

    it('manages out-of-order pending webhooks queue', () => {
      const eventId = 'WH-OUT-OF-ORDER-1';
      const saleId = 'sale_not_yet_saved';

      repo.queuePendingEvent(eventId, 'PAYMENT.CAPTURE.REFUNDED', saleId, { amount: 50 });

      const pending = repo.getPendingEventsForSale(saleId);
      expect(pending).toHaveLength(1);
      expect(pending[0].eventId).toBe(eventId);

      repo.deletePendingEvent(pending[0].id);
      expect(repo.getPendingEventsForSale(saleId)).toHaveLength(0);
    });
  });
});
