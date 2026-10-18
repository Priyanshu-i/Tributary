import { Hono } from 'hono';
import { AppState } from '../state.js';
import { verifyAuditChain } from '../../db/audit-chain.js';

export function createSystemRouter(state: AppState) {
  const router = new Hono();

  router.get('/status', (c) => {
    const audit = verifyAuditChain(state.db);
    return c.json({
      success: true,
      service: 'Tributary Payment & Revenue Share Engine',
      environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
      isPayoutsPaused: state.isPayoutsPaused,
      maxBatchPayoutCents: state.maxBatchPayoutCents,
      fallbackFeeSchedule: {
        bps: 349,
        fixedCents: 49,
        label: '3.49% + $0.49 standard PayPal fallback',
      },
      auditContinuity: audit,
      uptimeSeconds: process.uptime(),
    });
  });

  router.post('/pause', async (c) => {
    try {
      const body = await c.req.json();
      const paused = typeof body.paused === 'boolean' ? body.paused : !state.isPayoutsPaused;
      state.isPayoutsPaused = paused;

      return c.json({
        success: true,
        isPayoutsPaused: state.isPayoutsPaused,
        message: paused
          ? 'EMERGENCY KILL-SWITCH ENGAGED: All automated batch payouts are suspended.'
          : 'Normal operating state restored: automated payouts active.',
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  return router;
}
