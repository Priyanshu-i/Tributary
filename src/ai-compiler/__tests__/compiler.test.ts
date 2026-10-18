import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { compileAndInterrogate, proposeAdversarialScenarios, explainPayeeStatement } from '../compiler.js';
import { verifyNumbersInProse } from '../number-verifier.js';
import { computeCacheKey } from '../provider.js';
import { DealSpec } from '../../core-engine/types.js';

describe('Phase 4: Neuro-Symbolic AI Compiler, Citation Verifier & Replay Cache', () => {
  const moonlitAgreement = `
    Team Moonlit sells an indie adventure game. Maya fronted a $400 art cost and must be repaid first from sales.
    After Maya is repaid, all revenue splits 40% to Maya, 30% to Arjun, 20% to Lina, and 10% to Dev.
    Once total net revenue hits $2,000, the split changes to an even 25% each.
    Hold 10% for refunds for 14 days, and only pay out when someone has at least $25.
  `;

  describe('1. Agreement Compilation & Blocking Clarifications', () => {
    it('compiles agreement, extracts DealSpec, and identifies blocking ambiguities', async () => {
      const res = await compileAndInterrogate(moonlitAgreement);

      expect(res.spec.dealId).toBeDefined();
      expect(res.spec.payees).toHaveLength(4);
      expect(res.spec.recoupBucket?.totalCents).toBe(40000); // $400.00
      expect(res.spec.tierThresholdNetCents).toBe(200000); // $2,000.00
      expect(res.spec.reserveBps).toBe(1000); // 10%

      // Ambiguities must be identified
      expect(res.ambiguities.length).toBeGreaterThan(0);
      // canActivate must be strictly false while ambiguities remain
      expect(res.canActivate).toBe(false);
    });

    it('unlocks canActivate when all clarification questions are answered', async () => {
      const clarifications = {
        ambiguity_recoup_fee_basis: 'NET_OF_FEES',
        ambiguity_clawback_rule: 'PRO_RATA_SALE_SHARE',
        ambiguity_tier_basis: 'NET_REVENUE',
      };

      const res = await compileAndInterrogate(moonlitAgreement, clarifications);

      expect(res.spec.recoupBucket?.feeBasis).toBe('NET_OF_FEES');
      expect(res.spec.clawbackRule).toBe('PRO_RATA_SALE_SHARE');
      expect(res.ambiguities).toHaveLength(0);
      expect(res.canActivate).toBe(true);
    });
  });

  describe('2. Adversarial Scenario Proposal (Deterministic Calculation)', () => {
    it('proposes 3 boundary scenarios and uses pure integer engine for all math', async () => {
      const testDeal: DealSpec = {
        dealId: 'deal_moonlit_scenarios',
        version: 1,
        title: 'Moonlit Indie Game',
        payees: [
          { id: 'maya', name: 'Maya Lin', email: 'maya@example.com', tier1Bps: 4000, tier2Bps: 2500 },
          { id: 'arjun', name: 'Arjun Rao', email: 'arjun@example.com', tier1Bps: 3000, tier2Bps: 2500 },
          { id: 'lina', name: 'Lina Chen', email: 'lina@example.com', tier1Bps: 2000, tier2Bps: 2500 },
          { id: 'dev', name: 'Dev Patel', email: 'dev@example.com', tier1Bps: 1000, tier2Bps: 2500 },
        ],
        recoupBucket: { payeeId: 'maya', totalCents: 40000, feeBasis: 'NET_OF_FEES' },
        tierThresholdNetCents: 200000,
        reserveBps: 1000,
        holdbackDays: 14,
        minPayoutCents: 2500,
        clawbackRule: 'PRO_RATA_SALE_SHARE',
      };

      const scenarios = await proposeAdversarialScenarios(testDeal);

      expect(scenarios).toHaveLength(3);
      // Scenario 1: Pure recoup
      expect(scenarios[0].trace.recoupPaidCents).toBeGreaterThan(0);
      expect(scenarios[0].trace.invariantVerified).toBe(true);

      // Scenario 2: Boundary sale
      expect(scenarios[1].trace.recoupPaidCents).toBe(3000); // exactly finishes recoup
      expect(scenarios[1].trace.invariantVerified).toBe(true);

      // Scenario 3: Partial refund
      expect(scenarios[2].refundResult).toBeDefined();
      expect(scenarios[2].refundResult?.reserveAbsorbedCents).toBe(960);
      expect(scenarios[2].refundResult?.remainingDeficitCents).toBe(4040);
      expect(scenarios[2].refundResult?.invariantVerified).toBe(true);
    });
  });

  describe('3. Number-Citation Verifier Guardrail', () => {
    it('accepts prose citing verified numbers from engine trace', () => {
      const allowedCents = [10000, 398, 9602, 960, 3000, 2257, 5257];
      const validProse = 'Your total payout for this sale is $52.57, including $30.00 recoup and $22.57 share.';

      const result = verifyNumbersInProse(validProse, allowedCents, 'Safe fallback.');
      expect(result.verified).toBe(true);
      expect(result.isFallback).toBe(false);
      expect(result.unverifiedTokens).toHaveLength(0);
      expect(result.foundDollarTokens).toEqual(['$52.57', '$30.00', '$22.57']);
    });

    it('strictly REJECTS hallucinated dollar figure $999.99 and triggers deterministic template fallback', () => {
      const allowedCents = [10000, 398, 9602, 960, 5257];
      const hallucinatedProse = 'Congratulations, your bonus payout is $999.99!';
      const fallbackTemplate = 'Your verified payout is $52.57.';

      const result = verifyNumbersInProse(hallucinatedProse, allowedCents, fallbackTemplate);
      expect(result.verified).toBe(false);
      expect(result.isFallback).toBe(true);
      expect(result.unverifiedTokens).toContain('$999.99');
      expect(result.prose).toBe(fallbackTemplate);
      expect(result.fallbackReason).toContain('Hallucinated currency amount(s) detected: $999.99');
    });

    it('runs explainPayeeStatement end-to-end with verifier guarantee', async () => {
      const scenarios = await proposeAdversarialScenarios({
        dealId: 'deal_explain_test',
        version: 1,
        title: 'Explain Test Deal',
        payees: [
          { id: 'maya', name: 'Maya Lin', email: 'maya@example.com', tier1Bps: 4000, tier2Bps: 2500 },
          { id: 'arjun', name: 'Arjun Rao', email: 'arjun@example.com', tier1Bps: 3000, tier2Bps: 2500 },
          { id: 'lina', name: 'Lina Chen', email: 'lina@example.com', tier1Bps: 2000, tier2Bps: 2500 },
          { id: 'dev', name: 'Dev Patel', email: 'dev@example.com', tier1Bps: 1000, tier2Bps: 2500 },
        ],
        recoupBucket: { payeeId: 'maya', totalCents: 40000, feeBasis: 'NET_OF_FEES' },
        tierThresholdNetCents: 200000,
        reserveBps: 1000,
        holdbackDays: 14,
        minPayoutCents: 0,
        clawbackRule: 'PRO_RATA_SALE_SHARE',
      });

      // Explain Maya's statement on boundary sale
      const trace = scenarios[1].trace;
      const statement = await explainPayeeStatement(trace, 'maya');

      expect(statement.verified).toBe(true);
      expect(statement.unverifiedTokens).toHaveLength(0);
      expect(statement.prose).toContain('$52.57');
    });
  });

  describe('4. Zero-Key Offline Replay Mode', () => {
    const originalApiKey = process.env.GEMINI_API_KEY;
    const originalOffline = process.env.OFFLINE_REPLAY_ONLY;

    beforeEach(() => {
      process.env.GEMINI_API_KEY = '';
      process.env.OFFLINE_REPLAY_ONLY = 'true';
    });

    afterEach(() => {
      process.env.GEMINI_API_KEY = originalApiKey;
      process.env.OFFLINE_REPLAY_ONLY = originalOffline;
    });

    it('compiles agreements deterministically with zero API keys', async () => {
      const res = await compileAndInterrogate('Team Moonlit adventure game Maya $400 art cost 40/30/20/10');
      expect(res.spec.dealId).toBeDefined();
      expect(res.spec.payees).toHaveLength(4);
      expect(['OFFLINE_FALLBACK', 'REPLAY_CACHE']).toContain(res.source);
    });

    it('generates consistent SHA-256 cache keys', () => {
      const k1 = computeCacheKey('v1', 'system prompt', 'user input text');
      const k2 = computeCacheKey('v1', 'system prompt', 'user input text');
      const k3 = computeCacheKey('v2', 'system prompt', 'user input text');

      expect(k1).toBe(k2);
      expect(k1).not.toBe(k3);
      expect(k1).toHaveLength(64);
    });
  });
});
