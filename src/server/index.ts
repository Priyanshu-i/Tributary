import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import 'dotenv/config';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const { app } = createApp();

console.log(`====================================================`);
console.log(`⚡ Tributary API Server Starting...`);
console.log(`Host:        ${HOST}`);
console.log(`Port:        ${PORT}`);
console.log(`Environment: ${process.env.PAYPAL_ENVIRONMENT || 'sandbox'}`);
console.log(`Replay Mode: ${process.env.OFFLINE_REPLAY_ONLY === 'true' ? 'OFFLINE (Zero-Key)' : 'HYBRID (API + Cache)'}`);
console.log(`====================================================`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
}, (info) => {
  console.log(`🚀 Tributary API running at http://127.0.0.1:${info.port} (also on 0.0.0.0:${info.port})`);
});
