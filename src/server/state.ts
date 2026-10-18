import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase } from '../db/schema.js';
import { TributaryRepository } from '../db/repository.js';
import { PayPalGatewayClient } from '../paypal-gateway/sdk-client.js';
import { PayPalPayoutsRestClient } from '../paypal-gateway/payouts-rest.js';
import { WebhookReceiver } from '../paypal-gateway/webhook-receiver.js';

export interface AppState {
  db: Database.Database;
  repo: TributaryRepository;
  gatewayClient: PayPalGatewayClient;
  payoutsClient: PayPalPayoutsRestClient;
  receiver: WebhookReceiver;
  isPayoutsPaused: boolean;
  maxBatchPayoutCents: number;
}

let globalState: AppState | null = null;

export function createAppState(dbPath?: string): AppState {
  let db: Database.Database;

  if (dbPath === ':memory:') {
    db = new Database(':memory:');
  } else {
    const resolvedPath = path.resolve(process.cwd(), dbPath || process.env.DATABASE_URL || 'tributary.db');
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(resolvedPath);
  }

  initDatabase(db);
  const repo = new TributaryRepository(db);
  const gatewayClient = new PayPalGatewayClient();
  const payoutsClient = new PayPalPayoutsRestClient();
  const receiver = new WebhookReceiver(db, repo, payoutsClient);

  const maxBatchPayoutCents = parseInt(process.env.MAX_BATCH_PAYOUT_CENTS || '1000000', 10); // $10,000 cap default

  return {
    db,
    repo,
    gatewayClient,
    payoutsClient,
    receiver,
    isPayoutsPaused: false,
    maxBatchPayoutCents,
  };
}

export function getAppState(): AppState {
  if (!globalState) {
    globalState = createAppState();
  }
  return globalState;
}

export function setAppState(state: AppState): void {
  globalState = state;
}
