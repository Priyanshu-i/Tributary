# Tributary: AI Compiler & Citation-Verifier Evaluation Report

This report evaluates Tributary's **neuro-symbolic compiler pipeline** across 16 plain-English revenue-share agreements spanning indie gaming, podcast networks, digital music, creator launches, graphic novels, tabletop publishing, and edge cases.

---

## 1. Evaluation Methodology & Metrics

To provide an honest and transparent evaluation of the system, we measure performance at two distinct stages:
1. **Raw First-Pass LLM Generation:** Direct output from Google Gemini 2.5 Flash prior to deterministic retry loops or rule-based ambiguity augmentation.
2. **Post-Validator Neuro-Symbolic Pipeline:** The full Tributary architecture, which runs the LLM output through a Zod schema validation and repair loop, applies deterministic ambiguity rules, and checks all generated dollar amounts against an execution trace allowlist.

### Metrics Definitions

- **Schema Validity:** Does the extracted JSON conform strictly to the `DealSpec` schema (valid payees, required identifiers, non-empty arrays)?
- **Basis-Point Conservation (10,000 bps):** Do the payee revenue share weights in each tier sum to exactly 10,000 basis points (100.00%)?
- **Ambiguity Detection Recall:** Does the compiler identify latent financial ambiguities present in the agreement (e.g. fee deduction timing, rolling reserve holdbacks, payout thresholds)?
- **Number-Verifier Catch Rate:** Does the regex-based allowlist verifier intercept and reject prose statements containing unverified or hallucinated dollar figures?
- **Activation Block Rate:** Does the platform block agreement activation until human signatories resolve all flagged ambiguities?

---

## 2. Summary Comparison Scorecard

| Metric | Raw First-Pass LLM | Post-Validator Pipeline | Target | Result Status |
| :--- | :---: | :---: | :---: | :---: |
| **Zod Schema Validity** | 93.8% (15/16) | **100.0% (16/16)** | 100% | PASS |
| **Basis-Point Conservation (10,000 bps)** | 93.8% (15/16) | **100.0% (16/16)** | 100% | PASS |
| **Ambiguity Detection Recall** | 93.8% (30/32) | **100.0% (32/32)** | >90% | PASS |
| **Number-Verifier Catch Rate** | — | **100.0% (5/5)** | 100% | PASS |
| **Activation Block Rate (Pre-Clarification)** | 100.0% (16/16) | **100.0% (16/16)** | 100% | PASS |

### Key Observations on Raw vs. Pipeline Performance

1. **Schema Validity & Basis-Point Repair on Edge Case #16:**
   - On `agreement_16_vague_informal_agreement` (an informal collaboration text), the raw LLM extracted percentage shares that summed to `9,900 bps` (99.00%) due to ambiguous rounding in the source prose.
   - The raw output failed initial Zod validation. The **Zod repair loop** automatically fed the validation error back to the compiler, normalizing the remainder basis points and producing a valid 10,000 bps specification on the second pass.
2. **Ambiguity Recall:**
   - When evaluated on raw prompt inference alone, the LLM identified 30 of 32 expected contract ambiguities.
   - The neuro-symbolic pipeline pairs the LLM with deterministic heuristics (e.g., checking for unstated fee deduction timing or missing refund reserve policies), achieving 32/32 recall across the dataset.
3. **Number-Citation Verifier:**
   - The verifier operates downstream on natural-language payee statement summaries. Because it uses strict regular expressions to cross-reference every cited dollar figure against the integer-cent engine trace, 5 out of 5 intentionally injected hallucinated numbers were intercepted and rejected.

---

## 3. Dataset Benchmark Breakdown

The 16 evaluation agreements are located in [`src/ai-compiler/eval-dataset.json`](./src/ai-compiler/eval-dataset.json):

| Dataset ID | Industry Domain | First-Pass Valid | Pipeline Valid | BPS (100%) | Ambiguity Recall | Activation Blocked |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `agreement_01_moonlit_game` | Indie Video Game | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_02_creator_ad_launch` | Course Launch & Paid Ads | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_03_podcast_network` | Podcasting Network | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_04_music_label_split` | Music Release | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_05_kickstarter_comic` | Zine & Comic Collective | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_06_dev_agency_subcontract` | Agency Subcontracting | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_07_saas_micro_founders` | Micro-SaaS Product | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_08_live_comedy_stream` | Live Entertainment | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_09_tabletop_rpg_module` | Tabletop Publishing | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_10_youtube_production` | Creator Production Team | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_11_coding_bootcamp` | EdTech Workshop | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_12_3d_asset_store` | Game Dev Asset Pack | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_13_mobile_game_publishing` | Mobile Publishing | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_14_ambient_music_app` | Audio & Meditation App | ✅ | ✅ | ✅ (10,000) | 2/2 | 🔒 LOCKED |
| `agreement_15_pure_equal_five_way` | Open Collective (No Recoup) | ✅ | ✅ | ✅ (10,000) | 1/1 | 🔒 LOCKED |
| `agreement_16_vague_informal_agreement` | Informal Collab (Ambiguous) | ⚠️ *(Repaired)* | ✅ | ✅ (10,000) | 3/3 | 🔒 LOCKED |

---

## 4. Number-Citation Verifier Guardrail Proof

- **Protocol:** Regex extraction scans all generated prose for currency tokens (`$X.XX`, `$X`) and converts each to exact integer cents.
- **Rule:** Every single numeric token in prose must match a value in the deterministic `engineTrace` allowlist.
- **Injected Hallucination Probes:** 5 adversarial test prompts with invented dollar amounts (e.g., `$999.99`, `$42.50`, `$500.00`, `$15.75`, `$10,000.00`).
- **Result:** **100% Catch Rate (5/5)**. Every unverified dollar amount was intercepted, triggering the deterministic fallback template.
