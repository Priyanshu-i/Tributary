import { Hono } from 'hono';
import { AppState } from '../state.js';
import { ChaosHarness } from '../../paypal-gateway/chaos-harness.js';

export function createChaosRouter(state: AppState) {
  const router = new Hono();

  router.post('/run', async (c) => {
    try {
      const harness = new ChaosHarness(state.db);
      const report = await harness.runAllChaosTests();

      return c.json({
        success: true,
        report,
      });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  return router;
}
