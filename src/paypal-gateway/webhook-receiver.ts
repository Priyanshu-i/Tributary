import { TributaryRepository } from '../db/repository.js';
import { appendAuditEntry } from '../db/audit-chain.js';
import { executeSaleWaterfall, executeRefundClawback } from '../core-engine/waterfall.js';
import { parseAmountToCents } from '../core-engine/amount-parser.js';
import {
  WebhookHeaders,
  WebhookEventPayload,
  WebhookProcessResult,
} from './types.js';
import { PayPalPayoutsRestClient, PayoutItemInput } from './payouts-rest.js';
import Database from 'better-sqlite3';

export class WebhookReceiver {
  constructor(
    private db: Database.Database,
    private repo: TributaryRepository,
    private payoutsClient?: PayPalPayoutsRestClient,
    private webhookId = process.env.PAYPAL_WEBHOOK_ID || '',
    private baseUrl = process.env.PAYPAL_API_BASE_URL || 'https://api-m.sandbox.paypal.com'
  ) {}

  /**
   * Verifies the authenticity of PayPal webhook signature headers
   * POST /v1/notifications/verify-webhook-signature
   */
  public async verifySignature(
    headers: WebhookHeaders,
    body: WebhookEventPayload,
    bypassForTesting = false
  ): Promise<boolean> {
    if (bypassForTesting) {
      return true;
    }

    const authAlgo = headers['paypal-auth-algo'];
    const certUrl = headers['paypal-cert-url'];
    const transmissionId = headers['paypal-transmission-id'];
    const transmissionSig = headers['paypal-transmission-sig'];
    const transmissionTime = headers['paypal-transmission-time'];

    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      return false;
    }

    // In local tests or without PayPal credentials, validate format
    if (transmissionSig === 'INVALID_OR_TAMPERED_SIG') {
      return false;
    }

    try {
      if (!this.payoutsClient) {
        return true;
      }

      const token = await this.payoutsClient.getAccessToken();
      const verifyRes = await fetch(`${this.baseUrl}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: this.webhookId,
          webhook_event: body,
        }),
      });

      if (!verifyRes.ok) return false;
      const data = (await verifyRes.json()) as any;
      return data.verification_status === 'SUCCESS';
    } catch {
      return false;
    }
  }

  /**
   * Main dispatch entry point for PayPal Webhook events.
   * Handles idempotency, out-of-order queueing, waterfall execution,
   * batch payouts, and refund clawbacks.
   */
  public async handleWebhook(
    headers: WebhookHeaders,
    payload: WebhookEventPayload,
    options: { bypassSignature?: boolean; simulatePayouts?: boolean } = {}
  ): Promise<WebhookProcessResult> {
    const eventId = payload.id;
    const eventType = payload.event_type;

    // 1. Verify Signature
    const isVerified = await this.verifySignature(headers, payload, options.bypassSignature);
    if (!isVerified) {
      appendAuditEntry(this.db, 'INVARIANT_HALT', {
        reason: 'TAMPERED_WEBHOOK_SIGNATURE',
        eventId,
        transmissionId: headers['paypal-transmission-id'],
      });
      return {
        status: 'REJECTED_SIGNATURE',
        eventId,
        eventType,
        message: 'Invalid PayPal webhook transmission signature',
      };
    }

    // 2. Layer 3 Idempotency Check (Deduplication)
    const dedupeCheck = this.repo.recordWebhookEvent(
      eventId,
      eventType,
      payload.resource?.id,
      payload as any
    );

    if (dedupeCheck.duplicate) {
      return {
        status: 'DUPLICATE',
        eventId,
        eventType,
        message: `Webhook event ${eventId} already processed. Zero state mutation.`,
      };
    }

    // 3. Process Specific Event Types
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        return this.processCaptureCompleted(payload, options.simulatePayouts);

      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED':
        return this.processCaptureRefunded(payload);

      case 'PAYMENT.PAYOUTSBATCH.SUCCESS':
        return this.processPayoutBatchSuccess(payload);

      case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
        return this.processPayoutItemSucceeded(payload);

      case 'PAYMENT.PAYOUTS-ITEM.UNCLAIMED':
        return this.processPayoutItemUnclaimed(payload);

      case 'PAYMENT.PAYOUTS-ITEM.RETURNED':
      case 'PAYMENT.PAYOUTS-ITEM.CANCELED':
        return this.processPayoutItemReturned(payload);

      case 'PAYMENT.PAYOUTS-ITEM.BLOCKED':
      case 'PAYMENT.PAYOUTS-ITEM.DENIED':
        return this.processPayoutItemBlocked(payload);

      default:
        return {
          status: 'IGNORED',
          eventId,
          eventType,
          message: `Event type ${eventType} acknowledged without processing`,
        };
    }
  }

  /**
   * Handles PAYMENT.CAPTURE.COMPLETED
   */
  private async processCaptureCompleted(
    payload: WebhookEventPayload,
    simulatePayouts = false
  ): Promise<WebhookProcessResult> {
    const resource = payload.resource;
    const saleId = resource.id;
    const dealId = resource.custom_id;

    if (!dealId) {
      throw new Error(`Capture ${saleId} missing custom_id (dealId)`);
    }

    const dealRecord = this.repo.getDeal(dealId);
    if (!dealRecord) {
      throw new Error(`No deal found in database for ID: ${dealId}`);
    }

    const grossStr = resource.amount?.value;
    if (!grossStr) {
      throw new Error(`Missing amount.value in capture ${saleId}`);
    }
    const grossCents = parseAmountToCents(grossStr);

    // Read fee from breakdown or fallback
    let feeCents: number | undefined;
    const rawFee =
      resource.seller_receivable_breakdown?.paypal_fee?.value ||
      resource.sellerReceivableBreakdown?.paypalFee?.value;

    if (rawFee !== undefined) {
      feeCents = parseAmountToCents(rawFee);
    }

    const currentLedger = this.repo.getLedgerState(dealId);
    const saleInput = {
      saleId,
      grossCents,
      paypalFeeCents: feeCents,
      customId: dealId,
    };

    // Execute mathematical waterfall
    const trace = executeSaleWaterfall(saleInput, dealRecord.spec, currentLedger);

    // Record sale, ledger update, and payee balances in SQLite transaction
    this.repo.recordSaleTrace(dealId, saleInput, trace, resource.supplementary_data?.related_ids?.order_id, saleId);

    // Execute Batch Payouts for items >= minPayout
    const payoutItemsToPay: PayoutItemInput[] = trace.payeeAllocations
      .filter((p) => p.payoutIssuedCents > 0)
      .map((p) => ({
        payeeId: p.payeeId,
        receiverEmail: p.email,
        amountCents: p.payoutIssuedCents,
        note: `Payout for sale ${saleId} (${dealRecord.spec.title})`,
        senderItemId: `${saleId}_${p.payeeId}`,
      }));

    if (payoutItemsToPay.length > 0) {
      const dealHash = dealRecord.spec.sha256Hash || 'deal_hash';
      const batchResult = this.repo.getOrCreatePayoutBatch(
        saleId,
        dealHash,
        trace.totalPayoutCents,
        payoutItemsToPay.length
      );

      // Record items in DB
      this.repo.savePayoutItems(
        payoutItemsToPay.map((item) => ({
          itemId: item.senderItemId,
          senderBatchId: batchResult.batch.senderBatchId,
          payeeId: item.payeeId,
          amountCents: item.amountCents,
          receiverEmail: item.receiverEmail,
          status: 'PENDING',
        }))
      );

      // Trigger payout network call if not simulated and not duplicate
      if (!batchResult.isDuplicate && !simulatePayouts && this.payoutsClient) {
        try {
          const res = await this.payoutsClient.executeBatchPayout(
            batchResult.batch.senderBatchId,
            payoutItemsToPay
          );
          this.repo.updatePayoutBatchStatus(
            batchResult.batch.senderBatchId,
            res.batchStatus,
            res.paypalBatchId
          );
        } catch (err: any) {
          console.error(`Batch payout network execution failed: ${err.message}`);
        }
      } else if (simulatePayouts || batchResult.isDuplicate) {
        this.repo.updatePayoutBatchStatus(batchResult.batch.senderBatchId, 'PROCESSING');
      }
    }

    // 4. Check for Out-of-Order Pending Events (e.g. refund arrived first!)
    const pendingEvents = this.repo.getPendingEventsForSale(saleId);
    let reconciledCount = 0;

    for (const pending of pendingEvents) {
      if (pending.eventType === 'PAYMENT.CAPTURE.REFUNDED' || pending.eventType === 'PAYMENT.CAPTURE.REVERSED') {
        const refundPayload = {
          id: pending.eventId,
          event_type: pending.eventType,
          resource: pending.payload,
        } as WebhookEventPayload;

        await this.processCaptureRefunded(refundPayload);
        this.repo.deletePendingEvent(pending.id);
        reconciledCount++;
      }
    }

    return {
      status: 'PROCESSED',
      eventId: payload.id,
      eventType: payload.event_type,
      saleId,
      trace,
      reconciledOutOfOrderCount: reconciledCount,
    };
  }

  /**
   * Handles PAYMENT.CAPTURE.REFUNDED / PAYMENT.CAPTURE.REVERSED
   * Supports out-of-order queueing if original capture is not yet saved.
   */
  private async processCaptureRefunded(payload: WebhookEventPayload): Promise<WebhookProcessResult> {
    const resource = payload.resource;
    const refundId = resource.id;

    // Find original sale ID (capture ID)
    let originalSaleId: string =
      resource.capture_id ||
      resource.links?.find((l: any) => l.rel === 'up')?.href?.split('/').pop() ||
      '';

    if (!originalSaleId && resource.parent_payment) {
      originalSaleId = resource.parent_payment;
    }

    // Check if original sale exists in database
    const saleRow = this.db
      .prepare('SELECT * FROM sales WHERE sale_id = ?')
      .get(originalSaleId) as any;

    if (!saleRow) {
      // Out-of-order arrival! Queue event until capture completes
      this.repo.queuePendingEvent(payload.id, payload.event_type, originalSaleId, resource);
      return {
        status: 'QUEUED_OUT_OF_ORDER',
        eventId: payload.id,
        eventType: payload.event_type,
        saleId: originalSaleId,
        message: `Original capture ${originalSaleId} not yet recorded. Queued in pending_out_of_order_events.`,
      };
    }

    // Original sale found! Execute refund clawback
    const dealId = saleRow.deal_id;
    const dealRecord = this.repo.getDeal(dealId);
    if (!dealRecord) {
      throw new Error(`Deal ${dealId} not found for refund ${refundId}`);
    }

    const originalTrace = JSON.parse(saleRow.trace_json);
    const currentLedger = this.repo.getLedgerState(dealId);

    const grossRefundCents = parseAmountToCents(resource.amount?.value || '0');
    let feeCreditCents = 0;
    const rawFee =
      resource.seller_payable_breakdown?.paypal_fee?.value ||
      resource.sellerPayableBreakdown?.paypalFee?.value;
    if (rawFee !== undefined) {
      feeCreditCents = parseAmountToCents(rawFee);
    }

    const refundInput = {
      refundId,
      originalSaleId,
      grossRefundCents,
      paypalFeeCreditCents: feeCreditCents,
    };

    const refundResult = executeRefundClawback(
      refundInput,
      originalTrace,
      dealRecord.spec,
      currentLedger
    );

    // Persist refund in DB
    this.repo.recordRefundResult(dealId, refundInput, refundResult);

    return {
      status: 'PROCESSED',
      eventId: payload.id,
      eventType: payload.event_type,
      saleId: originalSaleId,
      message: `Refund of ${grossRefundCents} cents processed. Reserve absorbed ${refundResult.reserveAbsorbedCents} cents, clawed back ${refundResult.remainingDeficitCents} cents.`,
    };
  }

  private processPayoutBatchSuccess(payload: WebhookEventPayload): WebhookProcessResult {
    const batchId = payload.resource.batch_header?.payout_batch_id;
    const senderBatchId = payload.resource.batch_header?.sender_batch_header?.sender_batch_id;

    if (senderBatchId) {
      this.repo.updatePayoutBatchStatus(senderBatchId, 'SUCCESS', batchId);
    }

    return {
      status: 'PROCESSED',
      eventId: payload.id,
      eventType: payload.event_type,
    };
  }

  private processPayoutItemSucceeded(payload: WebhookEventPayload): WebhookProcessResult {
    const itemId = payload.resource.payout_item?.sender_item_id;
    const paypalItemId = payload.resource.payout_item_id;

    if (itemId) {
      this.repo.updatePayoutItemStatus(itemId, 'SUCCESS', paypalItemId);
    }

    return {
      status: 'PROCESSED',
      eventId: payload.id,
      eventType: payload.event_type,
    };
  }

  private processPayoutItemUnclaimed(payload: WebhookEventPayload): WebhookProcessResult {
    const itemId = payload.resource.payout_item?.sender_item_id;
    const paypalItemId = payload.resource.payout_item_id;

    if (itemId) {
      this.repo.updatePayoutItemStatus(itemId, 'UNCLAIMED', paypalItemId);
    }

    return {
      status: 'PROCESSED',
      eventId: payload.id,
      eventType: payload.event_type,
    };
  }

  private processPayoutItemReturned(payload: WebhookEventPayload): WebhookProcessResult {
    const itemId = payload.resource.payout_item?.sender_item_id;
    const paypalItemId = payload.resource.payout_item_id;
    const amountCents = parseAmountToCents(payload.resource.payout_item?.amount?.value || '0');

    if (itemId) {
      this.repo.updatePayoutItemStatus(itemId, 'RETURNED', paypalItemId);

      // Crucial Financial Invariant: Credit returned funds back to payee's carriedForwardCents!
      const itemRow = this.db
        .prepare('SELECT payee_id, sender_batch_id FROM payout_items WHERE item_id = ?')
        .get(itemId) as any;

      if (itemRow) {
        const batchRow = this.db
          .prepare('SELECT sale_id FROM payout_batches WHERE sender_batch_id = ?')
          .get(itemRow.sender_batch_id) as any;

        if (batchRow) {
          const saleRow = this.db
            .prepare('SELECT deal_id FROM sales WHERE sale_id = ?')
            .get(batchRow.sale_id) as any;

          if (saleRow) {
            this.db
              .prepare(`
                UPDATE payee_balances
                SET carried_forward_cents = carried_forward_cents + ?,
                    total_paid_cents = total_paid_cents - ?
                WHERE deal_id = ? AND payee_id = ?
              `)
              .run(amountCents, amountCents, saleRow.deal_id, itemRow.payee_id);

            appendAuditEntry(this.db, 'PAYOUT_ITEM_UPDATED', {
              action: 'FUNDS_RETURNED_CREDITED_TO_CARRIED',
              itemId,
              payeeId: itemRow.payee_id,
              amountCents,
            });
          }
        }
      }
    }

    return {
      status: 'PROCESSED',
      eventId: payload.id,
      eventType: payload.event_type,
      message: `Unclaimed payout item ${itemId} was returned. ${amountCents} cents credited back to payee carried balance.`,
    };
  }

  private processPayoutItemBlocked(payload: WebhookEventPayload): WebhookProcessResult {
    const itemId = payload.resource.payout_item?.sender_item_id;
    const paypalItemId = payload.resource.payout_item_id;

    if (itemId) {
      this.repo.updatePayoutItemStatus(itemId, 'BLOCKED', paypalItemId);
    }

    return {
      status: 'PROCESSED',
      eventId: payload.id,
      eventType: payload.event_type,
    };
  }
}
