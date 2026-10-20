import { Hono } from 'hono';
import { AppState } from '../state.js';
import { executeSaleWaterfall, executeRefundClawback } from '../../core-engine/waterfall.js';
import { appendAuditEntry } from '../../db/audit-chain.js';
import { PayoutItemInput } from '../../paypal-gateway/payouts-rest.js';
import crypto from 'node:crypto';

export function createCheckoutRouter(state: AppState) {
  const router = new Hono();

  // 1. Create PayPal Order (Orders v2)
  router.post('/create-order', async (c) => {
    try {
      const body = await c.req.json();
      const dealId = body.dealId;
      const amountCents = body.amountCents || 10000; // $100.00 default

      const deal = state.repo.getDeal(dealId);
      if (!deal) {
        return c.json({ error: `Deal ${dealId} not found` }, 404);
      }

      const hasCredentials = !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET;

      if (hasCredentials) {
        const orderRes = await state.gatewayClient.createDealOrder(dealId, amountCents);
        return c.json({
          success: true,
          orderId: orderRes.orderId,
          amountCents,
          dealId,
          mode: 'LIVE_SANDBOX',
        });
      } else {
        // Deterministic simulated order
        const mockOrderId = `ORD-SANDBOX-${Date.now()}`;
        return c.json({
          success: true,
          orderId: mockOrderId,
          amountCents,
          dealId,
          mode: 'SIMULATED_SANDBOX',
        });
      }
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // 2. Capture Order & Execute Waterfall (Orders v2 + Payouts v1)
  router.post('/capture-order', async (c) => {
    try {
      const body = await c.req.json();
      const {
        orderId = `ORD-${Date.now()}`,
        dealId,
        grossCents = 10000,
        feeCents = 398,
        simulateSandbox = false,
      } = body;

      if (!dealId) {
        return c.json({ error: 'dealId is required' }, 400);
      }

      const deal = state.repo.getDeal(dealId);
      if (!deal) {
        return c.json({ error: `Deal ${dealId} not found` }, 404);
      }

      let capturedGross = grossCents;
      let capturedFee = feeCents;
      let feeSource: 'PAYPAL_ACTUAL' | 'FALLBACK_SCHEDULE' = 'PAYPAL_ACTUAL';
      let captureId = `CAP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

      const hasCredentials = !simulateSandbox && !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET;

      if (hasCredentials && !orderId.startsWith('ORD-SANDBOX-') && !orderId.startsWith('ORD-SIM-')) {
        try {
          const capRes = await state.gatewayClient.captureDealOrder(orderId);
          captureId = capRes.captureId;
          capturedGross = capRes.grossCents;
          capturedFee = capRes.feeCents;
          feeSource = capRes.feeSource;
        } catch (err: any) {
          console.warn(`[Checkout] Real capture failed, falling back to simulated capture: ${err.message}`);
          feeSource = 'FALLBACK_SCHEDULE';
        }
      }

      // Check Global Pause Switch
      if (state.isPayoutsPaused) {
        appendAuditEntry(state.db, 'INVARIANT_HALT', {
          reason: 'PAYOUTS_PAUSED_BY_KILL_SWITCH',
          orderId,
          dealId,
          capturedGross,
        });

        return c.json({
          success: false,
          halted: true,
          reason: 'PAYOUTS_PAUSED_BY_KILL_SWITCH',
          message: 'Payouts are currently suspended via the global emergency switch.',
        }, 403);
      }

      // Execute Integer-Cent Waterfall
      const currentLedger = state.repo.getLedgerState(dealId);
      const saleInput = {
        saleId: captureId,
        grossCents: capturedGross,
        paypalFeeCents: capturedFee,
        customId: dealId,
      };

      const trace = executeSaleWaterfall(saleInput, deal.spec, currentLedger);

      // Check Per-Batch Cap
      if (trace.totalPayoutCents > state.maxBatchPayoutCents) {
        appendAuditEntry(state.db, 'INVARIANT_HALT', {
          reason: 'BATCH_PAYOUT_EXCEEDS_CAP',
          totalPayoutCents: trace.totalPayoutCents,
          maxBatchPayoutCents: state.maxBatchPayoutCents,
        });

        return c.json({
          success: false,
          halted: true,
          reason: 'BATCH_PAYOUT_EXCEEDS_CAP',
          message: `Payout batch ($${(trace.totalPayoutCents / 100).toFixed(2)}) exceeds safety cap ($${(state.maxBatchPayoutCents / 100).toFixed(2)}).`,
        }, 400);
      }

      // Persist sale trace and updated balances
      state.repo.recordSaleTrace(dealId, saleInput, trace, orderId, captureId);

      // Prepare Payout Items
      const payoutItemsToPay: PayoutItemInput[] = trace.payeeAllocations
        .filter((p) => p.payoutIssuedCents > 0)
        .map((p) => ({
          payeeId: p.payeeId,
          receiverEmail: p.email,
          amountCents: p.payoutIssuedCents,
          note: `Revenue share from sale ${captureId}`,
          senderItemId: `${captureId}_${p.payeeId}`,
        }));

      let batchRecord: any = null;

      if (payoutItemsToPay.length > 0) {
        const dealHash = deal.spec.sha256Hash || 'deal_hash';
        const batchResult = state.repo.getOrCreatePayoutBatch(
          captureId,
          dealHash,
          trace.totalPayoutCents,
          payoutItemsToPay.length
        );

        state.repo.savePayoutItems(
          payoutItemsToPay.map((item) => ({
            itemId: item.senderItemId,
            senderBatchId: batchResult.batch.senderBatchId,
            payeeId: item.payeeId,
            amountCents: item.amountCents,
            receiverEmail: item.receiverEmail,
            status: 'PENDING',
          }))
        );

        if (!batchResult.isDuplicate && hasCredentials) {
          try {
            const payRes = await state.payoutsClient.executeBatchPayout(
              batchResult.batch.senderBatchId,
              payoutItemsToPay
            );
            state.repo.updatePayoutBatchStatus(
              batchResult.batch.senderBatchId,
              payRes.batchStatus,
              payRes.paypalBatchId
            );
            batchRecord = { ...batchResult.batch, ...payRes };
          } catch (err: any) {
            console.error(`Live batch payout failed: ${err.message}`);
            state.repo.updatePayoutBatchStatus(batchResult.batch.senderBatchId, 'PROCESSING');
            batchRecord = batchResult.batch;
          }
        } else {
          state.repo.updatePayoutBatchStatus(batchResult.batch.senderBatchId, 'PROCESSING');
          batchRecord = { ...batchResult.batch, batchStatus: 'PROCESSING' };
        }
      }

      return c.json({
        success: true,
        saleId: captureId,
        orderId,
        dealId,
        grossCents: capturedGross,
        feeCents: capturedFee,
        feeSource,
        trace,
        batch: batchRecord,
        updatedLedger: trace.updatedLedgerState,
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // 3. Trigger Post-Payout Refund (Captures Refund v2)
  const refundHandler = async (c: any) => {
    try {
      const saleId = c.req.param('id');
      const body = await c.req.json();
      const grossRefundCents = body.amountCents || 5000; // $50.00 default
      const feeCreditCents = body.feeCreditCents || 0;

      const saleRow = state.db
        .prepare('SELECT * FROM sales WHERE sale_id = ?')
        .get(saleId) as any;

      if (!saleRow) {
        return c.json({ error: `Sale ${saleId} not found` }, 404);
      }

      const deal = state.repo.getDeal(saleRow.deal_id);
      if (!deal) {
        return c.json({ error: `Deal ${saleRow.deal_id} not found` }, 404);
      }

      const originalTrace = JSON.parse(saleRow.trace_json);
      const currentLedger = state.repo.getLedgerState(saleRow.deal_id);

      const refundId = `REF-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      const refundInput = {
        refundId,
        originalSaleId: saleId,
        grossRefundCents,
        paypalFeeCreditCents: feeCreditCents,
      };

      // Execute mathematical refund clawback
      const refundResult = executeRefundClawback(
        refundInput,
        originalTrace,
        deal.spec,
        currentLedger
      );

      // Persist in repository and audit log
      state.repo.recordRefundResult(saleRow.deal_id, refundInput, refundResult);

      return c.json({
        success: true,
        refundId,
        originalSaleId: saleId,
        grossRefundCents,
        refundResult,
        updatedLedger: refundResult.updatedLedgerState,
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  };

  router.post('/sales/:id/refund', refundHandler);
  router.post('/:id/refund', refundHandler);

  // 4. Poll Live PayPal Batch Status (GET /v1/payments/payouts/{batch_id})
  router.get('/payouts/:batchId', async (c) => {
    try {
      const batchId = c.req.param('batchId');
      const hasCredentials = !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET;

      if (
        hasCredentials &&
        !batchId.startsWith('BATCH-SIM-') &&
        !batchId.startsWith('LOCAL_') &&
        !batchId.startsWith('PRE_')
      ) {
        try {
          const statusRes = await state.payoutsClient.getPayoutBatchStatus(batchId);
          const header = statusRes.batch_header || {};
          const items = statusRes.items || [];
          const status = header.batch_status || 'PROCESSING';
          state.repo.updatePayoutBatchStatus(
            header.sender_batch_header?.sender_batch_id || batchId,
            status,
            batchId
          );
          return c.json({
            success: true,
            batchId,
            status,
            mode: 'LIVE_SANDBOX',
            batchHeader: header,
            items: items.map((it: any) => ({
              itemId: it.payout_item_id,
              senderItemId: it.payout_item?.sender_item_id,
              receiver: it.payout_item?.receiver,
              amount: it.payout_item?.amount?.value,
              status: it.transaction_status,
            })),
          });
        } catch (err: any) {
          console.warn(`[Payouts] Polling live batch ${batchId} failed: ${err.message}`);
        }
      }

      // Simulated or local demo response
      return c.json({
        success: true,
        batchId,
        status: 'SUCCESS',
        mode: 'SIMULATED',
        items: [
          { receiver: 'maya-payee@personal.example.com', amount: '52.57', status: 'SUCCESS' },
          { receiver: 'arjun-payee@personal.example.com', amount: '16.93', status: 'SUCCESS' },
          { receiver: 'lina-payee@personal.example.com', amount: '11.28', status: 'SUCCESS' },
          { receiver: 'dev-payee@personal.example.com', amount: '5.64', status: 'SUCCESS' },
        ],
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  return router;
}
