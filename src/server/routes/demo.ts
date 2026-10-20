import { Hono } from 'hono';
import { AppState } from '../state.js';
import { DealSpec } from '../../core-engine/types.js';

export function resetMoonlitClimax(state: AppState): DealSpec {
  const moonlitDeal: DealSpec = {
    dealId: 'deal_moonlit_demo',
    version: 1,
    title: 'Moonlit Indie Game Revenue Share Agreement',
    payees: [
      { id: 'maya', name: 'Maya Lin', email: process.env.PAYPAL_PAYEE_MAYA_EMAIL || process.env.PAYPAL_PAYEE_MAYA || 'maya-payee@personal.example.com', tier1Bps: 4000, tier2Bps: 2500 },
      { id: 'arjun', name: 'Arjun Rao', email: process.env.PAYPAL_PAYEE_ARJUN_EMAIL || process.env.PAYPAL_PAYEE_ARJUN || 'arjun-payee@personal.example.com', tier1Bps: 3000, tier2Bps: 2500 },
      { id: 'lina', name: 'Lina Chen', email: process.env.PAYPAL_PAYEE_LINA_EMAIL || process.env.PAYPAL_PAYEE_LINA || 'lina-payee@personal.example.com', tier1Bps: 2000, tier2Bps: 2500 },
      { id: 'dev', name: 'Dev Patel', email: process.env.PAYPAL_PAYEE_DEV_EMAIL || process.env.PAYPAL_PAYEE_DEV || 'dev-payee@personal.example.com', tier1Bps: 1000, tier2Bps: 2500 },
    ],
    recoupBucket: {
      payeeId: 'maya',
      totalCents: 40000, // $400 upfront art cost
      feeBasis: 'NET_OF_FEES',
    },
    tierThresholdNetCents: 200000, // $2,000 net
    reserveBps: 1000, // 10%
    holdbackDays: 14,
    minPayoutCents: 0, // set 0 for raw item display in demo
    clawbackRule: 'PRO_RATA_SALE_SHARE',
  };

  // 1. Wipe all old sales, batches, items, and audit records cleanly
  state.db.prepare('DELETE FROM sales').run();
  state.db.prepare('DELETE FROM payout_batches').run();
  state.db.prepare('DELETE FROM payout_items').run();
  state.db.prepare('DELETE FROM audit_log').run();

  // 2. Save and lock deal specification
  state.repo.saveDeal(moonlitDeal, 'DRAFT');
  state.repo.lockDeal(moonlitDeal.dealId);

  // 3. Seed Maya at exactly $370.00 of $400.00 recouped!
  state.repo.setSeededLedgerState(moonlitDeal.dealId, {
    cumulativeNetCents: 37000,
    recoupedCents: 37000,
    availableReserveCents: 0,
    payeeLedgers: {
      maya: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 37000, totalPaidCents: 37000 },
      arjun: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
      lina: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
      dev: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
    },
  });

  return moonlitDeal;
}

export function createDemoRouter(state: AppState) {
  const router = new Hono();

  // Dedicated Reset Climax endpoint
  router.post('/reset-moonlit-climax', async (c) => {
    try {
      const deal = resetMoonlitClimax(state);
      return c.json({
        success: true,
        dealId: deal.dealId,
        title: deal.title,
        recoupedCents: 37000,
        totalRecoupCents: 40000,
        remainingRecoupCents: 3000,
        message: 'Reset complete: Maya is at $370.00 / $400.00 recouped. 0 old sales or refunds exist.',
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  router.post('/load-preset', async (c) => {
    try {
      const body = await c.req.json();
      const preset = body.preset || 'moonlit';

      if (preset === 'moonlit') {
        const moonlitDeal = resetMoonlitClimax(state);
        return c.json({
          success: true,
          preset: 'moonlit',
          dealId: moonlitDeal.dealId,
          title: moonlitDeal.title,
          recoupedCents: 37000,
          totalRecoupCents: 40000,
          remainingRecoupCents: 3000,
          message: 'Seeded Team Moonlit: Maya is at $370.00 / $400.00 recouped. The next $100 sale will complete Maya recoup ($30.00) and split the remaining $56.42 40/30/20/10.',
        });
      }

      if (preset === 'creator') {
        const creatorDeal: DealSpec = {
          dealId: 'deal_creator_demo',
          version: 1,
          title: 'Creator Course & Ad Agency Launch',
          payees: [
            { id: 'creator', name: 'Alex Creator', email: 'creator@example.com', tier1Bps: 5000, tier2Bps: 6000 },
            { id: 'agency', name: 'Apex Media Agency', email: 'agency@example.com', tier1Bps: 5000, tier2Bps: 4000 },
          ],
          recoupBucket: {
            payeeId: 'agency',
            totalCents: 50000, // $500 ad spend
            feeBasis: 'NET_OF_FEES',
          },
          tierThresholdNetCents: 300000, // $3,000 net
          reserveBps: 1000,
          holdbackDays: 14,
          minPayoutCents: 0,
          clawbackRule: 'PRO_RATA_SALE_SHARE',
        };

        state.repo.saveDeal(creatorDeal, 'DRAFT');
        state.repo.lockDeal(creatorDeal.dealId);

        return c.json({
          success: true,
          preset: 'creator',
          dealId: creatorDeal.dealId,
          title: creatorDeal.title,
          recoupedCents: 0,
          totalRecoupCents: 50000,
          remainingRecoupCents: 50000,
          message: 'Seeded Creator Launch: $500 upfront ad spend to Apex Media before 50/50 profit split.',
        });
      }

      return c.json({ error: `Unknown preset: ${preset}` }, 400);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  return router;
}
