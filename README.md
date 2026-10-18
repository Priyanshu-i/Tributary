# Tributary

> **Your revenue-share agreement, now executable.**
> Built for the **PayPal AI Hackathon 2026**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x_ESM-green.svg)](https://nodejs.org/)
[![PayPal SDK](https://img.shields.io/badge/PayPal_SDK-v2.5.0-0070BA.svg)](https://github.com/paypal/paypal-server-sdk)
[![Tests](https://img.shields.io/badge/Vitest-49%2F49_Passed-brightgreen.svg)](https://vitest.dev/)
[![fast-check](https://img.shields.io/badge/fast--check-2%2C000_Property_Tests-emerald.svg)](https://fast-check.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## The Problem
Revenue-share agreements power the modern creator, indie game, freelance, and startup economies. Yet today, they are trapped in ambiguous PDF contracts:
1. **Manual Math & Trust Friction:** Revenue calculations are handled by humans in spreadsheets, leading to delayed payouts, opaque deductions, and lost trust between collaborators.
2. **The Recoup & Tier Straddle Dilemma:** Deals frequently involve recoupment (e.g. Maya fronting $400 for art) followed by tiered revenue splits (e.g. 40/30/20/10 until $2,000 net, then 25/25/25/25). Single transactions that straddle boundary thresholds almost always cause calculation errors.
3. **The Refund Nightmare:** When a customer requests a $50 refund after payouts have already been disbursed, merchants have no automated way to claw back funds fairly without corrupting ledger balances.
4. **The AI Hallucination Danger:** Generative AI is great at parsing contract language, but LLMs cannot do exact arithmetic. Floating-point roundoffs and hallucinated numbers in financial transactions are catastrophic.

---

## The Tributary Solution

Tributary turns natural-language revenue-share agreements into **cryptographically pinned, deterministic, automated payout machines** on PayPal.

```
+-----------------------------------------------------------------------------------+
|                                  USER / BROWSER                                   |
|   Google Cloud / Stripe FinOps Dashboard: Deal Studio | Simulator | Ledger | Statements |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         STRICT AIR-GAP ISOLATION BARRIER                          |
+-----------------------------------------------------------------------------------+
|       AI COMPILER MODULE         |           PURE INTEGER CORE ENGINE             |
|  (Never imports PayPal gateway   |      (Zero external dependencies, zero floats) |
|   Never accesses secrets         |  - Largest-remainder cent allocation           |
|   Never computes money)          |  - Upfront recoupment priority                 |
|  - Gemini Flash (Temp: 0)        |  - Net tier straddling arithmetic              |
|  - Contract AST extraction       |  - Rolling refund reserves (14-day holdback)   |
|  - Ambiguity clarification chips |  - Minimum payout carryovers                   |
|  - SHA-256 Record/Replay cache   |  - Hard Invariant: F + R + P + C + W === G     |
+----------------------------------+------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                    SQLITE 3-LAYER IDEMPOTENCY & AUDIT CHAIN                       |
|  - Layer 1: PayPal-Request-Id deterministic generation                            |
|  - Layer 2: sender_batch_id = 'trib_' + SHA256(saleId + ':' + dealHash)           |
|  - Layer 3: Webhook deduplication table (PRIMARY KEY event_id)                    |
|  - Cryptographic Hash Chain: entry_hash = SHA256(prev_hash + ts + type + payload) |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                              PAYPAL LIVE GATEWAY                                  |
|  - Orders v2 & Captures v2 (@paypal/paypal-server-sdk v2.5.0)                     |
|  - Captures Refund v2 (@paypal/paypal-server-sdk v2.5.0)                          |
|  - Payouts v1 Batch Processing (Typed REST Client, SHA-256 idempotency)           |
|  - Webhook Signature Verification v1 (POST /v1/notifications/verify-webhook)      |
+-----------------------------------------------------------------------------------+
```

---

## 5 Architectural & Financial Invariants

1. **Strict Air-Gap Between AI and Money:**
   - The `ai-compiler` module NEVER imports from `paypal-gateway`, NEVER accesses PayPal client secrets, and NEVER performs monetary math.
   - The AI only emits structured contract schemas (`DealSpec`).
2. **Integer-Cent Arithmetic Only (Zero Floats):**
   - Currency strings (e.g. `"100.02"`) are parsed via strict regex `/^(\d+)(?:\.(\d{1,2}))?$/` into exact integer cents (`10002`).
   - Every payout enforces the hard conservation invariant:
     $$\text{feeCents} + \text{reserveCents} + \sum \text{payoutCents} + \sum \text{carriedForwardCents} + \text{withheldRecoveryCents} \equiv \text{grossCents}$$
   - If this assertion fails by even 1 cent, the engine halts with `InvariantViolationError` and logs a tamper-evident halt event.
3. **100% Free Stack & Zero-Key Offline Replay:**
   - Runs on Node 22, SQLite, and pure TypeScript with zero paid SaaS dependencies.
   - Every compiler call is backed by an SHA-256 Record/Replay cache (`fixtures/replay-cache.json`). With `OFFLINE_REPLAY_ONLY="true"` or without API keys, the app runs 100% deterministically.
4. **Post-Payout Refund Clawback Engine:**
   - When a refund occurs post-payout, the engine drains available rolling reserve first.
   - Any remaining deficit is recorded as `recoveryDeficitCents` and automatically netted out against each payee's future sales.
5. **Strict Allowlist Number Verifier:**
   - Natural-language collaborator statements are generated by AI, but every cited dollar amount is extracted via regex and verified against an exact allowlist of numbers emitted by the deterministic engine trace. Hallucinated numbers trigger automatic rejection.

---

## 5-Command Quickstart Guide

### Prerequisites
- Node.js 20+ (Node 22 recommended)
- npm 10+

```bash
# 1. Clone the repository
git clone https://github.com/priyanshusingh4321/tributary.git
cd tributary

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Build frontend and compile TypeScript
npm run build

# 5. Start both backend API (:3001) and Vite UI (:5173) concurrently
npm run dev
```

Open **`http://localhost:5173`** in your browser. The top navigation bar will show a green pulsing dot: **`API Connected (:3001)`**.

---

## 1-Click Judge Walkthrough (The Demo Climax)

Tributary includes a **1-Click Judge Action Bar** at the top of the interface:

```
[Preset: Moonlit ($370/$400)]  ->  [Capture $100 Sale]  ->  [Refund $50]  ->  [Chaos Suite]
```

1. **Click `Preset: Moonlit ($370/$400)`:**
   - Instantly loads Team Moonlit indie game revenue agreement.
   - Seeds Maya Lin at **$370.00 / $400.00** recouped for her upfront art expenditure.
2. **Click `Capture $100 Sale` (The Hackathon Climax):**
   - Executes a $100.00 sale (`10000` cents) with a $3.98 PayPal fee (`398` cents).
   - Net revenue: `$96.02` (`9602` cents).
   - 10% rolling reserve held: `$9.60` (`960` cents). Distributable pool: `$86.42` (`8642` cents).
   - **Maya's recoup completes:** exactly `$30.00` (`3000` cents) reimburses her remaining art cost (reaching $400.00 total).
   - **Remaining pool:** `$56.42` (`5642` cents) splits according to Tier 1 (40/30/20/10) via the largest-remainder cent rule:
     - **Maya Lin:** `$30.00` recoup + `$22.57` split = **`$52.57`** (`5257` cents)
     - **Arjun Rao (30%):** **`$16.93`** (`1693` cents)
     - **Lina Chen (20%):** **`$11.28`** (`1128` cents)
     - **Dev Patel (10%):** **`$5.64`** (`564` cents)
   - **Conservation Assertion:** `398 + 960 + 5257 + 1693 + 1128 + 564 === 10000`. Exact to the cent!
3. **Click `Refund $50`:**
   - Customer requests a $50.00 refund on the previous sale.
   - The `$9.60` reserve drains to `$0.00` first.
   - The remaining `$40.40` deficit is apportioned pro-rata (Maya $24.58, Arjun $7.91, Lina $5.27, Dev $2.64) and recorded in `recoveryDeficitCents`.
   - On the subsequent sale, each payee's deficit is automatically netted before disbursement.
4. **Click `Chaos Suite`:**
   - Opens the 8-Test Failure Injection Drawer.
   - Runs all 8 production chaos tests in <50ms, proving idempotency, signature validation, and tamper-evident audit continuity.

---

## PayPal API Integration Matrix

| Capability | PayPal API Version | Implementation Architecture | Files |
| :--- | :--- | :--- | :--- |
| **Orders Creation** | Orders v2 (`POST /v2/checkout/orders`) | `@paypal/paypal-server-sdk` v2.5.0 (`ordersController.createOrder`) | [`src/paypal-gateway/sdk-client.ts`](file:///c:/Users/PRIYANSHU%20SINGH/Desktop/ProjectPrep/Tributary/src/paypal-gateway/sdk-client.ts) |
| **Order Capture** | Orders v2 (`POST /v2/checkout/orders/{id}/capture`) | `@paypal/paypal-server-sdk` v2.5.0 (`ordersController.captureOrder`) | [`src/paypal-gateway/sdk-client.ts`](file:///c:/Users/PRIYANSHU%20SINGH/Desktop/ProjectPrep/Tributary/src/paypal-gateway/sdk-client.ts) |
| **Capture Refund** | Payments v2 (`POST /v2/payments/captures/{id}/refund`) | `@paypal/paypal-server-sdk` v2.5.0 (`paymentsController.refundCapturedPayment`) | [`src/paypal-gateway/sdk-client.ts`](file:///c:/Users/PRIYANSHU%20SINGH/Desktop/ProjectPrep/Tributary/src/paypal-gateway/sdk-client.ts) |
| **Batch Payouts** | Payouts v1 (`POST /v1/payments/payouts`) | Typed HTTP REST Client with SHA-256 `sender_batch_id` | [`src/paypal-gateway/payouts-rest.ts`](file:///c:/Users/PRIYANSHU%20SINGH/Desktop/ProjectPrep/Tributary/src/paypal-gateway/payouts-rest.ts) |
| **Batch Inquiry** | Payouts v1 (`GET /v1/payments/payouts/{id}`) | Typed HTTP REST Client with poll status resolution | [`src/paypal-gateway/payouts-rest.ts`](file:///c:/Users/PRIYANSHU%20SINGH/Desktop/ProjectPrep/Tributary/src/paypal-gateway/payouts-rest.ts) |
| **Webhook Verification** | Webhooks v1 (`POST /v1/notifications/verify-webhook-signature`) | Typed HTTP REST Client checking HMAC/RSA headers | [`src/paypal-gateway/webhook-receiver.ts`](file:///c:/Users/PRIYANSHU%20SINGH/Desktop/ProjectPrep/Tributary/src/paypal-gateway/webhook-receiver.ts) |

---

## 8-Test Chaos Suite (Section 11)

Tributary includes an automated failure injection harness (`src/paypal-gateway/chaos-harness.ts`) testing extreme payment edge-cases:

| Test # | Chaos Scenario | Injected Failure | Result |
| :---: | :--- | :--- | :---: |
| **#1** | Duplicate Webhook Delivery | Same `event_id` delivered twice | **PASS** (Zero duplicate mutation) |
| **#2** | Tampered Webhook Signature | Invalid `transmission-sig` header | **PASS** (Rejected signature, audit entry) |
| **#3** | Out-of-Order Refund Before Capture | Refund webhook arrives before capture webhook | **PASS** (Queued until capture arrives) |
| **#4** | Replayed Payout Request | Exact same `(saleId, dealHash)` re-executed | **PASS** (Blocked by SQLite UNIQUE constraint) |
| **#5** | Payout Item Unclaimed / Returned | PayPal payee email unclaimed after 30 days | **PASS** (Returned cents credited to ledger) |
| **#6** | Order vs. Capture Amount Mismatch | Order expects $100.00, capture reports $10.00 | **PASS** (Halted with `INVARIANT_HALT`) |
| **#7** | Concurrent Double-Click on Capture | 2 identical capture requests in parallel | **PASS** (1 succeeds, 1 deduplicated) |
| **#8** | Deliberate Invariant Violation | Forced 1-cent artificial discrepancy | **PASS** (Halted, unbroken audit chain) |

Run the suite anytime in terminal:
```bash
npx vitest run src/paypal-gateway/__tests__/chaos.test.ts
```

---

## 16-Agreement Neuro-Symbolic Compiler Eval

Tributary was evaluated against a rigorous test dataset of 16 complex commercial agreements ([`src/ai-compiler/eval-dataset.json`](file:///c:/Users/PRIYANSHU%20SINGH/Desktop/ProjectPrep/Tributary/src/ai-compiler/eval-dataset.json)):

```text
===========================================================
📊 TRIBUTARY: 16-Agreement Neuro-Symbolic AI Eval Harness
===========================================================
Schema Validity:            100.0% (16/16)
Basis-Point Conservation:   100.0% (16/16)
Ambiguity Recall:           100.0% (32/32)
Number-Verifier Catch Rate: 100.0% (5/5)
===========================================================
```

Run the compiler evaluation harness:
```bash
npm run eval:compile
```

---

## Automated Test Suites

```bash
# Run all 49 tests across 6 suites
npm test

# Run strict typecheck across all files
npm run typecheck

# Production Vite build
npm run build
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
