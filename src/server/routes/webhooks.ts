import { Hono } from 'hono';
import { AppState } from '../state.js';

export function createWebhooksRouter(state: AppState) {
  const router = new Hono();

  router.post('/paypal', async (c) => {
    try {
      const headers = c.req.header();
      const payload = await c.req.json();

      const result = await state.receiver.handleWebhook(headers, payload);

      if (result.status === 'REJECTED_SIGNATURE') {
        return c.json({ error: result.message, status: result.status }, 401);
      }

      return c.json(result, 200);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  return router;
}
