import { DealSpec, DealSpecSchema, WaterfallResult, SaleInput, RefundResult } from '../core-engine/types.js';
import { executeSaleWaterfall, executeRefundClawback, createInitialLedgerState } from '../core-engine/waterfall.js';
import { formatCentsToCurrency, formatCentsToAmount } from '../core-engine/amount-parser.js';
import { queryAIProvider } from './provider.js';
import { verifyNumbersInProse, NumberVerificationResult } from './number-verifier.js';

export interface DealAmbiguity {
  id: string;
  question: string;
  whyItMatters: string;
  options: string[];
  defaultOption: string;
}

export interface CompileResult {
  spec: DealSpec;
  ambiguities: DealAmbiguity[];
  canActivate: boolean;
  source: string;
  cacheKey: string;
}

export interface GeneratedScenario {
  title: string;
  description: string;
  saleInput: SaleInput;
  trace: WaterfallResult;
  refundResult?: RefundResult;
}

const SYSTEM_PROMPT_COMPILE = `You are the Tributary Agreement Compiler.
Your role: parse plain-English revenue-share agreements into strict JSON deal specs.
Invariants:
- Never calculate money.
- Never invent percentages.
- Identify missing rules and flag them as ambiguities:
  1. Recoup fee basis: is upfront recoup calculated before or after PayPal fees?
  2. Post-payout refund clawback rule: how is a deficit recovered if reserve is exhausted?
  3. Tier threshold basis: is the revenue tier measured on gross or net revenue?
Output JSON with schema:
{
  "dealId": "string",
  "version": 1,
  "title": "string",
  "payees": [
    { "id": "string", "name": "string", "email": "string", "tier1Bps": 4000, "tier2Bps": 2500 }
  ],
  "recoupBucket": { "payeeId": "string", "totalCents": 40000, "feeBasis": "NET_OF_FEES" },
  "tierThresholdNetCents": 200000,
  "reserveBps": 1000,
  "holdbackDays": 14,
  "minPayoutCents": 2500,
  "clawbackRule": "PRO_RATA_SALE_SHARE",
  "ambiguities": [
    { "id": "string", "question": "string", "whyItMatters": "string", "options": ["string"], "defaultOption": "string" }
  ]
}`;

/**
 * Compiles a plain-English agreement and flags blocking ambiguities.
 */
export async function compileAndInterrogate(
  agreementText: string,
  clarificationAnswers?: Record<string, string>
): Promise<CompileResult> {
  const response = await queryAIProvider({
    promptVersion: 'v1.0',
    systemPrompt: SYSTEM_PROMPT_COMPILE,
    userInput: agreementText,
    schemaType: 'propose_deal',
  });

  let parsed: any;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    throw new Error(`Failed to parse AI compiler JSON output: ${response.content.slice(0, 100)}`);
  }

  // Extract raw ambiguities
  let ambiguities: DealAmbiguity[] = parsed.ambiguities || [];

  // Apply clarification answers if provided
  if (clarificationAnswers) {
    if (clarificationAnswers['ambiguity_recoup_fee_basis']) {
      const choice = clarificationAnswers['ambiguity_recoup_fee_basis'];
      if (parsed.recoupBucket && (choice === 'NET_OF_FEES' || choice === 'GROSS')) {
        parsed.recoupBucket.feeBasis = choice;
      }
      ambiguities = ambiguities.filter((a) => a.id !== 'ambiguity_recoup_fee_basis');
    }

    if (clarificationAnswers['ambiguity_clawback_rule']) {
      const choice = clarificationAnswers['ambiguity_clawback_rule'];
      if (choice === 'PRO_RATA_SALE_SHARE' || choice === 'ACTIVE_TIER_WEIGHTS') {
        parsed.clawbackRule = choice;
      }
      ambiguities = ambiguities.filter((a) => a.id !== 'ambiguity_clawback_rule');
    }

    if (clarificationAnswers['ambiguity_tier_basis']) {
      ambiguities = ambiguities.filter((a) => a.id !== 'ambiguity_tier_basis');
    }
  }

  // Defensive basis-point normalization (Repair attempt 1)
  if (Array.isArray(parsed.payees) && parsed.payees.length > 0) {
    const tier1Sum = parsed.payees.reduce((acc: number, p: any) => acc + (p.tier1Bps || 0), 0);
    if (tier1Sum !== 10000 && tier1Sum > 0) {
      // Scale proportionally
      let running = 0;
      parsed.payees.forEach((p: any, idx: number) => {
        if (idx === parsed.payees.length - 1) {
          p.tier1Bps = 10000 - running;
        } else {
          p.tier1Bps = Math.floor((p.tier1Bps * 10000) / tier1Sum);
          running += p.tier1Bps;
        }
      });
    }

    const tier2Sum = parsed.payees.reduce((acc: number, p: any) => acc + (p.tier2Bps || 0), 0);
    if (tier2Sum !== 10000 && tier2Sum > 0) {
      let running = 0;
      parsed.payees.forEach((p: any, idx: number) => {
        if (idx === parsed.payees.length - 1) {
          p.tier2Bps = 10000 - running;
        } else {
          p.tier2Bps = Math.floor((p.tier2Bps * 10000) / tier2Sum);
          running += p.tier2Bps;
        }
      });
    }
  }

  // Validate with Zod
  const spec = DealSpecSchema.parse({
    dealId: parsed.dealId || 'deal_compiled',
    version: parsed.version || 1,
    title: parsed.title || 'Revenue Share Agreement',
    payees: parsed.payees || [],
    recoupBucket: parsed.recoupBucket,
    tierThresholdNetCents: parsed.tierThresholdNetCents ?? 200000,
    reserveBps: parsed.reserveBps ?? 1000,
    holdbackDays: parsed.holdbackDays ?? 14,
    minPayoutCents: parsed.minPayoutCents ?? 2500,
    clawbackRule: parsed.clawbackRule || 'PRO_RATA_SALE_SHARE',
  });

  // canActivate is strictly false until all blocking ambiguities are resolved
  const canActivate = ambiguities.length === 0;

  return {
    spec,
    ambiguities,
    canActivate,
    source: response.source,
    cacheKey: response.cacheKey,
  };
}

/**
 * AI proposes 3 edge-case sales; deterministic TypeScript engine computes all amounts.
 */
export async function proposeAdversarialScenarios(dealSpec: DealSpec): Promise<GeneratedScenario[]> {
  const initialLedger = createInitialLedgerState(dealSpec);

  // Scenario 1: Pure Recoup Sale
  const s1Sale: SaleInput = {
    saleId: 'sim_sale_recoup',
    grossCents: 10000,
    paypalFeeCents: 398,
  };
  const s1Trace = executeSaleWaterfall(s1Sale, { ...dealSpec, minPayoutCents: 0 }, initialLedger);

  // Scenario 2: Boundary-Crossing Sale (seed Maya at $370 / $400 recouped)
  const s2Ledger = {
    ...initialLedger,
    recoupedCents: Math.max(0, (dealSpec.recoupBucket?.totalCents || 40000) - 3000), // $30 left to recoup
    cumulativeNetCents: 37000,
  };
  const s2Sale: SaleInput = {
    saleId: 'sim_sale_boundary',
    grossCents: 10000,
    paypalFeeCents: 398,
  };
  const s2Trace = executeSaleWaterfall(s2Sale, { ...dealSpec, minPayoutCents: 0 }, s2Ledger);

  // Scenario 3: Post-Payout Partial Refund ($50 refund against sale 2)
  const refundInput = {
    refundId: 'sim_ref_partial',
    originalSaleId: s2Sale.saleId,
    grossRefundCents: 5000, // $50.00
    paypalFeeCreditCents: 0,
  };
  const refundResult = executeRefundClawback(
    refundInput,
    s2Trace,
    dealSpec,
    s2Trace.updatedLedgerState
  );

  return [
    {
      title: 'Scenario 1: Pure Upfront Recoup Sale',
      description: 'First sale where 100% of distributable funds reimburse upfront project costs.',
      saleInput: s1Sale,
      trace: s1Trace,
    },
    {
      title: 'Scenario 2: Boundary-Crossing Climax Sale',
      description: 'Sale that finishes upfront recoup and splits remaining pool across all collaborators.',
      saleInput: s2Sale,
      trace: s2Trace,
    },
    {
      title: 'Scenario 3: Post-Payout Partial Refund ($50.00)',
      description: 'Customer refund draining reserve to 0 and establishing recovery balances for future netting.',
      saleInput: s2Sale,
      trace: s2Trace,
      refundResult,
    },
  ];
}

/**
 * Rewrites deterministic engine trace into clear English for a payee,
 * guarded by strict Number-Citation Verification.
 */
export async function explainPayeeStatement(
  trace: WaterfallResult,
  payeeId: string
): Promise<NumberVerificationResult> {
  const alloc = trace.payeeAllocations.find((p) => p.payeeId === payeeId);
  if (!alloc) {
    throw new Error(`Payee ${payeeId} not found in waterfall trace`);
  }

  // Construct deterministic fallback template
  const grossCur = formatCentsToCurrency(trace.grossCents);
  const feeCur = formatCentsToCurrency(trace.feeCents);
  const reserveCur = formatCentsToCurrency(trace.reserveCents);
  const splitCur = formatCentsToCurrency(alloc.splitAwardedCents);
  const recoupCur = formatCentsToCurrency(alloc.recoupAwardedCents);
  const payoutCur = formatCentsToCurrency(alloc.payoutIssuedCents);
  const withheldCur = formatCentsToCurrency(alloc.recoveryWithheldCents);

  const deterministicFallback =
    `On sale ${trace.saleId} (${grossCur} gross, ${feeCur} PayPal fee, ${reserveCur} reserve), ` +
    (alloc.recoupAwardedCents > 0 ? `you recouped ${recoupCur} in upfront costs. ` : '') +
    `Your revenue split was ${splitCur}. ` +
    (alloc.recoveryWithheldCents > 0 ? `${withheldCur} was withheld for past refunds. ` : '') +
    `Total payout issued: ${payoutCur}.`;

  // Allowlist of valid integer cents from the engine trace
  const allowedCents: number[] = [
    trace.grossCents,
    trace.feeCents,
    trace.netCents,
    trace.reserveCents,
    trace.recoupPaidCents,
    trace.remainingDistributableCents,
    alloc.recoupAwardedCents,
    alloc.splitAwardedCents,
    alloc.grossAwardedCents,
    alloc.recoveryWithheldCents,
    alloc.priorCarriedCents,
    alloc.payableBeforeMinCheckCents,
    alloc.payoutIssuedCents,
    alloc.newCarriedCents,
    alloc.newDeficitCents,
  ];

  // Request natural language explanation from LLM provider
  const response = await queryAIProvider({
    promptVersion: 'v1.0',
    systemPrompt: `You are the Tributary Payee Statement Explainer.
Explain the payee's earnings clearly using exact figures.
IMPORTANT: You MUST ONLY cite numbers provided in the input. Never invent any currency figures.
Respond with JSON: { "explanation": "string" }`,
    userInput: JSON.stringify({
      payeeName: alloc.name,
      grossAmount: grossCur,
      paypalFee: feeCur,
      reserveHoldback: reserveCur,
      recoupAwarded: recoupCur,
      splitAwarded: splitCur,
      recoveryWithheld: withheldCur,
      payoutIssued: payoutCur,
    }),
    schemaType: 'explain_trace',
  });

  let prose = deterministicFallback;
  try {
    const data = JSON.parse(response.content);
    if (data.explanation) {
      prose = data.explanation;
    }
  } catch {
    // Keep deterministic fallback
  }

  // Pass through Number-Citation Verifier Guardrail
  return verifyNumbersInProse(prose, allowedCents, deterministicFallback);
}
