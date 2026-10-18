import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import 'dotenv/config';

const PORT = parseInt(process.env.PORT || '3000', 10);
const { app } = createApp();

console.log(`====================================================`);
console.log(`⚡ Tributary API Server Starting...`);
console.log(`Port:        ${PORT}`);
console.log(`Environment: ${process.env.PAYPAL_ENVIRONMENT || 'sandbox'}`);
console.log(`Replay Mode: ${process.env.OFFLINE_REPLAY_ONLY === 'true' ? 'OFFLINE (Zero-Key)' : 'HYBRID (API + Cache)'}`);
console.log(`====================================================`);

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`🚀 Tributary API running at http://localhost:${info.port}`);
});
