import { formatCentsToAmount } from '../core-engine/amount-parser.js';

export interface PayoutItemInput {
  payeeId: string;
  receiverEmail: string;
  amountCents: number;
  note?: string;
  senderItemId: string;
}

export interface PayoutBatchExecutionResult {
  senderBatchId: string;
  paypalBatchId?: string;
  batchStatus: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'DENIED' | 'CANCELED';
  rawResponse?: Record<string, any>;
}

export class PayPalPayoutsRestClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(
    clientId = process.env.PAYPAL_CLIENT_ID || '',
    clientSecret = process.env.PAYPAL_CLIENT_SECRET || '',
    baseUrl = process.env.PAYPAL_API_BASE_URL || 'https://api-m.sandbox.paypal.com'
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl;
  }

  public async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60000) {
      return this.cachedToken.token;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal Client ID or Secret missing');
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OAuth2 authentication failed (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = {
      token: data.access_token,
      expiresAt: now + (data.expires_in || 3600) * 1000,
    };

    return data.access_token;
  }

  /**
   * Dispatches a batch payout to PayPal Payouts v1 REST API
   * POST /v1/payments/payouts
   */
  public async executeBatchPayout(
    senderBatchId: string,
    items: PayoutItemInput[],
    emailSubject = 'Tributary Revenue Share Payout',
    emailMessage = 'Automated revenue share from Tributary.'
  ): Promise<PayoutBatchExecutionResult> {
    const token = await this.getAccessToken();

    const payoutPayload = {
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: emailSubject,
        email_message: emailMessage,
      },
      items: items.map((item) => ({
        recipient_type: 'EMAIL',
        amount: {
          value: formatCentsToAmount(item.amountCents),
          currency: 'USD',
        },
        receiver: item.receiverEmail,
        note: item.note || `Payout to ${item.receiverEmail}`,
        sender_item_id: item.senderItemId,
      })),
    };

    const res = await fetch(`${this.baseUrl}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payoutPayload),
    });

    const data = (await res.json()) as any;

    if (!res.ok && res.status !== 201) {
      throw new Error(`Payout API failed (${res.status}): ${JSON.stringify(data)}`);
    }

    const paypalBatchId = data.batch_header?.payout_batch_id;
    const batchStatus = (data.batch_header?.batch_status || 'PENDING') as PayoutBatchExecutionResult['batchStatus'];

    return {
      senderBatchId,
      paypalBatchId,
      batchStatus,
      rawResponse: data,
    };
  }

  /**
   * Retrieves batch status from PayPal Payouts
   * GET /v1/payments/payouts/{batchId}
   */
  public async getPayoutBatchStatus(batchId: string): Promise<any> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v1/payments/payouts/${batchId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to get payout batch status (${res.status})`);
    }

    return res.json();
  }

  /**
   * Cancels an unclaimed payout item
   * POST /v1/payments/payouts-item/{itemId}/cancel
   */
  public async cancelUnclaimedPayoutItem(itemId: string): Promise<any> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v1/payments/payouts-item/${itemId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to cancel unclaimed payout item (${res.status})`);
    }

    return res.json();
  }
}
