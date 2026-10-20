# Tributary

> **Your revenue-share agreement, now executable.**  
> Built for the **PayPal AI Hackathon 2026**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x_ESM-green.svg)](https://nodejs.org/)
[![PayPal SDK](https://img.shields.io/badge/PayPal_SDK-v2.5.0-0070BA.svg)](https://github.com/paypal/paypal-server-sdk)
[![fast-check](https://img.shields.io/badge/fast--check-2%2C000_Property_Tests-emerald.svg)](https://fast-check.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

- **Live Hosted Application:** [https://tributary-bbaa.onrender.com/](https://tributary-bbaa.onrender.com/)
- **Demo Video (2:43):** [https://youtu.be/InOSmQz1ek4](https://youtu.be/InOSmQz1ek4)
- **GitHub Repository:** [https://github.com/Priyanshu-i/Tributary](https://github.com/Priyanshu-i/Tributary)

---

## The Problem

Revenue-share agreements power the modern creator, indie game, freelance, and startup economies. Yet in practice, they are trapped in ambiguous contracts and ad-hoc spreadsheets:
1. **Manual Math & Trust Friction:** Revenue calculations are handled by humans in spreadsheets weeks after sales occur, leading to delayed payouts, opaque deductions, and lost trust between collaborators.
2. **The Recoup & Tier Straddle Dilemma:** Deals frequently involve recoupment (e.g. Maya fronting $400 for art) followed by tiered revenue splits (e.g. 40/30/20/10 until $2,000 net, then 25/25/25/25). Single transactions that straddle boundary thresholds almost always cause calculation errors.
3. **The Refund Dilemma:** When a customer requests a $50 refund after payouts have already been disbursed, merchants have no automated way to claw back funds fairly without corrupting ledger balances.
4. **The LLM Math Risk:** Generative AI excels at parsing natural-language contract terms, but LLMs cannot perform exact financial arithmetic. Floating-point roundoffs and hallucinated numbers in financial transactions are catastrophic.

---

## The Tributary Solution

Tributary turns natural-language revenue-share agreements into **hash-chained, deterministic, automated payout execution** on PayPal.

```
+-----------------------------------------------------------------------------------+
|                                  USER / BROWSER                                   |
|       Modern Financial Dashboard: Deal Studio | Simulator | Ledger | Statements   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|               MODULAR BOUNDARY: UNTRUSTED AI vs. FINANCIAL CORE                   |
+-----------------------------------------------------------------------------------+
|       AI COMPILER MODULE         |           PURE INTEGER CORE ENGINE             |
|  (The AI module never imports    |      (Zero external dependencies, zero floats) |
|   PayPal code, never accesses    |  - Largest-remainder cent allocation           |
|   secrets, never computes money) |  - Upfront recoupment priority                 |
|  - Gemini 2.5 Flash (Temp: 0)    |  - Net tier straddling arithmetic              |
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
|  - Hash-Chained Audit Log: entry_hash = SHA256(prev_hash + ts + type + payload)   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                              PAYPAL LIVE GATEWAY                                  |
|  - Orders v2 & Captures v2 (@paypal/paypal-server-sdk v2.5.0)                     |
|  - Captures Refund v2 (@paypal/paypal-server-sdk v2.5.0)                          |
|  - Payouts v1 Batch Processing (Typed REST Client, SHA-256 idempotency)           |
|  - Calls PayPal's verify-webhook-signature endpoint                               |
+-----------------------------------------------------------------------------------+
```

---

## What Is Real vs. Simulated in the Demo

To ensure complete transparency during judging, the following table details the live execution versus seeded/simulated components:

| Component / Flow | Status | Implementation Details |
| :--- | :---: | :--- |
| **PayPal Sandbox OAuth2** | **Real** | Live OAuth2 bearer token exchange with `https://api-m.sandbox.paypal.com`. |
| **Orders v2 (Create & Capture)** | **Real** | `@paypal/paypal-server-sdk` v2.5.0 controller calls; captures live PayPal order ID (e.g. `6LD312294R5748537`). |
| **Payouts v1 (4-Way Batch)** | **Real** | Immediate sandbox disbursements to 4 personal accounts via REST API (`PTXTGF9R8CK94`). |
| **Payments v2 (Refund)** | **Real** | Captured payments refunded via `@paypal/paypal-server-sdk` `refundCapturedPayment`. |
| **Integer-Cent Waterfall** | **Real** | Pure integer arithmetic in [`src/core-engine/waterfall.ts`](./src/core-engine/waterfall.ts) with Largest-Remainder cent allocation. |
| **Audit Chain** | **Real** | SQLite hash-chained append-only event log (`entry_hash = SHA256(...)`). |
| **8-Scenario Chaos Harness** | **Simulated Locally** | In-process failure injection verifying idempotency, signature rejection, and invariant halts without network delays. |
| **Preset Recoup Seed ($370/$400)** | **Seeded** | Initial `$370.00 / $400.00` prior recoup state is seeded in the Moonlit preset (labeled `[SEEDED FROM STATE]` in UI) so the boundary-crossing sale can be tested immediately on click #1. |
| **Offline Replay Mode** | **Cached** | [`fixtures/replay-cache.json`](./fixtures/replay-cache.json) provides deterministic zero-key execution if API keys are absent or rate-limited. |

---

## 5 Architectural & Financial Invariants

1. **The AI Module Never Imports PayPal Code:**
   - The `ai-compiler` module never imports from `paypal-gateway`, never accesses PayPal client secrets, and never performs monetary math.
   - The AI only emits structured contract schemas (`DealSpec`).
2. **Integer-Cent Arithmetic Only (Zero Floats):**
   - Currency strings (e.g. `"100.02"`) are parsed via strict regex `/^(\d+)(?:\.(\d{1,2}))?$/` into exact integer cents (`10002`).
   - Every payout enforces the hard conservation invariant:
     $$\text{feeCents} + \text{reserveCents} + \sum \text{payoutCents} + \sum \text{carriedForwardCents} + \text{withheldRecoveryCents} \equiv \text{grossCents}$$
   - If this assertion fails by even 1 cent, the engine halts with `InvariantViolationError` and logs a tamper-evident halt event.
3. **Free Stack & Zero-Key Offline Replay:**
   - Runs on Node 22, SQLite, and pure TypeScript with zero paid SaaS dependencies.
   - Every compiler call is backed by an SHA-256 Record/Replay cache ([`fixtures/replay-cache.json`](./fixtures/replay-cache.json)). With `OFFLINE_REPLAY_ONLY="true"` or without API keys, the app runs 100% deterministically.
4. **Post-Payout Refund Clawback Engine:**
   - When a refund occurs post-payout, the engine drains available rolling reserve first.
   - Any remaining deficit is recorded as `recoveryDeficitCents` and automatically netted out against each payee's future sales.
5. **Strict Allowlist Number Verifier:**
   - Natural-language collaborator statements are generated by AI, but every cited dollar figure is extracted via regex and verified against an exact allowlist of numbers emitted by the deterministic engine trace. Hallucinated numbers trigger automatic rejection.

---

## 5-Command Quickstart Guide

### Prerequisites
- Node.js 20+ (Node 22 recommended)
- npm 10+

```bash
# 1. Clone the repository
git clone https://github.com/Priyanshu-i/Tributary.git
cd Tributary

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

## 1-Click Action Bar Walkthrough

Tributary includes a **1-Click Action Bar** at the top of the interface:

```
[Preset: Moonlit ($370/$400)]  ->  [Capture $100 Sale]  ->  [Refund $50]  ->  [Chaos Suite]
```

1. **Click `Preset: Moonlit ($370/$400)`:**
   - Loads Team Moonlit indie game revenue agreement.
   - Seeds Maya Lin at **$370.00 / $400.00** recouped for her upfront art expenditure.
2. **Click `Capture $100 Sale`:**
   - Executes a $100.00 sale (`10000` cents) with a $3.98 PayPal fee (`398` cents).
   - Net revenue: `$96.02` (`9602` cents).
   - 10% rolling reserve held: `$9.60` (`960` cents). Distributable pool: `$86.42` (`8642` cents).
   - **Maya's recoup completes:** exactly `$30.00` (`3000` cents) reimburses her remaining art cost (reaching $400.00 total).
   - **Remaining pool:** `$56.42` (`5642` cents) splits according to Tier 1 (40/30/20/10) via the largest-remainder cent rule:
     - **Maya Lin:** `$30.00` recoup + `$22.57` split = **`$52.57`** (`5257` cents)
     - **Arjun Rao (30%):** **`$16.93`** (`1693` cents)
     - **Lina Chen (20%):** **`$11.28`** (`1128` cents)
     - **Dev Patel (10%):** **`$5.64`** (`564` cents)
   - **Conservation Assertion:** `398 + 960 + 5257 + 1693 + 1128 + 564 === 10000`. Exact to the cent.
3. **Click `Refund $50`:**
   - Customer requests a $50.00 refund on the previous sale.
   - The `$9.60` reserve drains to `$0.00` first.
   - The remaining `$40.40` deficit is apportioned pro-rata across the 4 payees: **Maya `-$16.16` (40%), Arjun `-$12.12` (30%), Lina `-$8.08` (20%), and Dev `-$4.04` (10%)** and recorded in `recoveryDeficitCents`.
   - On subsequent sales, each payee's deficit is automatically netted before disbursement.
4. **Click `Chaos Suite`:**
   - Opens the 8-Test Failure Injection Drawer.
   - Simulates all 8 failure scenarios locally in-process, verifying idempotency, signature validation, and tamper-evident audit continuity.

---

## PayPal API Integration Matrix

| Capability | PayPal API Version | Implementation Architecture | Files |
| :--- | :--- | :--- | :--- |
| **Orders Creation** | Orders v2 (`POST /v2/checkout/orders`) | `@paypal/paypal-server-sdk` v2.5.0 (`ordersController.createOrder`) | [`./src/paypal-gateway/sdk-client.ts`](./src/paypal-gateway/sdk-client.ts) |
| **Order Capture** | Orders v2 (`POST /v2/checkout/orders/{id}/capture`) | `@paypal/paypal-server-sdk` v2.5.0 (`ordersController.captureOrder`) | [`./src/paypal-gateway/sdk-client.ts`](./src/paypal-gateway/sdk-client.ts) |
| **Capture Refund** | Payments v2 (`POST /v2/payments/captures/{id}/refund`) | `@paypal/paypal-server-sdk` v2.5.0 (`paymentsController.refundCapturedPayment`) | [`./src/paypal-gateway/sdk-client.ts`](./src/paypal-gateway/sdk-client.ts) |
| **Batch Payouts** | Payouts v1 (`POST /v1/payments/payouts`) | Typed HTTP REST Client with SHA-256 `sender_batch_id` | [`./src/paypal-gateway/payouts-rest.ts`](./src/paypal-gateway/payouts-rest.ts) |
| **Batch Inquiry** | Payouts v1 (`GET /v1/payments/payouts/{id}`) | Typed HTTP REST Client with poll status resolution | [`./src/paypal-gateway/payouts-rest.ts`](./src/paypal-gateway/payouts-rest.ts) |
| **Webhook Verification** | Webhooks v1 (`POST /v1/notifications/verify-webhook-signature`) | Calls PayPal's verify-webhook-signature endpoint | [`./src/paypal-gateway/webhook-receiver.ts`](./src/paypal-gateway/webhook-receiver.ts) |

---

## 8-Test Chaos Suite

Tributary includes an automated failure injection harness ([`src/paypal-gateway/chaos-harness.ts`](./src/paypal-gateway/chaos-harness.ts)) testing extreme payment edge-cases:

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

Tributary was evaluated against a test dataset of 16 commercial agreements ([`src/ai-compiler/eval-dataset.json`](./src/ai-compiler/eval-dataset.json)).

### Evaluation Results & Honest Pipeline Breakdown

| Evaluation Stage | Schema Validity | Basis-Point Conservation | Ambiguity Recall | Number-Verifier Catch Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Raw First-Pass LLM** | 93.8% (15/16) | 93.8% (15/16) | 93.8% (30/32) | — |
| **Post-Validator & Pipeline** | **100.0% (16/16)** | **100.0% (16/16)** | **100.0% (32/32)** | **100.0% (5/5)** |

- **First-Pass Raw LLM Output:** 15/16 agreements produced fully valid schemas on the first prompt pass (`agreement_16_vague_informal_agreement` triggered 1 automatic Zod validation retry due to an unnormalized basis-point split), and 30/32 raw ambiguity detection when evaluated without the deterministic rule pass.
- **Post-Validator & Neuro-Symbolic Pipeline:** 16/16 schemas strictly valid after the Zod repair loop, 100% basis-point conservation (exact 10,000 bps sum), 32/32 ambiguity clauses surfaced via deterministic checks, and 5/5 hallucinated currency probes rejected by the regex allowlist verifier.

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
