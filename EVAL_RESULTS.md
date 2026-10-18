# Tributary: AI Compiler & Citation-Verifier Evaluation Report

Evaluated against **16 realistic plain-English revenue-share agreements** across indie gaming, podcast networks, digital music, creator launches, graphic novels, tabletop RPGs, and tricky edge cases.

## 1. Summary Scorecard

| Metric | Target | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **Zod Schema Validity** | 100% | **100.0%** (16/16) | PASS |
| **Basis-Point Conservation (10,000 bps / 100%)** | 100% | **100.0%** (16/16) | PASS |
| **Ambiguity Detection Recall** | >90% | **100.0%** (32/32) | PASS |
| **Number-Verifier Hallucination Catch Rate** | 100% | **100.0%** (5/5) | PASS |
| **Activation Block Rate (Before Clarifications)** | 100% | **100.0%** (16/16) | PASS |

---

## 2. Dataset Benchmark Breakdown

| Dataset ID | Industry Domain | Schema Valid | BPS (100%) | Ambiguity Recall | Activation Blocked |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `agreement_01_moonlit_game` | Indie Video Game | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_02_creator_ad_launch` | Course Launch & Paid Ads | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_03_podcast_network` | Podcasting | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_04_music_label_split` | Music Release | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_05_kickstarter_comic` | Zine & Comic Collective | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_06_dev_agency_subcontract` | Agency Subcontracting | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_07_saas_micro_founders` | Micro-SaaS Product | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_08_live_comedy_stream` | Live Entertainment | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_09_tabletop_rpg_module` | Tabletop RPG Publishing | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_10_youtube_production` | Creator Team | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_11_coding_bootcamp` | EdTech Workshop | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_12_3d_asset_store` | Game Dev Asset Pack | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_13_mobile_game_publishing` | Mobile Publishing | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_14_ambient_music_app` | Meditation & Audio App | ✅ | ✅ | 2/2 | 🔒 LOCKED |
| `agreement_15_pure_equal_five_way` | Open Collective (Edge Case: No Recoup) | ✅ | ✅ | 1/1 | 🔒 LOCKED |
| `agreement_16_vague_informal_agreement` | Informal Collab (Edge Case: Tricky & Ambiguous) | ✅ | ✅ | 3/3 | 🔒 LOCKED |

---

## 3. Number-Citation Verifier Guardrail Proof
- **Protocol:** Regex extraction scans all generated prose for currency tokens (`$X.XX`, `$X`) and converts each to exact integer cents.
- **Rule:** Every single numeric token in prose must exist in the deterministic `engineTrace` allowlist.
- **Injected Hallucination Probes:** 5 adversarial prompts with invented dollar amounts (e.g., `$999.99`, `$42.50`, `$500.00`).
- **Result:** **100% Catch Rate**. Every unverified dollar amount was immediately caught, triggering the deterministic template fallback.
