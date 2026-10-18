# Tributary — Devpost Hackathon Submission Package

**Project Name:** Tributary: Your revenue-share agreement, now executable  
**Tagline:** Turn ambiguous revenue-share agreements into cryptographically pinned, integer-cent executable payout machines on PayPal.  
**Hackathon:** PayPal AI Hackathon 2026  
**Repository:** https://github.com/priyanshusingh4321/tributary  

---

## 1. Project Overview & Inspiration

### Inspiration
Revenue-share agreements power the creative, independent, and tech economies. Whether it is an indie game studio splitting Steam sales, a podcast network splitting ad revenue, creators launching courses with marketing agencies, or developers subcontracting on client projects, revenue-sharing aligns incentives without requiring upfront capital.

Yet in practice, **revenue-sharing is a broken, high-friction nightmare:**
- **The Spreadsheet Trap:** Payout calculations are done by humans in Excel weeks or months after the fact. Collaborators never know whether calculations are accurate or what deductions were taken.
- **The Recoup & Tier Straddle Problem:** Agreements commonly state: *"Maya fronted a $400 art cost and is repaid first. Then revenue splits 40/30/20/10 until $2,000 net, after which it splits an even 25% each."* When a single sale straddles a recoup or tier boundary, spreadsheet math fails.
- **The Post-Payout Refund Crisis:** What happens when a customer requests a $50 refund after collaborator payouts have already been deposited? In traditional setups, the merchant eats 100% of the loss or attempts awkward manual clawbacks.
- **The AI Hallucination Danger:** While Large Language Models are phenomenal at understanding contract legalese, **LLMs cannot do financial arithmetic.** A floating-point error, hallucinated percentage, or off-by-one cent discrepancy can destroy trust or violate financial regulations.

We built **Tributary** to solve this permanently through **Neuro-Symbolic Architecture:** LLMs interpret natural-language agreement terms and identify ambiguous clauses; but a pure, deterministic integer-cent engine handles 100% of the financial math, backed by SQLite 3-layer idempotency, PayPal Orders v2, and PayPal Payouts v1.

---

## 2. What It Does

Tributary is a complete, production-grade revenue settlement platform with four cohesive operational screens:

### Screen 1: Deal Studio (Contract Compilation & Ambiguity Interrogation)
- **Natural Language Drafting:** Paste any plain-English agreement (e.g. *"Maya gets $400 art cost back first, then 40/30/20/10 split until $2,000 net..."*).
- **Structured AST Extraction:** Google Gemini Flash extracts payees, basis-point weights, recoupment rules, reserve holdbacks, and payout thresholds into a strictly validated `DealSpec` schema.
- **Interactive Ambiguity Resolution:** Tributary highlights latent contract ambiguities (e.g. *Is Maya's $400 recoup calculated before or after PayPal's 3.49% + $0.49 fee?*). Users resolve them with interactive chips before signing.
- **Cryptographic Deal Hash Pinning:** Upon confirmation, the agreement terms are hashed via SHA-256 and locked immutably. Payouts can only execute against this cryptographic digest.

### Screen 2: Waterfall Simulator & Property-Based Prover
- **FinOps What-If Sandbox:** An interactive gross sale slider and recoupment tracker running client-side integer-cent waterfall calculations in real-time.
- **Visual Remainder Allocation:** Explains how fractional cents are awarded deterministically using the Largest-Remainder (Hamilton) method.
- **`100/100 PROPERTY TESTS PASSED` Badge:** Executes 100 randomized property tests via `fast-check` to prove that not a single cent is created or lost across random sales volumes ($1 to $50,000).

### Screen 3: Live Settlement Ledger (Orders v2 + Payouts v1)
- **Live PayPal Capture:** Connects directly to PayPal Orders v2 (`@paypal/paypal-server-sdk` v2.5.0) to capture customer checkouts.
- **Transparent Fee Attribution:** Explicitly badges whether payment processing fees were derived from live PayPal breakdowns (`[FEE SOURCE: PAYPAL ACTUAL]`) or standard fallback schedules (`[FEE SOURCE: FALLBACK 3.49% + $0.49]`).
- **Immediate Batch Payouts:** Automatically emits batch payout instructions via PayPal Payouts v1 to all collaborator personal accounts (`sender_batch_id` protected by SQLite `UNIQUE` constraints).
- **Post-Payout Refund Clawback Engine:** When refunds occur post-payout, the engine drains rolling reserves first, calculates remaining deficits pro-rata, and automatically nets out deficits on future sales.
- **Cryptographically Hash-Chained Audit Log:** Every state transition (`DEAL_SIGNED`, `SALE_CAPTURED`, `WATERFALL_COMPUTED`, `PAYOUT_BATCH_CREATED`, `REFUND_CLAWBACK_APPLIED`) appends to an SHA-256 hash-chain (`entry_hash = SHA256(prev_hash + timestamp + event_type + canonicalJson(payload))`), offering mathematical proof of non-tampering.

### Screen 4: Payee Statements & Strict Number Verifier
- **Itemized Collaborator Portals:** Individual payee balances tracking Total Earned, Total Paid via PayPal, Carried Forward Balance, and Recovery Deficits.
- **Citation-Verified AI Explanations:** Gemini produces natural-language explanations of collaborator statements. Crucially, a **Strict Allowlist Number Verifier** extracts every currency string via regex and validates it against the deterministic engine trace allowlist. Any hallucinated amount is immediately intercepted and rejected.

### 8-Test Chaos Drawer (Automated Failure Injection)
- Slide-over test runner executing 8 extreme payment edge cases (duplicate webhooks, signature tampering, out-of-order refunds, batch replays, unclaimed timeouts, concurrent double-clicks, and deliberate 1-cent invariant tampering) in <50ms with unbroken audit continuity.

---

## 3. How We Built It

Tributary was designed and built according to **5 Non-Negotiable Invariants:**

### 1. The Strict AI Air-Gap
The `ai-compiler` module is strictly quarantined:
- It **never** imports from `paypal-gateway`.
- It **never** accesses `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET`.
- It **never** computes money or balances.
- It is limited to structured contract AST extraction.

### 2. Pure Integer-Cent Financial Core
- Zero floating-point arithmetic. All monetary strings (`"100.02"`) are parsed via strict regex `/^(\d+)(?:\.(\d{1,2}))?$/` into exact integer cents (`10002`).
- Every execution enforces the hard conservation invariant:
  $$\text{feeCents} + \text{reserveCents} + \sum \text{payoutCents} + \sum \text{carriedForwardCents} + \text{withheldRecoveryCents} \equiv \text{grossCents}$$
- If this equation fails by even 1 cent, the engine halts with `InvariantViolationError` and records an immutable halt event in the audit log.

### 3. 3-Layer Idempotency Architecture
- **Layer 1 (Transport):** Deterministic `PayPal-Request-Id` headers for all capture and payout calls.
- **Layer 2 (Database):** `sender_batch_id = "trib_" + SHA256(saleId + ":" + dealHash).slice(0, 24)` enforced by SQLite `UNIQUE` constraints before any network call.
- **Layer 3 (Webhook):** Dedicated `webhook_events` table with `event_id PRIMARY KEY` deduplication prior to processing.

### 4. Technical Stack
- **Backend:** Node.js 22 (ESM), TypeScript 5.7, Hono (clean REST micro-framework), SQLite with `better-sqlite3`.
- **PayPal Integration:** `@paypal/paypal-server-sdk` v2.5.0 for Orders v2 & Captures/Refunds v2; typed HTTP client for Payouts v1 and Webhook Signature Verification.
- **AI Compiler:** Google Gemini 1.5 Flash (`temperature: 0`, strict JSON schema mode) with SHA-256 Record/Replay cache (`fixtures/replay-cache.json`) for zero-key offline reproducibility.
- **Frontend:** React 18, Vite 6, Tailwind CSS 3.4, Lucide Icons. Designed to Google Cloud Console / Stripe FinOps Enterprise design system standards (light mode `#F8F9FA`, `#DADCE0` structural hairline borders, Google Fonts `Inter` & `JetBrains Mono`, `.tabular-nums` alignment).
- **Verification:** `vitest` (49 unit, integration & chaos tests), `fast-check` (2,000 property-based testing runs).

---

## 4. Challenges We Overcame

1. **APIMatic SDK v2.5.0 Method Evolution:**
   - During Day-1 PayPal sandbox smoke tests, we identified that the legacy `ordersCreate`, `ordersCapture`, and `capturesRefund` methods had been updated in the APIMatic `@paypal/paypal-server-sdk` v2.5.0 to controller-scoped methods (`ordersController.createOrder`, `ordersController.captureOrder`, and `paymentsController.refundCapturedPayment`). We documented these signatures in `APIMATIC_DEVLOG.md` and built typed wrappers.
2. **Dual-Stack IPv6/IPv4 Network Port Binding:**
   - In Node 20+, `localhost` proxy resolution between Vite and background servers can trigger `AggregateError [ECONNREFUSED]`. We resolved this by explicitly binding the server to `0.0.0.0` on port `3001` and configuring Vite's proxy target explicitly to `http://127.0.0.1:3001`, verified with health check endpoints.
3. **Canonical JSON Serialization for Audit Hash Continuity:**
   - In SQLite audit logging, Javascript objects containing `undefined` properties can cause hash discrepancies when re-serialized after SQLite retrieval. We engineered a strict `canonicalJson()` function that sorts object keys lexicographically and strips `undefined` values before SHA-256 computation.
4. **The Net Revenue Tier Straddle:**
   - Calculating revenue shares when a single $100 sale straddles a $2,000 net revenue boundary requires dividing the single transaction into two pools (pre-tier and post-tier), applying distinct basis-point distributions (40/30/20/10 vs. 25/25/25/25), and allocating remainder cents with deterministic tie-breaking.

---

## 5. Accomplishments That We're Proud Of

- **100% Mathematical Precision:** 2,000 randomized property tests run across arbitrary gross amounts, basis points, and recoupment states without a single cent lost or created.
- **8-Test Chaos Suite:** Injects 8 real-world payment failures (duplicate webhooks, signature tampering, out-of-order refunds, batch replays, unclaimed timeouts, double-clicks, and deliberate invariant tampering) and verifies 100% pass rates with continuous audit integrity.
- **16-Agreement Compiler Evaluation:** Evaluated on 16 diverse commercial agreements across indie games, SaaS, podcasts, Kickstarter projects, and creator courses:
  - 100% Schema Validity (16/16)
  - 100% Basis-Point Conservation (16/16)
  - 100% Ambiguity Recall (32/32)
  - 100% Number Verifier Catch Rate (5/5)
- **Zero-Key Offline Replay Mode:** With `OFFLINE_REPLAY_ONLY="true"` or without API keys, Tributary operates 100% deterministically from its SHA-256 fixture cache.
- **Enterprise FinOps UI:** A modern Google Cloud Console / Stripe Merchant aesthetic with pixel-aligned tabular numerals and transparent honesty badges.

---

## 6. What We Learned

- **Neuro-Symbolic Architecture is Mandatory in FinTech:** Generative AI should never calculate money. By isolating LLMs to linguistic interpretation and delegating all math to deterministic state machines, you get the flexibility of AI with the bulletproof certainty of double-entry bookkeeping.
- **Idempotency Must Be Multi-Layered:** Network timeouts, double-clicks, and duplicate webhooks will inevitably happen. Enforcing idempotency at the HTTP header, database constraint, and webhook deduplication layers ensures duplicate payouts are physically impossible.

---

## 7. What's Next for Tributary

- **Multi-Currency Global Settlements:** Integrating PayPal FX exchange rates into the integer-cent waterfall engine for multi-currency collaborator payouts.
- **Recurring Subscription Splits:** Continuous stream-splitting for SaaS and membership platforms on PayPal Subscriptions.
- **Automated Tax Compliance:** Automatic end-of-year 1099-MISC / 1099-K reporting generated directly from the cryptographically verified SQLite audit log.

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

---

## 9. 2:50 Timestamped Demo Video Script

**Title:** Tributary — Your Revenue-Share Agreement, Now Executable  
**Total Runtime:** Exactly 2 minutes, 50 seconds (170 seconds)  
**Presenter:** Lead Principal Engineer  

| Timestamp | Visual Cue / Screen Display | Presenter Narration (Audio) | On-Screen Telemetry & Metrics |
| :---: | :--- | :--- | :--- |
| **0:00 - 0:25** (25s) | **Screen 1: Deal Studio.** Clean Google Cloud FinOps UI. Natural language contract on the left; structured AST on the right. | *"This is Tributary. In the creative and startup economy, revenue-share agreements live as ambiguous PDF contracts. Calculations are done manually in spreadsheets, leading to delayed payments, broken trust, and unrecovered refund losses. Today, we turn plain-English agreements into cryptographically pinned, automated payout machines on PayPal."* | Tagline: *Your revenue-share agreement, now executable.*<br>Badge: `[PAYPAL SANDBOX LIVE]` `[AI AIR-GAP VERIFIED]` |
| **0:25 - 0:50** (25s) | Cursor highlights plain English agreement. Clicks **"Compile Agreement"**. Ambiguity chips appear. | *"Here in Deal Studio, Team Moonlit sells an indie game. Maya fronted $400 for art and must be repaid first, then revenue splits 40/30/20/10 until $2,000 net, after which it splits an even 25% each. Our AI Compiler extracts structured rules. Notice Tributary catches a critical ambiguity: Is Maya's recoup calculated before or after PayPal's 3.49% + $0.49 fee? We choose NET OF FEES, and click Lock Agreement. The terms are hashed via SHA-256 and locked immutably."* | Compiler Source: `GEMINI_FLASH` / `REPLAY_CACHE`<br>Ambiguity Chip: `NET_OF_FEES`<br>SHA-256 Hash displayed |
| **0:50 - 1:15** (25s) | **Screen 2: Waterfall Simulator.** Interactive slider moves from $50 to $100. | *"Under the hood, we enforce a strict air-gap: AI never touches PayPal secrets and never does math. All arithmetic is integer-cents with zero floating-point errors. Here in the Simulator, the Largest-Remainder method awards cents deterministically. Notice our fast-check badge: 100 out of 100 property-based testing runs prove cent conservation across arbitrary amounts."* | fast-check Badge: `100/100 PROPERTY TESTS PASSED`<br>Slider: `$100.00 Gross`<br>Conservation: `Delta = 0 Cents` |
| **1:15 - 1:50** (35s) | **Screen 3: Live Settlement Ledger.** Clicks **"Preset: Moonlit ($370/$400)"**, then clicks **"Capture $100 Sale"**. Waterfall tiles animate. | *"Now for the hackathon demo climax. We load Team Moonlit seeded at $370 of Maya's $400 recouped. Watch what happens when we capture a live $100 PayPal checkout. The engine deducts PayPal's actual $3.98 fee, puts $9.60 into a 14-day refund reserve, and pays Maya exactly $30.00 to complete her recoup. The remaining $56.42 splits 40/30/20/10: Maya receives $52.57, Arjun $16.93, Lina $11.28, Dev $5.64. PayPal Payouts v1 executes the batch immediately. Exactly 10,000 cents in, 10,000 cents accounted for."* | Gross: `$100.00`<br>Fee: `-$3.98` `[FEE SOURCE: PAYPAL ACTUAL]`<br>Reserve: `-$9.60`<br>Maya Payout: **`$52.57`**<br>Arjun: **`$16.93`**, Lina: **`$11.28`**, Dev: **`$5.64`**<br>Batch ID: `trib_dbf063ed...` |
| **1:50 - 2:15** (25s) | Clicks **"Refund $50"**. Reserve drains to 0. Recovery deficit cards appear. | *"Now, the scenario that breaks every traditional platform: a customer requests a $50 refund after payouts have already cleared. Tributary executes our Refund Clawback Engine: the $9.60 reserve drains to zero first. The remaining $40.40 deficit is apportioned pro-rata across payees and recorded in SQLite. On the next sale, each collaborator's deficit is automatically netted out before disbursement."* | Refund: `$50.00`<br>Reserve: `$9.60 -> $0.00`<br>Deficit Pool: `-$40.40`<br>Netted on future sales |
| **2:15 - 2:35** (20s) | **Screen 4: Payee Statements.** Clicks Maya Lin tab. Highlights verified prose citations. | *"In Screen 4, collaborators see itemized balances. AI generates natural-language statement summaries, but with a critical security guarantee: our Strict Allowlist Number Verifier extracts every cited currency figure and rejects any amount not present in the deterministic engine trace. Hallucinations are mathematically impossible."* | Payee: Maya Lin<br>Total Earned: `$52.57`<br>Citation badge: `100% NUMBERS VERIFIED IN TRACE ALLOWLIST` |
| **2:35 - 2:50** (15s) | Clicks **"Chaos Suite"**. Drawer slides open. Runs 8 tests in 45ms. Hash-chain audit verified. | *"Finally, our 8-Test Chaos Drawer injects duplicate webhooks, tampered signatures, and race conditions. All 8 pass in 45 milliseconds, backed by an unbroken SHA-256 hash-chained audit log. Tributary makes revenue-sharing transparent, tamper-evident, and fully autonomous on PayPal. Thank you."* | 8/8 Scenarios: `PASS`<br>Elapsed: `45ms`<br>Audit Continuity: `VERIFIED`<br>Outro: Tributary on PayPal |
