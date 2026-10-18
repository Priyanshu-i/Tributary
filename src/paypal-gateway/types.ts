import { WaterfallResult } from '../core-engine/types.js';

export interface WebhookHeaders {
  'paypal-auth-algo'?: string;
  'paypal-cert-url'?: string;
  'paypal-transmission-id'?: string;
  'paypal-transmission-sig'?: string;
  'paypal-transmission-time'?: string;
  [key: string]: string | undefined;
}

export interface WebhookEventPayload {
  id: string;
  event_version?: string;
  create_time?: string;
  event_type: string;
  resource_type?: string;
  summary?: string;
  resource: Record<string, any>;
}

export interface WebhookProcessResult {
  status: 'PROCESSED' | 'DUPLICATE' | 'IGNORED' | 'QUEUED_OUT_OF_ORDER' | 'REJECTED_SIGNATURE' | 'ERROR';
  eventId: string;
  eventType: string;
  saleId?: string;
  trace?: WaterfallResult;
  reconciledOutOfOrderCount?: number;
  message?: string;
}

export interface ChaosTestResult {
  testNumber: number;
  testName: string;
  description: string;
  status: 'PASS' | 'FAIL';
  invariantHeld: boolean;
  auditLogHash: string;
  durationMs: number;
  details: Record<string, unknown>;
}
