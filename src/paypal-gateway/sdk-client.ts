import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
} from '@paypal/paypal-server-sdk';
import { parseAmountToCents, formatCentsToAmount } from '../core-engine/amount-parser.js';

export interface CreateOrderResult {
  orderId: string;
  status?: string;
  customId: string;
  amountCents: number;
}

export interface CaptureOrderResult {
  captureId: string;
  orderId: string;
  status: string;
  customId: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  feeSource: 'PAYPAL_ACTUAL' | 'FALLBACK_SCHEDULE';
  rawBreakdown?: Record<string, any>;
}

export interface RefundCaptureResult {
  refundId: string;
  captureId: string;
  status: string;
  grossRefundCents: number;
  feeCreditCents: number;
  netDebitCents: number;
  rawBreakdown?: Record<string, any>;
}

export class PayPalGatewayClient {
  private ordersController: OrdersController;
  private paymentsController: PaymentsController;

  constructor(
    clientId = process.env.PAYPAL_CLIENT_ID || '',
    clientSecret = process.env.PAYPAL_CLIENT_SECRET || '',
    environment = (process.env.PAYPAL_ENVIRONMENT === 'production'
      ? Environment.Production
      : Environment.Sandbox)
  ) {
    const client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      environment,
    });

    this.ordersController = new OrdersController(client);
    this.paymentsController = new PaymentsController(client);
  }

  /**
   * Creates an order via @paypal/paypal-server-sdk OrdersController.createOrder
   * Tagged with customId (dealId) and strict CAPTURE intent.
   */
  public async createDealOrder(
    dealId: string,
    amountCents: number,
    idempotencyKey?: string
  ): Promise<CreateOrderResult> {
    const amountStr = formatCentsToAmount(amountCents);

    const { result } = await this.ordersController.createOrder({
      paypalRequestId: idempotencyKey,
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            referenceId: `pu_${dealId}_${Date.now()}`,
            customId: dealId,
            description: `Tributary Revenue Share Order (${dealId})`,
            amount: {
              currencyCode: 'USD',
              value: amountStr,
            },
          },
        ],
      },
    });

    if (!result.id) {
      throw new Error('PayPal OrdersController.createOrder returned empty order ID');
    }

    return {
      orderId: result.id,
      status: result.status,
      customId: dealId,
      amountCents,
    };
  }

  /**
   * Captures an authorized order via @paypal/paypal-server-sdk OrdersController.captureOrder
   * Extracts exact sellerReceivableBreakdown in integer cents.
   */
  public async captureDealOrder(
    orderId: string,
    idempotencyKey?: string
  ): Promise<CaptureOrderResult> {
    const { result } = await this.ordersController.captureOrder({
      id: orderId,
      paypalRequestId: idempotencyKey,
    });

    const purchaseUnit = result.purchaseUnits?.[0];
    const customId = purchaseUnit?.customId || '';
    const capture = purchaseUnit?.payments?.captures?.[0];

    if (!capture || !capture.id) {
      throw new Error(`No capture found in PayPal capture response for order ${orderId}`);
    }

    const captureId = capture.id;
    const status = capture.status || 'COMPLETED';

    // Defensively check both SDK camelCase and REST snake_case
    const breakdown =
      (capture as any).sellerReceivableBreakdown ||
      (capture as any).seller_receivable_breakdown;

    let grossCents: number;
    let feeCents: number;
    let netCents: number;
    let feeSource: 'PAYPAL_ACTUAL' | 'FALLBACK_SCHEDULE';

    if (capture.amount?.value) {
      grossCents = parseAmountToCents(capture.amount.value);
    } else if (breakdown?.grossAmount?.value) {
      grossCents = parseAmountToCents(breakdown.grossAmount.value);
    } else if (breakdown?.gross_amount?.value) {
      grossCents = parseAmountToCents(breakdown.gross_amount.value);
    } else {
      throw new Error('Cannot determine gross amount from PayPal capture response');
    }

    const rawFee =
      breakdown?.paypalFee?.value ||
      breakdown?.paypal_fee?.value;

    if (rawFee !== undefined && rawFee !== null) {
      feeCents = parseAmountToCents(rawFee);
      feeSource = 'PAYPAL_ACTUAL';
    } else {
      // Fallback 3.49% + $0.49
      feeCents = Math.floor((grossCents * 349) / 10000) + 49;
      feeSource = 'FALLBACK_SCHEDULE';
    }

    netCents = grossCents - feeCents;

    return {
      captureId,
      orderId,
      status,
      customId,
      grossCents,
      feeCents,
      netCents,
      feeSource,
      rawBreakdown: breakdown,
    };
  }

  /**
   * Issues a partial or full refund via @paypal/paypal-server-sdk PaymentsController.refundCapturedPayment
   */
  public async refundCapturedOrder(
    captureId: string,
    amountCents: number,
    idempotencyKey?: string
  ): Promise<RefundCaptureResult> {
    const amountStr = formatCentsToAmount(amountCents);

    const { result } = await this.paymentsController.refundCapturedPayment({
      captureId,
      paypalRequestId: idempotencyKey,
      body: {
        amount: {
          currencyCode: 'USD',
          value: amountStr,
        },
      },
    });

    if (!result.id) {
      throw new Error(`Refund failed for capture ${captureId}`);
    }

    const breakdown =
      (result as any).sellerPayableBreakdown ||
      (result as any).seller_payable_breakdown;

    const grossRefundCents = amountCents;
    let feeCreditCents = 0;

    const rawFee =
      breakdown?.paypalFee?.value ||
      breakdown?.paypal_fee?.value;

    if (rawFee !== undefined && rawFee !== null) {
      feeCreditCents = parseAmountToCents(rawFee);
    }

    const netDebitCents = grossRefundCents - feeCreditCents;

    return {
      refundId: result.id,
      captureId,
      status: result.status || 'COMPLETED',
      grossRefundCents,
      feeCreditCents,
      netDebitCents,
      rawBreakdown: breakdown,
    };
  }
}
