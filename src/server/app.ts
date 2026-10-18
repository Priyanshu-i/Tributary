import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppState, getAppState } from './state.js';
import { createDealsRouter } from './routes/deals.js';
import { createCheckoutRouter } from './routes/checkout.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { createChaosRouter } from './routes/chaos.js';
import { createDemoRouter } from './routes/demo.js';
import { createSystemRouter } from './routes/system.js';

export function createApp(customState?: AppState) {
  const state = customState || getAppState();
  const app = new Hono();

  // Middleware
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'PayPal-Request-Id'],
  }));

  // Global Error Handler - ALWAYS returns valid JSON, never empty body
  app.onError((err, c) => {
    console.error('[API Uncaught Error]', err);
    return c.json({
      ok: false,
      error: err.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
    }, 500);
  });

  // Global Not Found Handler - valid JSON
  app.notFound((c) => {
    return c.json({
      ok: false,
      error: `Route not found: ${c.req.method} ${c.req.url}`,
      timestamp: new Date().toISOString(),
    }, 404);
  });

  // Health check endpoints (both /api/health and /health)
  const healthHandler = (c: any) => c.json({
    status: 'ok',
    mode: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
    port: parseInt(process.env.PORT || '3001', 10),
    timestamp: new Date().toISOString(),
  });

  app.get('/api/health', healthHandler);
  app.get('/health', healthHandler);

  // Mount API routers
  app.route('/api/deals', createDealsRouter(state));
  app.route('/api/checkout', createCheckoutRouter(state));
  app.route('/api/webhooks', createWebhooksRouter(state));
  app.route('/api/chaos', createChaosRouter(state));
  app.route('/api/demo', createDemoRouter(state));
  app.route('/api/system', createSystemRouter(state));

  return { app, state };
}
