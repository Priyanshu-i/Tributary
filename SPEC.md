Tributary: Final Project Spec

PayPal AI Hackathon entry. Solo build. Final consensus, Oct 17, 2026.

0. How any AI should use this doc

This is the single source of truth for the project. If you are an AI assistant helping build it:

* Follow the scope here. Do not add features, services or sponsors without asking the owner.

* Everything must be free: no paid APIs, no credit card, no business KYC. PayPal sandbox only, never real money.

* The LLM never holds PayPal credentials and never calculates money. Deterministic TypeScript code does all math (integer cents) and all PayPal calls.

* If unsure whether a PayPal endpoint or sandbox behavior works, say so and test it. Do not guess.

* Label anything simulated (seeded data, demo clock, fallback fees) in the UI and in the video.

1. One-line summary

Tributary turns a plain-English revenue-share agreement into a verified, executable PayPal payout engine. Every sale made through PayPal checkout is split by deterministic code into real sandbox payouts, with PayPal fees, holdbacks and refunds handled correctly.

Tagline: Your revenue-share agreement, now executable.

Core rule: AI proposes and explains. Deterministic code verifies and executes.

2. Hackathon facts

Item

Detail

Event

PayPal AI Hackathon on Devpost, online, solo entry

Deadline

Nov 12, 2026, 12:00 PT (= Nov 13, 01:30 IST). Our target: submit by Nov 10

Hard requirement

Meaningful use of PayPal (sandbox) AND AI. PayPal must be central

Deliverables

Working prototype (hosted URL or clear run steps), public GitHub repo with visible open-source license, text description, list of AI tools used, public YouTube video under 3 minutes showing it working end to end

Stage 1

Pass/fail on theme fit and real PayPal API use

Stage 2

Five equal criteria (20% each): Technological Implementation, Design, Potential Impact, Innovation, Presentation. Ties break on Technological Implementation first

Judging

Dec 1-15. Judges may score from the description and video alone. Keep any hosted demo alive through Dec 15

Prizes

Grand $12k / $8k / $5k. Honorable mentions $5k each. Sponsor prizes. One project wins one grand prize OR one honorable mention, plus at most one sponsor prize

Video rules

No third-party trademarks or unlicensed music

The field is large (about 15,000 registrants) and many public repos already exist for guardrailed payment agents, AI escrow, dispute agents and failed-payment recovery. Tributary was chosen because it is in an uncrowded lane.

3. Problem, user, scenario

User: small creative or freelance teams who share revenue: indie game or music teams, zine and comic collectives, podcast networks, creator launches with an ad partner, small agencies with subcontractors.

Problem: real deals are conditional (repay upfront costs first, tiers after a revenue threshold, refund holdbacks, minimum payouts). Teams track them in spreadsheets, argue about who is owed what, and nobody handles PayPal fees or refunds after payout correctly. PayPal Payouts is only an API with no deal logic, and a chatbot cannot be trusted with the arithmetic.

Demo scenario (fictional): team Moonlit sells a game. Maya fronted a $400 art cost. Deal: repay Maya first from net sales, then split 40% Maya, 30% Arjun, 20% Lina, 10% Dev. After $2,000 net the split changes to 25/25/25/25. Hold 10% as a refund reserve for 14 days. Pay out only when a balance is at least $25.

4. Features

MUST (finish by end of week 2)

* Paste agreement text; AI compiles it into a typed deal spec and asks blocking clarification questions (example: is the recoup calculated after PayPal fees? who absorbs a post-payout refund?).

* Deterministic waterfall engine in integer cents (see section 8) with unit and property tests.

* Simulator: AI proposes 3 edge-case sales; the engine computes results; a human approves.

* Sign-off locks an immutable, hash-pinned deal version (SHA-256).

* Real PayPal checkout (Orders create and capture), each order tagged with the deal ID.

* Webhook receiver with PayPal signature verification and event-ID dedupe.

* Distribution creates one idempotent PayPal Payouts batch; item status updates via webhooks.

* Ledger UI: sales, splits, payout item statuses, reserve, recovery balances.

* Pause switch, sandbox banner, per-batch cap.

* Judge scenario bar: one-click preset deal plus buttons to run the demo sale, refund and chaos tests (judges should not need to type or upload anything).

* LLM record/replay cache and offline mode so the app works with no API key or quota.

SHOULD

* Refund after payout: reserve absorbs first, remaining deficit becomes a per-payee recovery balance netted against future payouts (PayPal cannot pull money back from payees).

* Payee statement page with AI explanation, checked by a number verifier (every dollar figure in the text must exist in the engine trace).

* Chaos test suite, 8 tests (section 11) with a one-click run.

* Hash-chained audit log.

* Compile eval: 15-20 agreements you write from realistic templates; report your measured accuracy honestly, including failures.

* Second preset (creator launch: recoup ad spend, then agency fee, then profit split).

* Hosted deploy.

NICE (cut first)

* Expense amendment: upload a receipt, AI extracts the amount and checks it against the deal&apos;s allowed-cost clause, proposes a co-signed deal version change. Start with pasted text, vision later.

* Sankey view of one sale.

* Read-only MCP server (answer &apos;what do I earn from sale 14?&apos;; no money tools).

* Hindi/Spanish statements, PDF statements, dispute-created webhook freeze.

5. PayPal integrations (core, required)

Use @paypal/paypal-server-sdk for Orders and Payments. Use plain REST for Payouts and webhook verification (the SDK may not cover them; confirm on Day 1).

Purpose

Endpoint or event

Auth

POST /v1/oauth2/token

Create sale

POST /v2/checkout/orders (intent CAPTURE, custom_id = deal ID)

Capture

POST /v2/checkout/orders/{id}/capture with PayPal-Request-Id; read seller_receivable_breakdown for the real fee and net

Checkout buttons

PayPal JS SDK (v6; fall back to v5 if blocked)

Webhook trust

POST /v1/notifications/verify-webhook-signature

Webhook testing

POST /v1/notifications/simulate-event or dashboard simulator

Pay out

POST /v1/payments/payouts; sender_batch_id = hash(sale ID, deal version)

Payout status

GET /v1/payments/payouts/{batch_id}; webhooks for batch and item success, denied, unclaimed, returned, blocked

Cancel unclaimed

POST /v1/payments/payouts-item/{id}/cancel

Refund

POST /v2/payments/captures/{id}/refund; use the response&apos;s own payable breakdown; events PAYMENT.CAPTURE.REFUNDED and REVERSED

Reconcile

GET /v1/reporting/transactions (delayed; webhooks are the source of truth)

Sandbox rules: create the business account and four personal payee accounts with region United States (USD). Payouts to emails that are not real sandbox accounts stay UNCLAIMED, so always use the sandbox personal account emails as payees.

6. Awards and sponsor integrations

Prize targets (pick one each):

* Grand prize: scored on the five criteria above.

* Honorable mention target: Best Use of PayPal + AI. Tributary is not an agent that shops, so do not claim Best Use of Agentic Commerce.

* Sponsor target: APIMatic (3 prizes of $1k plus subscription). Natural fit: build against the official PayPal Server SDK (generated by APIMatic) using the free APIMatic ContextMatic plugin in the coding IDE. Keep APIMATIC_DEVLOG.md with concrete before/after examples of what the plugin got right or prevented. Read the exact prize criteria on the Devpost sponsor page before the final week.

Sponsor

Prize

Decision

Reason

APIMatic

3 x $1k + subscription

Target

Free tools; natural use while building

Render

Credits

Hosting only

Free web service for webhook endpoint and demo; do not rely on the prize. Confirm no card is needed

AG Grid

$5k, $2k, 3 x $1k

Skip

Award stresses AG Studio; enterprise features use a 45-day trial that expires before judging; solo time cost; other entrants already use it

Channel3

$1.5k

Skip

Product search API; no natural fit

Bryntum

3 x $1k

Skip

Scheduling and Gantt components; no natural fit

Postman

none

Optional

Free; ship a collection of the sandbox calls in the README

Elastic, Zapier, KERNEL, Astropods

none

Skip

Not needed

A project can win only one sponsor prize, so do not use every sponsor.

7. Architecture and free stack

Buyer -&gt; Checkout page -&gt; Orders create/capture (PayPal sandbox)                 | webhook: PAYMENT.CAPTURE.COMPLETED                 vWebhook receiver -&gt; verify signature -&gt; dedupe by event ID -&gt; event store                 vEngine (pure, integer cents) &lt;- approved deal version (hash-pinned)                 vPayout executor -&gt; POST /v1/payments/payouts (idempotent)                 ^ webhooks: payout batch/item eventsLedger + audit log (SQLite) -&gt; React UILLM (compile, scenarios, explain): proposes data only. No PayPal access.

* Language and app: TypeScript, Node 20, Hono or Express, React + Vite + Tailwind.

* Database: SQLite (local file; Turso free tier if hosted).

* Validation and tests: Zod, Vitest, fast-check.

* LLM (free): Gemini Flash-class model via Google AI Studio free tier. Limits are low and change, so use a provider interface with free fallbacks (Groq or OpenRouter free models, or local Ollama) and a record/replay cache. Send only synthetic data.

* Hosting and webhooks (free): Render free web service, or run locally with a free Cloudflare quick tunnel. Free instances sleep when idle, so use a free uptime ping through Dec 15 if hosted.

* Other: GitHub (public repo, MIT license), YouTube (public video).

8. Money engine (integer cents only)

For each captured sale:

* G = gross. F = PayPal fee from seller_receivable_breakdown. N = G - F. If the breakdown is missing, use a labeled fallback fee (3.49% + 49 cents) and show &apos;Fee source: fallback&apos; in the UI.

* Reserve R = floor(N * reserve_bps / 10000). D0 = N - R.

* Recoup: RecoupPaid = min(D0, RecoupRemaining) goes to the recouping payee. D1 = D0 - RecoupPaid.

* Split D1 by the active tier&apos;s weights (basis points summing to 10000). Largest-remainder rounding: floor each share, give leftover cents to the largest remainders, ties broken by payee index. The deal must define the tier threshold basis (cumulative net revenue after fees, before reserve).

* Recovery netting per payee: payout_i = max(0, share_i - deficit_i). The amount withheld is W (kept by the seller to cover an earlier refund).

* Minimum payout: balances below the minimum are carried forward, not lost.

* Invariant before every payout call: F + R + sum(payouts) + sum(carried) + W == G. If false, halt and log.

* Refunds: use the refund response&apos;s breakdown. Reserve absorbs first. Any remaining deficit is allocated by the deal&apos;s clawback rule (default: pro rata to what each payee received from that sale; this is a clarification question the AI must ask). Refunds also reduce cumulative revenue and may reduce recoup progress; property tests must cover this.

Round only with integers. Parse PayPal amount strings with integer arithmetic, never float multiplication.

9. AI design

Four jobs, none touching money:

* Compile and interrogate: temperature 0, JSON-schema structured output, Zod validation, at most two repair attempts. The model must also return an ambiguities list; the UI blocks activation until each is answered.

* Scenario generation: the model proposes edge-case sales (first sale, sale that finishes a recoup and crosses a tier, refund after payout); the engine computes the numbers; a human approves.

* Explain: rewrite the engine trace as plain-English payee statements. A verifier rejects any text containing a dollar figure not in the trace.

* Expense amendment (NICE): extract amount and category from a receipt, check the allowed-cost clause, propose a change that needs co-signing.

LLM tool allowlist: propose_deal, ask_clarification, propose_scenarios, explain_trace, propose_amendment. There is no tool that moves money. Agreement and receipt text are untrusted input and can only produce data.

10. Safety and trust

* LLM has no PayPal credentials; only the payout executor does, and only from an approved deal version.

* Idempotency at three layers: PayPal-Request-Id, deterministic sender_batch_id, webhook event-ID dedupe.

* Payee emails are locked in the signed deal; changes need re-approval.

* Reserve and holdback; honest clawback model (recovery balance, since Payouts cannot reverse).

* Pause switch, per-batch cap, first-time-payee confirmation.

* Append-only hash-chained audit log: deal hash, engine trace, model and prompt version.

* Sandbox banner everywhere. No real money, no real personal data.

11. Chaos tests (8)

Duplicate webhook; tampered signature; refund event before capture event; replayed payout request; payout item UNCLAIMED then RETURNED; amount mismatch between order and capture; double-click on capture; deliberate invariant violation (payout must halt).

12. Demo numbers (boundary-crossing sale)

Run real sandbox sales beforehand so Maya shows $370 of $400 recouped (do not fake history). Then, on camera, one $100 sale. Using a 3.49% + $0.49 fee (replace with the real sandbox fee):

* Gross 10000, fee 398, net 9602, reserve 960, distributable 8642.

* First 3000 completes Maya&apos;s recoup. Remaining 5642 splits 40/30/20/10 as 2257 / 1693 / 1128 / 564.

* Payouts: Maya 5257, Arjun 1693, Lina 1128, Dev 564. Total 8642 + reserve 960 + fee 398 = 10000.

* Then refund $50: reserve absorbs first, remaining deficit becomes recovery balances.

Record narration only after you see the real fee numbers.

13. Screens

* Deal Studio: agreement text, clarification cards, typed spec, hash lock.

* Simulator: AI scenarios, engine results, property-test badge.

* Live Ledger: checkout, webhook status, payout table, recovery balances, chaos test button, judge scenario bar.

* Payee Statement: one collaborator&apos;s earnings with verified explanation.

14. Build plan (about 90 hours)

Dates

Goal

Oct 17-18

Smoke tests (section 16), repo with LICENSE, webhook receiver, engine v0 with tests

Oct 19-22

Payout executor, webhook handlers, LLM interface and cache, checkout. Ugly end-to-end run by Oct 22

Oct 23-29

UI pass 1, clarification flow, scenarios, sign-off hash, refund and recovery. Rough 3-minute video by Oct 29

Oct 30 - Nov 5

Statements and number verifier, chaos suite, eval harness, audit log, deploy, README. Show it to 3 people; talk to 3-5 real creators and get one quote with permission

Nov 6

Feature freeze

Nov 6-10

Bug fixes, final video, Devpost text, submit by Nov 10. Nov 11-12 is buffer

Cut order if behind: expense amendment, translations and PDF, dispute freeze, Sankey, hosted deploy (use run steps plus video), chaos suite down to 5 tests, second preset, tier logic.

Never cut: real checkout, verified webhooks, idempotent payouts, ledger, the video.

15. Submission package

Video (under 3:00, screen recording): 0:00-0:20 hook (group-chat argument, mocked without brand UI); 0:20-0:55 paste agreement, AI asks questions, deal locks; 0:55-1:45 live $100 sale to four payouts; 1:45-2:20 refund and recovery balance, payee statement, chaos tests pass; 2:20-2:50 impact close and the line &apos;AI proposes, deterministic code executes&apos;. Speed up the PayPal login segment and say so.

README: pitch and GIF; what is real vs simulated; quickstart in 5 commands with a zero-key offline mode; sandbox account setup and test credentials; architecture diagram; PayPal endpoints used; safety model; chaos and eval results; AI tools used; license.

Devpost text: problem and scenario, what it does, how it uses PayPal, how it uses AI (and what it deliberately does not), safety, what you measured, challenges, next steps, AI tools list.

Checklist: [ ] prototype runnable from README or hosted until Dec 15 [ ] public repo with standard LICENSE visible on GitHub [ ] public YouTube video under 3:00 [ ] no third-party trademarks or unlicensed music [ ] AI tools listed with how used [ ] test credentials included [ ] no secrets committed [ ] commit history after Oct 1 [ ] submitted by Nov 10 IST.

16. Verify on Day 1 (unknowns)

* Create and capture a $100 sandbox order; read the real seller_receivable_breakdown.

* Issue a partial refund; read its breakdown.

* Send a 4-recipient payout to US sandbox personal accounts; time it. Confirm Payouts is enabled for the app.

* Receive a webhook through a free tunnel and verify the signature.

* Check current Server SDK method names with the APIMatic Context Plugin.

* Read the APIMatic prize criteria and confirm Render needs no card.

If any step fails, ask on the PayPal Discord immediately and switch to the fallback noted in the relevant section.

17. Honest limits

No statistics may be invented. The &apos;real users&apos; evidence is the owner&apos;s own conversations plus the measured eval. Simulated elements (fallback fee, demo clock, seeded data) must be labeled. Winning is not guaranteed among thousands of entrants; the plan maximizes the chances at low cost.