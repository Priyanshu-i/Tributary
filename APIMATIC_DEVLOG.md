# Tributary — APIMatic & PayPal Server SDK DevLog

This document details our engineering experience integrating the official APIMatic-generated [`@paypal/paypal-server-sdk`](https://www.npmjs.com/package/@paypal/paypal-server-sdk) (v2.5.0) into Tributary for the PayPal AI Hackathon 2026.

---

## 1. Overview & SDK Coverage Matrix

Tributary turns natural-language revenue-share agreements into deterministic, automated payout execution. Our integration spans checkout authorization, multi-party batch disbursements, and post-payout refund clawbacks.

The table below outlines our coverage across PayPal API domains:

| PayPal API Domain | Endpoint / Capability | Implementation in Tributary | Coverage Type |
| :--- | :--- | :--- | :---: |
| **Orders v2** | `POST /v2/checkout/orders`<br>`POST /v2/checkout/orders/{id}/capture` | `OrdersController.createOrder`<br>`OrdersController.captureOrder` | **`@paypal/paypal-server-sdk` (v2.5.0)** |
| **Payments v2** | `POST /v2/payments/captures/{id}/refund` | `PaymentsController.refundCapturedPayment` | **`@paypal/paypal-server-sdk` (v2.5.0)** |
| **Payouts v1** | `POST /v1/payments/payouts`<br>`GET /v1/payments/payouts/{id}` | Custom typed REST client ([`src/paypal-gateway/payouts-rest.ts`](./src/paypal-gateway/payouts-rest.ts)) | **Typed REST (Not in SDK v2.5.0)** |
| **Notifications v1** | `POST /v1/notifications/verify-webhook-signature` | Custom typed REST client ([`src/paypal-gateway/webhook-receiver.ts`](./src/paypal-gateway/webhook-receiver.ts)) | **Typed REST (Not in SDK v2.5.0)** |

---

## 2. Before & After: Migrating Legacy PayPal Patterns to APIMatic SDK v2.5.0

In earlier PayPal Node.js SDK iterations (e.g. `@paypal/checkout-server-sdk`), developers dealt with unstructured request objects, untyped execute calls, and positional argument confusion.

With `@paypal/paypal-server-sdk` v2.5.0, APIMatic introduced clean, controller-scoped methods that enforce typed parameter objects. This eliminated subtle parameter placement bugs, especially with idempotency keys (`paypalRequestId`) and tracking identifiers (`customId`).

### 2.1 Order Creation (`OrdersController.createOrder`)

**Legacy Pattern (Untyped / Positional):**
```typescript
// Legacy: Easy to misplace headers or pass invalid intent strings
const request = new paypal.orders.OrdersCreateRequest();
request.headers['PayPal-Request-Id'] = idempotencyKey; // Fragile header dictionary
request.requestBody({
  intent: 'CAPTURE', // Plain untyped string
  purchase_units: [{ amount: { currency_code: 'USD', value: '100.00' } }]
});
const response = await client.execute(request);
```

**APIMatic SDK v2.5.0 Pattern:**
```typescript
// Strongly-typed controller call in Tributary (src/paypal-gateway/sdk-client.ts)
const { result } = await this.ordersController.createOrder({
  paypalRequestId: idempotencyKey, // Explicit top-level typed parameter
  body: {
    intent: CheckoutPaymentIntent.Capture, // Strict TypeScript enum
    purchaseUnits: [
      {
        referenceId: `pu_${dealId}_${Date.now()}`,
        customId: dealId, // Preserves deal ID for webhook and ledger linkage
        description: `Tributary Revenue Share Order (${dealId})`,
        amount: {
          currencyCode: 'USD',
          value: amountStr,
        },
      },
    ],
  },
});
```

### 2.2 Order Capture & Refund

Capturing an order and executing refunds similarly benefit from explicit parameter objects:

```typescript
// Capture an authorized order
const { result: captureResult } = await this.ordersController.captureOrder({
  id: orderId,
  paypalRequestId: idempotencyKey,
});

// Partial or full refund on captured transaction
const { result: refundResult } = await this.paymentsController.refundCapturedPayment({
  captureId,
  paypalRequestId: idempotencyKey,
  body: {
    amount: {
      currencyCode: 'USD',
      value: amountStr,
    },
  },
});
```

Because `paypalRequestId` is an explicit named field on the argument interface rather than a loosely typed dictionary header, our codebase guarantees that every network request carries deterministic idempotency tokens.

---

## 3. CamelCase vs. Snake_Case Normalization (`sellerReceivableBreakdown`)

In financial settlement systems, payment processing fees must be extracted with zero cent error.

When capturing an order via Orders v2, PayPal's REST JSON payload returns snake_case objects:
```json
{
  "seller_receivable_breakdown": {
    "gross_amount": { "currency_code": "USD", "value": "100.00" },
    "paypal_fee": { "currency_code": "USD", "value": "3.98" },
    "net_amount": { "currency_code": "USD", "value": "96.02" }
  }
}
```

The APIMatic SDK v2.5.0 maps these to camelCase model properties:
- `seller_receivable_breakdown` $\rightarrow$ `sellerReceivableBreakdown`
- `paypal_fee` $\rightarrow$ `paypalFee`
- `gross_amount` $\rightarrow$ `grossAmount`
- `net_amount` $\rightarrow$ `netAmount`

In [`src/paypal-gateway/sdk-client.ts`](./src/paypal-gateway/sdk-client.ts), our gateway implementation handles both representations defensively:

```typescript
const purchaseUnit = result.purchaseUnits?.[0];
const capture = purchaseUnit?.payments?.captures?.[0];

// Defensively support both SDK camelCase and REST snake_case
const breakdown =
  (capture as any).sellerReceivableBreakdown ||
  (capture as any).seller_receivable_breakdown;

const rawFee =
  breakdown?.paypalFee?.value ||
  breakdown?.paypal_fee?.value;

let feeCents: number;
let feeSource: 'PAYPAL_ACTUAL' | 'FALLBACK_SCHEDULE';

if (rawFee !== undefined && rawFee !== null) {
  // Convert "3.98" directly to 398 integer cents (no floating-point operations)
  feeCents = parseAmountToCents(rawFee);
  feeSource = 'PAYPAL_ACTUAL';
} else {
  // Fallback to standard merchant schedule if fee breakdown is omitted
  feeCents = Math.floor((grossCents * 349) / 10000) + 49;
  feeSource = 'FALLBACK_SCHEDULE';
}
```

By parsing string values into integer cents immediately upon SDK receipt, the downstream revenue waterfall engine operates with pure integer math.

---

## 4. Idempotency & Error Handling with `ApiError`

In automated multi-party revenue splitting, duplicate transactions or unhandled API rejections can cause balance corruption. We paired APIMatic's error handling with a 3-layer idempotency guardrail:

1. **Transport Layer (`PayPal-Request-Id`):** Injected into all `createOrder`, `captureOrder`, and `refundCapturedPayment` SDK calls.
2. **Database Mutex (`sender_batch_id`):** Enforced via SQLite `UNIQUE PRIMARY KEY` constraint on `payout_batches`. Replayed requests are rejected before dispatching network calls.
3. **Webhook Deduplication:** Incoming webhooks are deduplicated against a `webhook_events` table before state mutation.

### Handling SDK `ApiError`

The APIMatic SDK exports a structured `ApiError` class containing HTTP status codes and structured body payloads. This allowed us to build robust error classification:

```typescript
import { ApiError } from '@paypal/paypal-server-sdk';

try {
  await this.ordersController.captureOrder({ id: orderId, paypalRequestId });
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`[PayPal SDK Error] HTTP ${error.statusCode}:`, error.result);
    if (error.statusCode === 422) {
      // Handle unprocessable entity (e.g. ORDER_ALREADY_CAPTURED)
      return { status: 'ALREADY_CAPTURED' };
    }
  }
  throw error;
}
```

This structured error handling integrates directly with our 8-Test Chaos Suite, verifying that network collisions, out-of-order refunds, and duplicate triggers halt safely while keeping the SHA-256 audit chain unbroken.

---

## 5. Constructive DX Feedback for the APIMatic & PayPal SDK Team

The developer experience with `@paypal/paypal-server-sdk` v2.5.0 is a substantial upgrade over legacy PayPal SDKs. The TypeScript typings are thorough, client initialization via `clientCredentialsAuthCredentials` is concise, and method signatures are consistent across controllers.

To make the SDK even more comprehensive, we recommend two additions in future releases:

1. **Include a `PayoutsController` (Payouts v1):**
   - The Batch Payouts API (`POST /v1/payments/payouts` and `GET /v1/payments/payouts/{id}`) is essential for marketplaces, multi-creator platforms, and revenue-sharing tools.
   - Currently, developers must write a separate typed REST client with manual OAuth2 token caching for payouts. Adding a first-class `PayoutsController` into `@paypal/paypal-server-sdk` would enable 100% end-to-end SDK coverage for multi-party disbursement workflows.

2. **Include Webhook Signature Verification in the SDK:**
   - Verifying incoming webhooks (`POST /v1/notifications/verify-webhook-signature`) is a required security practice for production web applications.
   - Providing a typed helper method like `notificationsController.verifyWebhookSignature({ headers, body, webhookId })` would streamline secure webhook ingestion and reduce boilerplate.

Overall, the v2.5.0 SDK proved rock-solid throughout our development, property testing, and live sandbox transaction captures.
