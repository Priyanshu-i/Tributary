import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
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

  // Mount API routers
  app.route('/api/deals', createDealsRouter(state));
  app.route('/api/checkout', createCheckoutRouter(state));
  app.route('/api/webhooks', createWebhooksRouter(state));
  app.route('/api/chaos', createChaosRouter(state));
  app.route('/api/demo', createDemoRouter(state));
  app.route('/api/system', createSystemRouter(state));

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', service: 'Tributary API' }));

  return { app, state };
}
