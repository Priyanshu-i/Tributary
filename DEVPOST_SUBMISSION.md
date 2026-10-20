# Tributary — Devpost Hackathon Submission Package

**Project Name:** Tributary: Your revenue-share agreement, now executable  
**Tagline:** Turn ambiguous revenue-share agreements into hash-chained, integer-cent executable payout machines on PayPal.  
**Hackathon:** PayPal AI Hackathon 2026  
**Repository:** https://github.com/Priyanshu-i/Tributary  
**Hosted Demo:** https://tributary-bbaa.onrender.com/  
**Demo Video:** https://youtu.be/InOSmQz1ek4  

---

## 1. Project Overview & Inspiration

### Inspiration
Revenue-share agreements power the creative, independent, and tech economies. Whether it is an indie game studio splitting Steam sales, a podcast network dividing sponsorships, creators launching courses with marketing partners, or developers subcontracting on client projects, revenue-sharing aligns incentives without requiring upfront capital.

Yet in practice, **revenue-sharing is fragile and error-prone:**
- **The Spreadsheet Trap:** Payout calculations are done manually in spreadsheets weeks or months after sales occur. Collaborators rarely have visibility into how deductions were calculated.
- **The Recoup & Tier Straddle Problem:** Agreements commonly state: *"Maya fronted a $400 art cost and is repaid first. Then revenue splits 40/30/20/10 until $2,000 net, after which it splits an even 25% each."* When a single sale straddles a recoup or tier boundary, spreadsheet math frequently breaks.
- **The Post-Payout Refund Dilemma:** What happens when a customer requests a $50 refund after collaborator payouts have already been deposited? In traditional setups, the merchant absorbs the loss or attempts awkward manual clawbacks.
- **The LLM Math Risk:** While Large Language Models excel at understanding contract language, **LLMs cannot perform exact financial arithmetic.** Floating-point approximations and hallucinated numbers in financial transactions break trust and violate financial consistency.

I built **Tributary** to solve this with a **neuro-symbolic design**: an LLM parses plain-English contract terms and identifies latent ambiguities; but a pure, deterministic integer-cent engine handles 100% of the financial math, backed by SQLite 3-layer idempotency, PayPal Orders v2, and PayPal Payouts v1.

---

## 2. What It Does

Tributary is a complete revenue settlement platform organized across four screens:

### Screen 1: Deal Studio (Contract Compilation & Ambiguity Interrogation)
- **Natural Language Drafting:** Paste any plain-English agreement (e.g. *"Maya gets $400 art cost back first, then 40/30/20/10 split until $2,000 net..."*).
- **Structured Schema Extraction:** Google Gemini 2.5 Flash extracts payees, basis-point weights, recoupment rules, reserve holdbacks, and payout thresholds into a strictly validated `DealSpec` schema.
- **Interactive Ambiguity Resolution:** Tributary highlights latent contract ambiguities (e.g. *Is Maya's $400 recoup calculated before or after PayPal's 3.49% + $0.49 fee?*). Users resolve them with interactive chips before signing.
- **Deal Hash Pinning:** Upon confirmation, the agreement terms are hashed via SHA-256 and locked immutably. Settlements can only execute against this cryptographic digest.

### Screen 2: Waterfall Simulator & Property-Based Prover
- **What-If Sandbox:** An interactive gross sale slider and recoupment tracker running client-side integer-cent waterfall calculations in real-time.
- **Visual Remainder Allocation:** Explains how fractional cents are awarded deterministically using the Largest-Remainder (Hamilton) method.
- **Property Conservation Proof:** Executes 100 randomized property tests via `fast-check` to prove that not a single cent is created or lost across random sales volumes ($1 to $50,000).

### Screen 3: Live Settlement Ledger (Orders v2 + Payouts v1)
- **Live PayPal Capture:** Connects directly to PayPal Orders v2 (`@paypal/paypal-server-sdk` v2.5.0) to capture customer checkouts.
- **Transparent Fee Attribution:** Explicitly badges whether payment processing fees were derived from live PayPal breakdowns (`[FEE SOURCE: PAYPAL ACTUAL]`) or standard fallback schedules (`[FEE SOURCE: FALLBACK 3.49% + $0.49]`).
- **Immediate Batch Payouts:** Dispatches batch payout instructions via PayPal Payouts v1 to all collaborator personal accounts (`sender_batch_id` protected by SQLite `UNIQUE` constraints).
- **Post-Payout Refund Clawback Engine:** When refunds occur post-payout, the engine drains rolling reserves first, calculates remaining deficits pro-rata, and automatically nets out deficits on future sales.
- **Hash-Chained Audit Log:** Every state transition (`DEAL_SIGNED`, `SALE_CAPTURED`, `WATERFALL_COMPUTED`, `PAYOUT_BATCH_CREATED`, `REFUND_CLAWBACK_APPLIED`) appends to an SHA-256 hash-chain (`entry_hash = SHA256(prev_hash + timestamp + event_type + canonicalJson(payload))`), providing a continuous audit log.

### Screen 4: Payee Statements & Strict Number Verifier
- **Itemized Collaborator Portals:** Individual payee balances tracking Total Earned, Total Paid via PayPal, Carried Forward Balance, and Recovery Deficits.
- **Citation-Verified Explanations:** Gemini produces natural-language explanations of collaborator statements. A **Strict Allowlist Number Verifier** extracts every currency string via regex and validates it against the deterministic engine trace allowlist. Any number not present in the engine trace is intercepted and rejected.

### 8-Test Chaos Drawer (Automated Failure Injection)
- Slide-over test runner executing 8 payment failure scenarios (duplicate webhooks, signature tampering, out-of-order refunds, batch replays, unclaimed timeouts, concurrent double-clicks, and deliberate 1-cent invariant tampering) simulated locally in-process with continuous audit verification.

---

## 3. How I Built It

Tributary was designed around **5 Core Invariants:**

### 1. The AI Module Never Imports PayPal Code
The `ai-compiler` module is strictly separated from financial execution:
- It **never** imports from `paypal-gateway`.
- It **never** accesses `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET`.
- It **never** computes money or balances.
- It is limited to structured contract schema extraction.

### 2. Pure Integer-Cent Financial Core
- Zero floating-point arithmetic. All monetary strings (`"100.02"`) are parsed via strict regex `/^(\d+)(?:\.(\d{1,2}))?$/` into exact integer cents (`10002`).
- Every execution enforces the hard conservation invariant:
  $$\text{feeCents} + \text{reserveCents} + \sum \text{payoutCents} + \sum \text{carriedForwardCents} + \text{withheldRecoveryCents} \equiv \text{grossCents}$$
- If this equation fails by even 1 cent, the engine halts with `InvariantViolationError` and records an immutable halt event in the audit log.

### 3. 3-Layer Idempotency Architecture
- **Layer 1 (Transport):** Deterministic `PayPal-Request-Id` headers for all capture and refund calls.
- **Layer 2 (Database):** `sender_batch_id = "trib_" + SHA256(saleId + ":" + dealHash).slice(0, 19)` enforced by SQLite `UNIQUE` constraints before network calls.
- **Layer 3 (Webhook):** Dedicated `webhook_events` table with `event_id PRIMARY KEY` deduplication prior to processing.

### 4. Technical Stack
- **Backend:** Node.js 22 (ESM), TypeScript 5.7, Hono, SQLite with `better-sqlite3`.
- **PayPal Integration:** `@paypal/paypal-server-sdk` v2.5.0 for Orders v2 & Captures/Refunds v2; typed REST client for Payouts v1 and Webhook Signature Verification.
- **AI Compiler:** Google Gemini 2.5 Flash (`temperature: 0`, strict JSON mode) with SHA-256 Record/Replay cache (`fixtures/replay-cache.json`) for zero-key offline reproducibility.
- **Frontend:** React 18, Vite 6, Tailwind CSS 3.4, Lucide Icons. Designed with clean financial typography (`Inter` & `JetBrains Mono`, `.tabular-nums` alignment).
- **Verification:** `vitest` (49 unit, integration & chaos tests), `fast-check` (2,000 property-based testing runs).

---

## 4. Challenges I Overcame

1. **APIMatic SDK v2.5.0 Method Evolution:**
   - During Day-1 PayPal sandbox smoke tests, I noticed that the legacy `ordersCreate`, `ordersCapture`, and `capturesRefund` methods had been updated in `@paypal/paypal-server-sdk` v2.5.0 to controller-scoped methods (`ordersController.createOrder`, `ordersController.captureOrder`, and `paymentsController.refundCapturedPayment`). I mapped these signatures in `APIMATIC_DEVLOG.md` and integrated them into `sdk-client.ts`.
2. **Dual-Stack IPv6/IPv4 Network Port Binding:**
   - In Node 20+, `localhost` proxy resolution between Vite and background servers can trigger `AggregateError [ECONNREFUSED]`. I resolved this by explicitly binding the server to `0.0.0.0` on port `3001` and configuring Vite's proxy target explicitly to `http://127.0.0.1:3001`, verified with health check endpoints.
3. **Canonical JSON Serialization for Audit Hash Continuity:**
   - In SQLite audit logging, Javascript objects containing `undefined` properties can cause hash discrepancies when re-serialized. I wrote a `canonicalJson()` function that sorts object keys lexicographically and strips `undefined` values before SHA-256 computation.
4. **The Net Revenue Tier Straddle:**
   - Calculating revenue shares when a single $100 sale straddles a recoup or tier boundary requires dividing the single transaction into two pools (pre-tier and post-tier), applying distinct basis-point distributions (40/30/20/10 vs. 25/25/25/25), and allocating remainder cents with deterministic tie-breaking.

---

## 5. Accomplishments I'm Proud Of

- **Cent Conservation Invariant:** 2,000 randomized property tests run across arbitrary gross amounts, basis points, and recoupment states without a single cent lost or created.
- **8-Test Chaos Suite:** Injects 8 payment failure scenarios (duplicate webhooks, signature tampering, out-of-order refunds, batch replays, unclaimed timeouts, double-clicks, and deliberate invariant tampering) and verifies safe handling and continuous audit logging.
- **16-Agreement Compiler Evaluation:** Evaluated on 16 commercial agreements across indie games, SaaS, podcasts, crowdfunding projects, and creator courses:
  - 100% Schema Validity after validation loop (16/16)
  - 100% Basis-Point Conservation (16/16 summing to 10,000 bps)
  - 100% Ambiguity Recall via neuro-symbolic pipeline (32/32)
  - 100% Number Verifier Catch Rate (5/5 hallucinated currency probes rejected)
- **Zero-Key Offline Replay Mode:** With `OFFLINE_REPLAY_ONLY="true"` or without API keys, Tributary operates deterministically from its SHA-256 fixture cache.
- **Clean Financial UI:** A focused web dashboard with pixel-aligned tabular numerals and clear status badges.

---

## 6. What I Learned

- **Neuro-Symbolic Architecture is Essential in FinTech:** Generative AI should not calculate money. By isolating LLMs to linguistic interpretation and delegating all arithmetic to deterministic state machines, you get the flexibility of AI with the certainty of double-entry bookkeeping.
- **Idempotency Must Be Multi-Layered:** Network timeouts, double-clicks, and duplicate webhooks will happen. Enforcing idempotency at the HTTP header, database constraint, and webhook deduplication layers prevents duplicate payouts reliably.

---

## 7. What's Next for Tributary

- **Multi-Currency Global Settlements:** Integrating PayPal FX exchange rates into the integer-cent waterfall engine for multi-currency collaborator payouts.
- **Recurring Subscription Splits:** Continuous stream-splitting for SaaS and membership platforms on PayPal Subscriptions.
- **Automated Tax Compliance:** Automatic end-of-year 1099 reporting generated directly from the hash-chained SQLite audit log.

---

## 8. Built With

- `typescript`
- `node.js`
- `hono`
- `better-sqlite3`
- `@paypal/paypal-server-sdk`
- `@google/genai`
- `fast-check`
- `vitest`
- `react`
- `vite`
- `tailwindcss`
- `lucide-react`

