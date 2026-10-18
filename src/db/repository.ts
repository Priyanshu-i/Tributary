import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import {
  DealSpec,
  LedgerState,
  PayeeLedgerState,
  SaleInput,
  WaterfallResult,
  RefundInput,
  RefundResult,
} from '../core-engine/types.js';
import { canonicalJson } from './canonical-json.js';
import { appendAuditEntry } from './audit-chain.js';

export interface PayoutBatchRecord {
  senderBatchId: string;
  saleId: string;
  dealHash: string;
  paypalBatchId?: string;
  batchStatus: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'DENIED' | 'CANCELED';
  totalAmountCents: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutItemRecord {
  itemId: string;
  senderBatchId: string;
  payeeId: string;
  amountCents: number;
  receiverEmail: string;
  paypalPayoutItemId?: string;
  status: 'PENDING' | 'SUCCESS' | 'UNCLAIMED' | 'RETURNED' | 'FAILED' | 'BLOCKED';
  createdAt: string;
  updatedAt: string;
}

export class TributaryRepository {
  constructor(private db: Database.Database) {}

  // ==========================================
  // IDEMPOTENCY LAYERS (SPEC Section 10)
  // ==========================================

  /**
   * Layer 1: Deterministic PayPal-Request-Id generation for network calls.
   */
  public generatePayPalRequestId(action: string, entityId: string): string {
    const raw = `${action}:${entityId}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 36);
  }

  /**
   * Layer 2: Deterministic sender_batch_id generation.
   * trib_ + SHA256(saleId + ":" + dealHash).slice(0, 24)
   */
  public generateSenderBatchId(saleId: string, dealHash: string): string {
    const raw = `${saleId}:${dealHash}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 19);
    return `trib_${hash}`;
  }

  /**
   * Layer 2 enforcement: Atomically registers or retrieves a payout batch.
   * If sender_batch_id already exists, returns { isDuplicate: true, batch }
   * without calling PayPal.
   */
  public getOrCreatePayoutBatch(
    saleId: string,
    dealHash: string,
    totalAmountCents: number,
    itemCount: number
  ): { isDuplicate: boolean; batch: PayoutBatchRecord } {
    const senderBatchId = this.generateSenderBatchId(saleId, dealHash);

    const existing = this.db
      .prepare('SELECT * FROM payout_batches WHERE sender_batch_id = ?')
      .get(senderBatchId) as any;

    if (existing) {
      return {
        isDuplicate: true,
        batch: {
          senderBatchId: existing.sender_batch_id,
          saleId: existing.sale_id,
          dealHash: existing.deal_hash,
          paypalBatchId: existing.paypal_batch_id || undefined,
          batchStatus: existing.batch_status,
          totalAmountCents: existing.total_amount_cents,
          itemCount: existing.item_count,
          createdAt: existing.created_at,
          updatedAt: existing.updated_at,
        },
      };
    }

    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO payout_batches (
          sender_batch_id, sale_id, deal_hash, batch_status, total_amount_cents, item_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        senderBatchId,
        saleId,
        dealHash,
        'PENDING',
        totalAmountCents,
        itemCount,
        now,
        now
      );

    appendAuditEntry(this.db, 'PAYOUT_BATCH_CREATED', {
      senderBatchId,
      saleId,
      dealHash,
      totalAmountCents,
      itemCount,
    });

    return {
      isDuplicate: false,
      batch: {
        senderBatchId,
        saleId,
        dealHash,
        batchStatus: 'PENDING',
        totalAmountCents,
        itemCount,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  /**
   * Layer 3: Webhook Event Deduplication.
   * Enforces event_id PRIMARY KEY. If already present, returns { duplicate: true }.
   */
  public recordWebhookEvent(
    eventId: string,
    eventType: string,
    resourceId: string | undefined,
    payload: Record<string, unknown>
  ): { duplicate: boolean } {
    const existing = this.db
      .prepare('SELECT event_id FROM webhook_events WHERE event_id = ?')
      .get(eventId);

    if (existing) {
      return { duplicate: true };
    }

    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO webhook_events (event_id, event_type, resource_id, payload_json, status, received_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        eventId,
        eventType,
        resourceId || null,
        canonicalJson(payload),
        'PROCESSED',
        now
      );

    appendAuditEntry(this.db, 'WEBHOOK_PROCESSED', {
      eventId,
      eventType,
      resourceId,
    });

    return { duplicate: false };
  }

  // ==========================================
  // DEAL MANAGEMENT & HASH PINNING
  // ==========================================

  public saveDeal(dealSpec: DealSpec, status: 'DRAFT' | 'LOCKED' = 'DRAFT'): void {
    const now = new Date().toISOString();
    const specWithoutHash = { ...dealSpec };
    delete specWithoutHash.sha256Hash;
    const computedHash = crypto
      .createHash('sha256')
      .update(canonicalJson(specWithoutHash))
      .digest('hex');

    dealSpec.sha256Hash = computedHash;

    const existing = this.db
      .prepare('SELECT deal_id FROM deals WHERE deal_id = ?')
      .get(dealSpec.dealId);

    if (existing) {
      this.db
        .prepare(`
          UPDATE deals
          SET version = ?, title = ?, sha256_hash = ?, spec_json = ?, status = ?
          WHERE deal_id = ?
        `)
        .run(
          dealSpec.version,
          dealSpec.title,
          computedHash,
          canonicalJson(dealSpec),
          status,
          dealSpec.dealId
        );
    } else {
      this.db
        .prepare(`
          INSERT INTO deals (deal_id, version, title, sha256_hash, spec_json, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          dealSpec.dealId,
          dealSpec.version,
          dealSpec.title,
          computedHash,
          canonicalJson(dealSpec),
          status,
          now
        );

      appendAuditEntry(this.db, 'DEAL_CREATED', {
        dealId: dealSpec.dealId,
        sha256Hash: computedHash,
        title: dealSpec.title,
      });
    }

    // Initialize or refresh ledger state
    this.ensureLedgerState(dealSpec);
  }

  public lockDeal(dealId: string): DealSpec {
    const dealRow = this.db
      .prepare('SELECT * FROM deals WHERE deal_id = ?')
      .get(dealId) as any;

    if (!dealRow) {
      throw new Error(`Deal ${dealId} not found`);
    }

    const spec: DealSpec = JSON.parse(dealRow.spec_json);
    const now = new Date().toISOString();

    this.db
      .prepare('UPDATE deals SET status = ?, locked_at = ? WHERE deal_id = ?')
      .run('LOCKED', now, dealId);

    appendAuditEntry(this.db, 'DEAL_SIGNED', {
      dealId,
      sha256Hash: dealRow.sha256_hash,
      version: dealRow.version,
      lockedAt: now,
    });

    return spec;
  }

  public getDeal(dealId: string): { spec: DealSpec; status: 'DRAFT' | 'LOCKED' } | null {
    const row = this.db
      .prepare('SELECT * FROM deals WHERE deal_id = ?')
      .get(dealId) as any;

    if (!row) return null;
    return {
      spec: JSON.parse(row.spec_json),
      status: row.status,
    };
  }

  // ==========================================
  // LEDGER STATE & PAYEE BALANCES
  // ==========================================

  private ensureLedgerState(dealSpec: DealSpec): void {
    const existing = this.db
      .prepare('SELECT deal_id FROM ledger_state WHERE deal_id = ?')
      .get(dealSpec.dealId);

    const now = new Date().toISOString();

    if (!existing) {
      this.db
        .prepare(`
          INSERT INTO ledger_state (deal_id, cumulative_net_cents, recouped_cents, available_reserve_cents, updated_at)
          VALUES (?, 0, 0, 0, ?)
        `)
        .run(dealSpec.dealId, now);

      const payeeStmt = this.db.prepare(`
        INSERT OR IGNORE INTO payee_balances (
          deal_id, payee_id, name, email, carried_forward_cents, recovery_deficit_cents, total_earned_cents, total_paid_cents, updated_at
        ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?)
      `);

      for (const p of dealSpec.payees) {
        payeeStmt.run(dealSpec.dealId, p.id, p.name, p.email, now);
      }
    }
  }

  public getLedgerState(dealId: string): LedgerState {
    const ledgerRow = this.db
      .prepare('SELECT * FROM ledger_state WHERE deal_id = ?')
      .get(dealId) as any;

    if (!ledgerRow) {
      throw new Error(`Ledger state for deal ${dealId} not found`);
    }

    const payeeRows = this.db
      .prepare('SELECT * FROM payee_balances WHERE deal_id = ?')
      .all(dealId) as any[];

    const payeeLedgers: Record<string, PayeeLedgerState> = {};
    for (const r of payeeRows) {
      payeeLedgers[r.payee_id] = {
        carriedForwardCents: r.carried_forward_cents,
        recoveryDeficitCents: r.recovery_deficit_cents,
        totalEarnedCents: r.total_earned_cents,
        totalPaidCents: r.total_paid_cents,
      };
    }

    return {
      cumulativeNetCents: ledgerRow.cumulative_net_cents,
      recoupedCents: ledgerRow.recouped_cents,
      availableReserveCents: ledgerRow.available_reserve_cents,
      payeeLedgers,
    };
  }

  public setSeededLedgerState(dealId: string, state: LedgerState): void {
    const now = new Date().toISOString();
    const updateLedger = this.db.transaction(() => {
      this.db
        .prepare(`
          UPDATE ledger_state
          SET cumulative_net_cents = ?, recouped_cents = ?, available_reserve_cents = ?, updated_at = ?
          WHERE deal_id = ?
        `)
        .run(
          state.cumulativeNetCents,
          state.recoupedCents,
          state.availableReserveCents,
          now,
          dealId
        );

      const updatePayeeStmt = this.db.prepare(`
        UPDATE payee_balances
        SET carried_forward_cents = ?, recovery_deficit_cents = ?, total_earned_cents = ?, total_paid_cents = ?, updated_at = ?
        WHERE deal_id = ? AND payee_id = ?
      `);

      for (const [payeeId, pl] of Object.entries(state.payeeLedgers)) {
        updatePayeeStmt.run(
          pl.carriedForwardCents,
          pl.recoveryDeficitCents,
          pl.totalEarnedCents,
          pl.totalPaidCents,
          now,
          dealId,
          payeeId
        );
      }
    });

    updateLedger();
  }

  // ==========================================
  // SALES, WATERFALL & AUDIT TRANSITIONS
  // ==========================================

  public recordSaleTrace(
    dealId: string,
    sale: SaleInput,
    trace: WaterfallResult,
    paypalOrderId?: string,
    paypalCaptureId?: string
  ): void {
    const now = new Date().toISOString();

    const applySaleTx = this.db.transaction(() => {
      // 1. Insert sale record
      this.db
        .prepare(`
          INSERT INTO sales (
            sale_id, deal_id, paypal_order_id, paypal_capture_id,
            gross_cents, fee_cents, fee_source, net_cents,
            reserve_cents, recoup_cents, tier_applied, trace_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          sale.saleId,
          dealId,
          paypalOrderId || null,
          paypalCaptureId || null,
          trace.grossCents,
          trace.feeCents,
          trace.feeSource,
          trace.netCents,
          trace.reserveCents,
          trace.recoupPaidCents,
          String(trace.tierApplied),
          canonicalJson(trace),
          now
        );

      // 2. Update ledger state
      this.db
        .prepare(`
          UPDATE ledger_state
          SET cumulative_net_cents = ?, recouped_cents = ?, available_reserve_cents = ?, updated_at = ?
          WHERE deal_id = ?
        `)
        .run(
          trace.updatedLedgerState.cumulativeNetCents,
          trace.updatedLedgerState.recoupedCents,
          trace.updatedLedgerState.availableReserveCents,
          now,
          dealId
        );

      // 3. Update payee balances
      const updatePayeeStmt = this.db.prepare(`
        UPDATE payee_balances
        SET carried_forward_cents = ?, recovery_deficit_cents = ?, total_earned_cents = ?, total_paid_cents = ?, updated_at = ?
        WHERE deal_id = ? AND payee_id = ?
      `);

      for (const alloc of trace.payeeAllocations) {
        const pl = trace.updatedLedgerState.payeeLedgers[alloc.payeeId];
        updatePayeeStmt.run(
          alloc.newCarriedCents,
          alloc.newDeficitCents,
          pl.totalEarnedCents,
          pl.totalPaidCents,
          now,
          dealId,
          alloc.payeeId
        );
      }

      // 4. Append audit log
      appendAuditEntry(this.db, 'SALE_CAPTURED', {
        saleId: sale.saleId,
        dealId,
        grossCents: trace.grossCents,
        feeCents: trace.feeCents,
        netCents: trace.netCents,
        paypalOrderId,
        paypalCaptureId,
      });

      appendAuditEntry(this.db, 'WATERFALL_COMPUTED', {
        saleId: sale.saleId,
        dealId,
        payouts: trace.payeeAllocations.map((p) => ({
          payeeId: p.payeeId,
          payoutIssuedCents: p.payoutIssuedCents,
        })),
        invariantVerified: trace.invariantVerified,
      });
    });

    applySaleTx();
  }

  public recordRefundResult(dealId: string, refund: RefundInput, result: RefundResult): void {
    const now = new Date().toISOString();

    const applyRefundTx = this.db.transaction(() => {
      // 1. Update ledger state
      this.db
        .prepare(`
          UPDATE ledger_state
          SET cumulative_net_cents = ?, recouped_cents = ?, available_reserve_cents = ?, updated_at = ?
          WHERE deal_id = ?
        `)
        .run(
          result.updatedLedgerState.cumulativeNetCents,
          result.updatedLedgerState.recoupedCents,
          result.updatedLedgerState.availableReserveCents,
          now,
          dealId
        );

      // 2. Update payee recovery balances
      const updateDeficitStmt = this.db.prepare(`
        UPDATE payee_balances
        SET recovery_deficit_cents = ?, updated_at = ?
        WHERE deal_id = ? AND payee_id = ?
      `);

      for (const claw of result.payeeClawbacks) {
        updateDeficitStmt.run(claw.newDeficitCents, now, dealId, claw.payeeId);
      }

      // 3. Append audit log
      appendAuditEntry(this.db, 'REFUND_CLAWBACK_APPLIED', {
        refundId: refund.refundId,
        originalSaleId: refund.originalSaleId,
        netDebitCents: result.netDebitCents,
        reserveAbsorbedCents: result.reserveAbsorbedCents,
        remainingDeficitCents: result.remainingDeficitCents,
        clawbacks: result.payeeClawbacks,
      });
    });

    applyRefundTx();
  }

  // ==========================================
  // OUT-OF-ORDER WEBHOOK QUEUE
  // ==========================================

  public queuePendingEvent(
    eventId: string,
    eventType: string,
    saleId: string,
    payload: Record<string, unknown>
  ): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT OR IGNORE INTO pending_out_of_order_events (event_id, event_type, sale_id, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(eventId, eventType, saleId, canonicalJson(payload), now);
  }

  public getPendingEventsForSale(saleId: string): Array<{
    id: number;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }> {
    const rows = this.db
      .prepare('SELECT * FROM pending_out_of_order_events WHERE sale_id = ? ORDER BY id ASC')
      .all(saleId) as any[];

    return rows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      eventType: r.event_type,
      payload: JSON.parse(r.payload_json),
    }));
  }

  public deletePendingEvent(id: number): void {
    this.db.prepare('DELETE FROM pending_out_of_order_events WHERE id = ?').run(id);
  }

  // ==========================================
  // PAYOUT ITEMS MANAGEMENT
  // ==========================================

  public savePayoutItems(items: Array<{
    itemId: string;
    senderBatchId: string;
    payeeId: string;
    amountCents: number;
    receiverEmail: string;
    status: PayoutItemRecord['status'];
  }>): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO payout_items (item_id, sender_batch_id, payee_id, amount_cents, receiver_email, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTx = this.db.transaction(() => {
      for (const item of items) {
        stmt.run(
          item.itemId,
          item.senderBatchId,
          item.payeeId,
          item.amountCents,
          item.receiverEmail,
          item.status,
          now,
          now
        );
      }
    });

    insertTx();
  }

  public updatePayoutBatchStatus(
    senderBatchId: string,
    status: PayoutBatchRecord['batchStatus'],
    paypalBatchId?: string
  ): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE payout_batches
        SET batch_status = ?, paypal_batch_id = COALESCE(?, paypal_batch_id), updated_at = ?
        WHERE sender_batch_id = ?
      `)
      .run(status, paypalBatchId || null, now, senderBatchId);
  }

  public updatePayoutItemStatus(
    itemId: string,
    status: PayoutItemRecord['status'],
    paypalPayoutItemId?: string
  ): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE payout_items
        SET status = ?, paypal_payout_item_id = COALESCE(?, paypal_payout_item_id), updated_at = ?
        WHERE item_id = ?
      `)
      .run(status, paypalPayoutItemId || null, now, itemId);

    appendAuditEntry(this.db, 'PAYOUT_ITEM_UPDATED', {
      itemId,
      status,
      paypalPayoutItemId,
    });
  }
}
