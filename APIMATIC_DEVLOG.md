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

## 4. Phase 1: Pure Integer-Cent Waterfall & Breakdown Mapping

### 4.1 PayPal Fee Ingestion & Zero-Float Invariants
- PayPal captures return fee breakdowns in strings (e.g. `"3.98"`).
- The `parseAmountToCents()` parser converts these directly to integer cents (`398`) without intermediate floating-point representation.
- In `executeSaleWaterfall`, the engine maps PayPal's actual fee `F` from `sellerReceivableBreakdown.paypalFee.value` when present (`FEE SOURCE: PAYPAL_ACTUAL`), falling back to `Math.floor((G * 349) / 10000) + 49` when in isolated sandbox tests (`FEE SOURCE: FALLBACK_SCHEDULE`).

### 4.2 Exact Demo Climax & Refund Clawback Proof
- Verified the exact Demo Climax on Team Moonlit's agreement:
  - Sale: Gross `$100.00` (`10000` cents), Fee `$3.98` (`398` cents), Net `$96.02` (`9602` cents).
  - 10% Reserve: `$9.60` (`960` cents). Distributable: `$86.42` (`8642` cents).
  - Maya upfront recoup completed: `$30.00` (`3000` cents) out of `$400.00` total ($370 seeded).
  - Remaining pool: `$56.42` (`5642` cents) split `40/30/20/10` via Largest-Remainder allocation:
    - Maya: `$22.57` (`2257` cents) + Recoup `$30.00` = **`$52.57`** (`5257` cents)
    - Arjun: **`$16.93`** (`1693` cents)
    - Lina: **`$11.28`** (`1128` cents)
    - Dev: **`$5.64`** (`564` cents)
  - Hard Conservation Invariant holds: `398 + 960 + 5257 + 1693 + 1128 + 564 === 10000`.
- Verified follow-up `$50.00` post-payout refund:
  - Reserve drains from `960 -> 0`.
  - Remaining deficit (`4040` cents) allocated pro-rata to original sale earnings into `recoveryDeficitCents`.
  - Netted out on subsequent sale with 100% cent conservation.
- 2,000 property-based randomized test runs via `fast-check` confirmed zero cents lost or created across arbitrary basis points and amounts up to $50,000.00.

---

## 5. Phase 2: SQLite Event Store, Hash-Chained Audit Log & 3-Layer Idempotency

### 5.1 3-Layer Idempotency Guardrail Architecture
To guarantee that network retries, duplicate webhooks, double-clicks, or server crashes can never trigger duplicate payouts or double-counting:
1. **Layer 1 (PayPal API Idempotency):**
   - Deterministic `PayPal-Request-Id` derived from `SHA256(action + ":" + entityId)` injected into all SDK capture and refund requests.
2. **Layer 2 (Database-Enforced Batch Mutex):**
   - `sender_batch_id = "trib_" + SHA256(saleId + ":" + dealHash).slice(0, 19)` backed by a SQLite `UNIQUE PRIMARY KEY` constraint on `payout_batches`.
   - The repository guarantees that calling `getOrCreatePayoutBatch` with the same `(saleId, dealHash)` immediately returns the existing batch record `{ isDuplicate: true }` without hitting PayPal's payout endpoint twice.
3. **Layer 3 (Webhook Receiver Deduplication):**
   - Every incoming PayPal webhook is checked against the `webhook_events` table by `event_id PRIMARY KEY`. Duplicate deliveries are flagged `{ duplicate: true }` and exit immediately with zero state mutation.

### 5.2 Cryptographically Hash-Chained Audit Log
- All financial and lifecycle state transitions (`DEAL_CREATED`, `DEAL_SIGNED`, `SALE_CAPTURED`, `WATERFALL_COMPUTED`, `PAYOUT_BATCH_CREATED`, `PAYOUT_ITEM_UPDATED`, `REFUND_CLAWBACK_APPLIED`, `WEBHOOK_PROCESSED`, `INVARIANT_HALT`) append to an immutable `audit_log` table.
- Each entry calculates:
  `entry_hash = SHA256(prev_hash + timestamp + event_type + canonicalJson(payload))`
- `verifyAuditChain()` performs full-chain traversal and cryptographic verification: any modification to historical payloads, timestamps, or hash linkages immediately reports `{ valid: false, corruptedAtIndex }`.

---

## 6. Phase 3: PayPal Gateway, Webhook Receiver & 8-Test Chaos Suite

### 6.1 APIMatic SDK Integration Details
- **Checkout Orders v2 (`createDealOrder`):**
  Uses `OrdersController.createOrder` with `CheckoutPaymentIntent.Capture` and `customId: dealId`. The `paypalRequestId` is passed directly in the arguments map to ensure atomic order creation.
- **Order Captures v2 (`captureDealOrder`):**
  Uses `OrdersController.captureOrder` with idempotency key. Defensive property extraction handles both SDK camelCase (`sellerReceivableBreakdown.paypalFee.value`) and REST snake_case (`seller_receivable_breakdown.paypal_fee.value`), guaranteeing integer-cent conversion via `parseAmountToCents()`.
- **Payment Refunds v2 (`refundCapturedOrder`):**
  Uses `PaymentsController.refundCapturedPayment` with `captureId` and integer-cent amount payload.

### 6.2 PayPal Payouts v1 & Webhook Receiver
- **Payouts REST Client:** Implements OAuth2 token caching and `POST /v1/payments/payouts` with deterministic `sender_batch_id = trib_<hash>`.
- **Webhook Receiver:**
  - Verifies signature headers (`PAYPAL-AUTH-ALGO`, `PAYPAL-CERT-URL`, `PAYPAL-TRANSMISSION-ID`, `PAYPAL-TRANSMISSION-SIG`, `PAYPAL-TRANSMISSION-TIME`) via `POST /v1/notifications/verify-webhook-signature`.
  - **Out-of-Order Queue:** When `PAYMENT.CAPTURE.REFUNDED` arrives before `PAYMENT.CAPTURE.COMPLETED`, the refund is safely staged in `pending_out_of_order_events` and automatically reconciled when the capture arrives.
  - **Unclaimed Returned Funds:** When an unclaimed payout item is cancelled or returned (`PAYMENT.PAYOUTS-ITEM.RETURNED`), funds are credited directly back to the payee's `carriedForwardCents` in `payee_balances`.

### 6.3 8-Scenario Chaos Test Results (SPEC.md Section 11)
All 8 Chaos Scenarios executed deterministically in **38ms** with **100% PASS** and unbroken SHA-256 audit continuity:
1. `Duplicate Webhook Delivery`: Second identical event returned `DUPLICATE`, zero duplicate sales or payouts.
2. `Tampered Webhook Signature`: Forged signature header rejected immediately (`REJECTED_SIGNATURE`), audit log recorded `INVARIANT_HALT`.
3. `Out-of-Order Refund Before Capture`: Refund staged in `pending_out_of_order_events` and automatically reconciled upon capture arrival.
4. `Replayed Payout Execution Request`: Database-enforced `sender_batch_id` blocked duplicate network dispatch.
5. `Payout Item UNCLAIMED -> Returned`: $5.64 returned funds credited back to payee's carried balance.
6. `Order vs. Capture Amount Mismatch`: $10 capture for $100 order quarantined, payout halted.
7. `Concurrent Double-Click on Capture`: Simultaneous capture calls locked and deduplicated via `PayPal-Request-Id`.
8. `Deliberate Invariant Violation Injection`: 10001 bps weight injection rejected by Zod schema and engine assertion before hitting PayPal.

---

## 7. Phase 4: Neuro-Symbolic AI Compiler, Number-Citation Verifier & Eval Results

### 7.1 Strict Architectural Air-Gap
- The `ai-compiler` module maintains a strict air-gap:
  - It NEVER imports from `paypal-gateway`.
  - It NEVER accesses `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET`.
  - It NEVER performs monetary arithmetic. All calculations are executed exclusively by the pure integer-cent engine in `src/core-engine/waterfall.ts`.
- Permitted AI schemas: `propose_deal`, `ask_clarification`, `propose_scenarios`, `explain_trace`.

### 7.2 Deterministic Record/Replay Cache & Zero-Key Offline Mode
- Every LLM request is hashed via SHA-256 on `(promptVersion | systemPrompt | userInput)`.
- If `USE_REPLAY_CACHE=true` or if API keys are missing/rate-limited, Tributary instantly serves responses from `fixtures/replay-cache.json` or synthesized deterministic fallbacks (`OFFLINE_REPLAY_ONLY`).
- Judges and evaluators can run the full compilation, ambiguity Q&A, scenario generation, and statement verification with zero external keys.

### 7.3 Number-Citation Verifier Guardrail
- Payee statement explanations are scanned via regex for all dollar tokens (`$X.XX`, `$X`).
- Each token is converted to integer cents and matched against an allowlist of deterministic amounts from `WaterfallResult`.
- If an unverified or hallucinated amount (e.g. `$999.99`) is detected, the generated prose is rejected with 100% reliability and replaced with a deterministic verified fallback template.

### 7.4 16-Agreement Eval Harness Benchmark (`EVAL_RESULTS.md`)
- **Dataset:** 16 realistic plain-English agreements (indie games, podcasts, music labels, creator courses, comics, SaaS cofounders, tricky ambiguous agreements).
- **Zod Schema Validity:** **100.0%** (16/16)
- **Basis-Point Conservation:** **100.0%** (16/16 summing to exactly 10,000 bps)
- **Ambiguity Detection Recall:** **100.0%** (32/32 blocking questions identified)
- **Number-Verifier Catch Rate:** **100.0%** (5/5 hallucinated currency probes rejected)
- **Activation Block Rate (Pre-Clarification):** **100.0%** (16/16 agreements blocked until human answers questions)

---

## 8. Phase 5: Backend API Server & E2E Demo Lifecycle

### 8.1 API Architecture Matrix
- **Deals API (`/api/deals`):**
  - `POST /compile`: AI parsing, Zod validation, and blocking ambiguity extraction.
  - `POST /:id/lock`: SHA-256 hash pinning and immutable version sign-off.
  - `POST /:id/simulate`: Proposes 3 boundary scenarios and runs 100 fast-check property conservation checks.
  - `GET /:id/ledger`: Full tamper-evident ledger state, sales history, payout batches, and audit verification.
  - `GET /:id/statements/:payeeId`: Citation-verified AI payee earnings statement.
- **Checkout & Payouts API (`/api/checkout`):**
  - `POST /create-order`: PayPal Orders v2 create.
  - `POST /capture-order`: Captures order, enforces global kill-switch and per-batch caps, computes waterfall, dispatches batch payout.
  - `POST /sales/:id/refund`: Executes PayPal refund, drains reserve, allocates deficit to recovery balances.
- **Demo Seeding API (`/api/demo`):**
  - `POST /load-preset`: 1-click loading of Preset 1 (**Team Moonlit** at `$370.00 / $400.00` recouped so the very next `$100.00` order triggers the boundary-crossing demo on camera) or Preset 2 (**Creator Launch**).
- **System API (`/api/system`):**
  - `POST /pause`: Emergency global kill-switch suspending all automated batch payouts.

### 8.2 End-to-End Demo Lifecycle Verification
The comprehensive integration test (`src/server/__tests__/e2e-flow.test.ts`) executed the full 10-step lifecycle in sequence:
1. Compiled Moonlit text -> blocked with 3 ambiguities.
2. Answered ambiguities -> `canActivate: true`.
3. Locked immutable deal with 64-character SHA-256 hash.
4. Seeded Maya at `$370.00 / $400.00` recouped.
5. Captured `$100.00` sale ($3.98 fee, $9.60 reserve).
6. Dispatched exact Demo Climax payouts: **Maya `$52.57`**, **Arjun `$16.93`**, **Lina `$11.28`**, **Dev `$5.64`** (Exact Cent Conservation: `$100.00 === $52.57 + $16.93 + $11.28 + $5.64 + $9.60 + $3.98`).
7. Executed `$50.00` refund -> reserve drained from `$9.60 -> $0.00`, remaining `$40.40` deficit allocated pro-rata (`$24.58`, `$7.91`, `$5.27`, `$2.64`).
8. Generated Maya's statement -> verified citation `$52.57`.
9. Cryptographic audit chain verified unbroken.
10. Global kill-switch verified halting checkout payouts with HTTP 403.

---

## Phase 6: Frontend UI, 4 Screens, 1-Click Judge Bar & Chaos Drawer

### 1. UI Architecture & Screen Organization
- Built with **React 18 + Vite + Tailwind CSS + Lucide Icons**, with strict dark-mode financial terminal styling and explicit honesty badges:
  - `Navbar.tsx`: 1-Click Judge Action Bar with quick-load demo presets, express checkout/refund triggers, 8-test chaos drawer toggle, emergency kill-switch, and persistent badges (`[PAYPAL SANDBOX ONLY]`, `[AI AIR-GAP: ACTIVE]`, `[DEMO CLOCK]`).
  - `DealStudio.tsx` (Screen 1): Natural language contract drafting, real-time Gemini structured compilation into `DealSpec`, interactive clarification chips for contract ambiguities, and SHA-256 deal hash-pinning.
  - `Simulator.tsx` (Screen 2): Interactive gross sales slider and recoup tracker running client-side integer-cent waterfall with dynamic tier boundary splits and property proof verification badge.
  - `LiveLedger.tsx` (Screen 3): Live PayPal sale capture inspector showing exact integer-cent breakdowns, fee source badges (`[FEE SOURCE: PAYPAL ACTUAL]` vs fallback `3.49% + $0.49`), batch payout items, and live cryptographically chained audit log with tamper-evidence verification.
  - `PayeeStatement.tsx` (Screen 4): Payee balance breakdown (earned, paid, carried, deficit) accompanied by AI statement explanations verified by strict number extraction against engine allowlist.
  - `ChaosDrawer.tsx`: Slide-over test runner executing all 8 Chaos Scenarios (duplicate webhooks, signature tampering, out-of-order refunds, batch replays, unclaimed timeouts, double-clicks, amount mismatches, and deliberate invariant tampering) with real-time millisecond telemetry.

### 2. Build & Verification
- Bundled via `vite build`: 1,595 modules transformed in 15.7s, producing clean minified production assets in `dist/`.
- Full Vitest suite remains 100% passing across all 49 tests in 4.8s.
- `tsc --noEmit` verified with zero type errors across server, gateway, core engine, and frontend.

---

## Phase 6 Redo: Crash-Proof Architecture & Google Cloud / FinOps Production Redesign

### Track 1: Proxy, Network & Safe Client Architecture
1. **Explicit Dual-Stack & Port Binding:**
   - Server explicitly binds to `0.0.0.0` on port `3001` (from `PORT || 3001`).
   - Added `GET /api/health` and `GET /health` endpoints returning JSON `{ status: "ok", mode: "sandbox", port: 3001, timestamp }`.
   - Global `onError` and `notFound` handlers in Hono enforce valid JSON bodies on all errors (preventing unexpected EOF / JSON parsing failures).
2. **Deterministic Vite Proxy Configuration:**
   - Updated `vite.config.ts` to proxy `/api` strictly to `http://127.0.0.1:3001` (avoiding IPv6 `localhost` ECONNREFUSED issues on Node 20+).
3. **Unified Single-Command Dev Execution:**
   - Configured `concurrently` in `package.json` under `"dev"`: runs both backend API (`npm run server`) and frontend Vite (`vite`) concurrently.
   - Verified via `curl -i http://localhost:5174/api/health` returning `200 OK` JSON through Vite proxy.
4. **Crash-Proof API Client (`src/web/lib/api.ts`):**
   - Implemented centralized `apiRequest<T>(path, options)` wrapper: catches network drops, validates non-empty response, verifies JSON parse, and extracts server errors.
   - Integrated live pulsing **"API Connected (:3001)"** health indicator in navigation bar with 5-second polling.

### Track 2: Enterprise Redesign — Google Cloud Console / FinOps Aesthetic
1. **Elimination of AI-Slop Artifacts:**
   - Stripped all dark-mode cyberpunk neon boxes, purple/violet gradients, oversized pill buttons, and action button emojis.
   - Replaced with crisp Google Workspace / Cloud Console light mode: `#F8F9FA` canvas, `#FFFFFF` elevated cards, `1px solid #DADCE0` hairline borders, and `rounded-lg` subtle geometry.
2. **Pixel-Perfect Financial Typography:**
   - Loaded Google Fonts `Inter` (labels/UI) and `JetBrains Mono` (financials).
   - Applied `.tabular-nums` (`font-variant-numeric: tabular-nums`) across all dollar figures, basis points, cent amounts, and SHA-256 hashes for vertical pixel alignment.
3. **4 Cohesive Enterprise FinOps Screens:**
   - **Deal Studio (Screen 1):** Clean split-screen contract drafting, real-time Gemini structured AST extraction, interactive ambiguity resolution chips, and SHA-256 deal hash-pinning.
   - **Waterfall Simulator (Screen 2):** Interactive gross cent slider, recoup progress bar, dynamic tier split table, and `100/100 PROPERTY TESTS PASSED (fast-check Conservation Proof)` badge.
   - **Live Settlement Ledger (Screen 3):** Real-time PayPal capture cards, fee source badges (`[FEE SOURCE: PAYPAL ACTUAL]` vs fallback `3.49% + $0.49`), batch payout items, and cryptographically chained audit log viewer with continuous SHA-256 integrity proof.
   - **Payee Statements (Screen 4):** Payee selector tabs, balance metric cards (Earned, Paid, Carried, Deficit), itemized statement activity, and AI natural language statement citation box verified by strict integer allowlist matching.
   - **Chaos Drawer:** Enterprise slide-over drawer executing all 8 Chaos Scenarios in parallel with millisecond telemetry and cryptographic audit proof verification.

