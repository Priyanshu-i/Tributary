# Tributary — APIMatic & PayPal Server SDK DevLog

## 1. SDK Architecture Matrix

| Capability | PayPal Domain | Integration Pattern | Implementation Details |
| :--- | :--- | :--- | :--- |
| **Order Creation** | Orders v2 | `@paypal/paypal-server-sdk` (v2.5.0) | `OrdersController.createOrder({ body: OrderRequest, paypalRequestId?: string })` with `intent: CheckoutPaymentIntent.Capture` and `customId: dealId` |
| **Order Capture** | Orders v2 | `@paypal/paypal-server-sdk` (v2.5.0) | `OrdersController.captureOrder({ id: string, paypalRequestId?: string })` for strict idempotency; extracts `sellerReceivableBreakdown` |
| **Capture Refund** | Payments v2 | `@paypal/paypal-server-sdk` (v2.5.0) | `PaymentsController.refundCapturedPayment({ captureId: string, paypalRequestId?: string, body?: RefundRequest })`; extracts `sellerPayableBreakdown` |
| **Batch Payouts** | Payouts v1 | Typed REST Client | `POST /v1/payments/payouts` with deterministic `sender_batch_id` hash; `GET /v1/payments/payouts/{id}` |
| **Payout Item Cancel** | Payouts v1 | Typed REST Client | `POST /v1/payments/payouts-item/{id}/cancel` |
| **Webhook Signature Verification** | Notifications v1 | Typed REST Client | `POST /v1/notifications/verify-webhook-signature` using `PAYPAL-TRANSMISSION-*` headers |

---

## 2. APIMatic SDK Observations & Method Signatures (Day 1 Sandbox Smoke Test Results)

### 2.1 Critical SDK Method Evolution (v0.6 vs v2.5.0)
During the Phase 0 Day-1 Smoke Test against the live PayPal sandbox, our inspection of `@paypal/paypal-server-sdk` v2.5.0 (APIMatic generated) revealed direct method renaming:
- **Orders:**
  - Old / legacy SDK: `ordersController.ordersCreate()`
  - APIMatic v2.5.0: `ordersController.createOrder({ body, paypalRequestId })`
  - Old / legacy SDK: `ordersController.ordersCapture()`
  - APIMatic v2.5.0: `ordersController.captureOrder({ id, paypalRequestId })`
  - Old / legacy SDK: `ordersController.ordersGet()`
  - APIMatic v2.5.0: `ordersController.getOrder({ id })`
- **Payments (Captures & Refunds):**
  - Old / legacy SDK: `paymentsController.capturesRefund()`
  - APIMatic v2.5.0: `paymentsController.refundCapturedPayment({ captureId, paypalRequestId, body })`
  - Old / legacy SDK: `paymentsController.capturesGet()`
  - APIMatic v2.5.0: `paymentsController.getCapturedPayment({ captureId })`

### 2.2 Live Sandbox Smoke Test Verification Log
- **OAuth2 Token Exchange:** `POST /v1/oauth2/token` succeeded with status 200.
- **Order Creation via SDK:** `OrdersController.createOrder` successfully issued a $100.00 order (HTTP 201, Order ID created).
- **Batch Payout Execution via REST:** `POST /v1/payments/payouts` with 4 recipients (Maya, Arjun, Lina, Dev) generated status 201 with `batch_status: "PENDING"`.
- **Webhook Verification:** `POST /v1/notifications/verify-webhook-signature` verified and functional (HTTP 200, returned `verification_status: "FAILURE"` for deliberate dummy test signature, confirming live verification connectivity).

### 2.3 Property Casing in SDK Objects vs Raw JSON
- REST API responses return snake_case (`seller_receivable_breakdown`, `paypal_fee`, `net_amount`, `gross_amount`).
- The APIMatic SDK models provide clean camelCase typings (`sellerReceivableBreakdown`, `paypalFee`, `netAmount`, `grossAmount`).
- Our gateway defensively normalizes both representations so that breakdown amounts are consistently parsed with `parseAmountToCents()`.

---

## 3. APIMatic Context & Developer Experience Notes
- **Strict Typing:** `OrdersController` strictly types `CheckoutPaymentIntent` enum values (`Capture`, `Authorize`), eliminating invalid intent bugs at compile time.
- **Header Injection:** `paypalRequestId` is an explicit parameter in `createOrder`, `captureOrder`, and `refundCapturedPayment`, ensuring idempotency without raw header tampering.
- **Error Handling:** APIMatic SDK throws `ApiError` instances containing structured HTTP response bodies and HTTP status codes, enabling clean classification for our Chaos Test runner.
