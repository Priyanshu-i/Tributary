import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  DealSpec,
  LedgerState,
  SaleInput,
  RefundInput,
  DealSpecSchema,
} from '../types.js';
import {
  executeSaleWaterfall,
  executeRefundClawback,
  createInitialLedgerState,
  allocatePoolByBpsLargestRemainder,
  InvariantViolationError,
} from '../waterfall.js';

describe('Phase 1: Pure Integer-Cent Waterfall & Refund Clawback Engine', () => {
  // Standard Team Moonlit Deal Spec from SPEC.md
  const moonlitDealSpec: DealSpec = {
    dealId: 'deal_moonlit_v1',
    version: 1,
    title: 'Moonlit Indie Game Revenue Share',
    sha256Hash: 'a'.repeat(64),
    payees: [
      { id: 'maya', name: 'Maya Lin', email: 'maya@example.com', tier1Bps: 4000, tier2Bps: 2500 },
      { id: 'arjun', name: 'Arjun Rao', email: 'arjun@example.com', tier1Bps: 3000, tier2Bps: 2500 },
      { id: 'lina', name: 'Lina Chen', email: 'lina@example.com', tier1Bps: 2000, tier2Bps: 2500 },
      { id: 'dev', name: 'Dev Patel', email: 'dev@example.com', tier1Bps: 1000, tier2Bps: 2500 },
    ],
    recoupBucket: {
      payeeId: 'maya',
      totalCents: 40000, // $400.00 upfront art cost
      feeBasis: 'NET_OF_FEES',
    },
    tierThresholdNetCents: 200000, // $2,000.00 net revenue threshold
    reserveBps: 1000, // 10% reserve holdback
    holdbackDays: 14,
    minPayoutCents: 2500, // $25.00 minimum payout threshold
    clawbackRule: 'PRO_RATA_SALE_SHARE',
  };

  it('validates Moonlit DealSpec with Zod schema', () => {
    const parsed = DealSpecSchema.parse(moonlitDealSpec);
    expect(parsed.dealId).toBe('deal_moonlit_v1');
    expect(parsed.payees).toHaveLength(4);
  });

  describe('1. Exact Demo Climax Test (SPEC.md Section 12)', () => {
    it('executes boundary-crossing sale: $370/$400 recouped + $100 sale with $3.98 fee', () => {
      // Seed Maya at $370 recouped of $400 total
      const initialLedger: LedgerState = {
        cumulativeNetCents: 37000,
        recoupedCents: 37000,
        availableReserveCents: 0,
        payeeLedgers: {
          maya: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 37000, totalPaidCents: 37000 },
          arjun: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
          lina: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
          dev: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
        },
      };

      const sale: SaleInput = {
        saleId: 'sale_demo_climax',
        grossCents: 10000, // $100.00
        paypalFeeCents: 398, // $3.98
      };

      // Set minPayoutCents to 0 for this isolated split verification to check raw item amounts
      const dealWithZeroMin: DealSpec = {
        ...moonlitDealSpec,
        minPayoutCents: 0,
      };

      const trace = executeSaleWaterfall(sale, dealWithZeroMin, initialLedger);

      // Assertions matching SPEC.md Section 12 exactly
      expect(trace.grossCents).toBe(10000);
      expect(trace.feeCents).toBe(398);
      expect(trace.feeSource).toBe('PAYPAL_ACTUAL');
      expect(trace.netCents).toBe(9602);
      expect(trace.reserveCents).toBe(960);
      expect(trace.distributableCents).toBe(8642);

      // Maya Recoup completion: exactly 3000 cents ($30.00)
      expect(trace.recoupPaidCents).toBe(3000);
      expect(trace.recoupPayeeId).toBe('maya');

      // Remaining distributable pool D1 = 8642 - 3000 = 5642
      expect(trace.remainingDistributableCents).toBe(5642);

      // Split 40/30/20/10 of 5642 cents: 2257 / 1693 / 1128 / 564
      const mayaAlloc = trace.payeeAllocations.find((p) => p.payeeId === 'maya')!;
      const arjunAlloc = trace.payeeAllocations.find((p) => p.payeeId === 'arjun')!;
      const linaAlloc = trace.payeeAllocations.find((p) => p.payeeId === 'lina')!;
      const devAlloc = trace.payeeAllocations.find((p) => p.payeeId === 'dev')!;

      expect(mayaAlloc.splitAwardedCents).toBe(2257);
      expect(arjunAlloc.splitAwardedCents).toBe(1693);
      expect(linaAlloc.splitAwardedCents).toBe(1128);
      expect(devAlloc.splitAwardedCents).toBe(564);

      // Total earnings / payouts
      expect(mayaAlloc.grossAwardedCents).toBe(5257); // 3000 recoup + 2257 split
      expect(arjunAlloc.grossAwardedCents).toBe(1693);
      expect(linaAlloc.grossAwardedCents).toBe(1128);
      expect(devAlloc.grossAwardedCents).toBe(564);

      // Conservation Invariant:
      // 5257 + 1693 + 1128 + 564 + 960 (reserve) + 398 (fee) === 10000
      const totalAllocated =
        mayaAlloc.payoutIssuedCents +
        arjunAlloc.payoutIssuedCents +
        linaAlloc.payoutIssuedCents +
        devAlloc.payoutIssuedCents +
        trace.reserveCents +
        trace.feeCents;

      expect(totalAllocated).toBe(10000);
      expect(trace.invariantVerified).toBe(true);

      // Check updated ledger state
      expect(trace.updatedLedgerState.recoupedCents).toBe(40000); // 100% recouped!
      expect(trace.updatedLedgerState.availableReserveCents).toBe(960);
      expect(trace.updatedLedgerState.cumulativeNetCents).toBe(37000 + 9602);
    });
  });

  describe('2. Follow-up $50 Refund Test (Reserve Drain + Recovery Balance Netting)', () => {
    it('drains 960 cent reserve to 0, allocates remaining 4040 deficit, and nets on next sale', () => {
      // Step A: Run the $100 sale first to establish trace and ledger
      const initialLedger: LedgerState = {
        cumulativeNetCents: 37000,
        recoupedCents: 37000,
        availableReserveCents: 0,
        payeeLedgers: {
          maya: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 37000, totalPaidCents: 37000 },
          arjun: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
          lina: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
          dev: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
        },
      };

      const saleTrace = executeSaleWaterfall(
        { saleId: 'sale_1', grossCents: 10000, paypalFeeCents: 398 },
        { ...moonlitDealSpec, minPayoutCents: 0 },
        initialLedger
      );

      expect(saleTrace.updatedLedgerState.availableReserveCents).toBe(960);

      // Step B: Post-payout refund of $50.00 (5000 cents)
      const refund: RefundInput = {
        refundId: 'ref_1',
        originalSaleId: 'sale_1',
        grossRefundCents: 5000,
        paypalFeeCreditCents: 0,
      };

      const refundResult = executeRefundClawback(
        refund,
        saleTrace,
        moonlitDealSpec,
        saleTrace.updatedLedgerState
      );

      // 1. Reserve drains from 960 to 0
      expect(refundResult.reserveAbsorbedCents).toBe(960);
      expect(refundResult.updatedLedgerState.availableReserveCents).toBe(0);

      // 2. Remaining deficit is 5000 - 960 = 4040 cents
      expect(refundResult.remainingDeficitCents).toBe(4040);

      // 3. Allocated pro-rata according to original sale earnings (5257, 1693, 1128, 564)
      const mayaDeficit = refundResult.payeeClawbacks.find((c) => c.payeeId === 'maya')!.clawbackCents;
      const arjunDeficit = refundResult.payeeClawbacks.find((c) => c.payeeId === 'arjun')!.clawbackCents;
      const linaDeficit = refundResult.payeeClawbacks.find((c) => c.payeeId === 'lina')!.clawbackCents;
      const devDeficit = refundResult.payeeClawbacks.find((c) => c.payeeId === 'dev')!.clawbackCents;

      // Sum of payee clawbacks must equal remaining deficit (4040 cents)
      expect(mayaDeficit + arjunDeficit + linaDeficit + devDeficit).toBe(4040);
      expect(refundResult.reserveAbsorbedCents + (mayaDeficit + arjunDeficit + linaDeficit + devDeficit)).toBe(5000);

      expect(mayaDeficit).toBe(1616);
      expect(arjunDeficit).toBe(1212);
      expect(linaDeficit).toBe(808);
      expect(devDeficit).toBe(404);

      // Step C: Subsequent $100 sale nets out these deficits automatically!
      const subsequentSaleTrace = executeSaleWaterfall(
        { saleId: 'sale_2', grossCents: 10000, paypalFeeCents: 398 },
        { ...moonlitDealSpec, minPayoutCents: 0 },
        refundResult.updatedLedgerState
      );

      // In this sale, recoup is already 100% done, so full D0 = 8642 splits 40/30/20/10
      // Maya gross awarded: 3457 cents. Withheld: 1616 cents. Net payout: 1841 cents.
      const mayaSubsequent = subsequentSaleTrace.payeeAllocations.find((p) => p.payeeId === 'maya')!;
      expect(mayaSubsequent.recoveryWithheldCents).toBe(1616);
      expect(mayaSubsequent.newDeficitCents).toBe(0); // 100% recovered!
      expect(mayaSubsequent.payoutIssuedCents).toBe(mayaSubsequent.grossAwardedCents - 1616);

      // Hard conservation check holds on the recovery netting sale
      expect(subsequentSaleTrace.invariantVerified).toBe(true);
      expect(
        subsequentSaleTrace.feeCents +
        subsequentSaleTrace.reserveCents +
        subsequentSaleTrace.totalPayoutCents +
        subsequentSaleTrace.totalCarriedDeltaCents +
        subsequentSaleTrace.totalWithheldRecoveryCents
      ).toBe(10000);
    });
  });

  describe('3. Minimum Payout Carry & Threshold Straddle Tests', () => {
    it('holds balances below minPayoutCents ($25.00) in carriedForwardCents without losing a cent', () => {
      const initialLedger = createInitialLedgerState(moonlitDealSpec);
      // Run a small $20.00 sale (2000 cents)
      const sale: SaleInput = {
        saleId: 'sale_small',
        grossCents: 2000,
        paypalFeeCents: 119, // $1.19
      };

      const trace = executeSaleWaterfall(sale, moonlitDealSpec, initialLedger);

      // For Maya, recoup + split will exceed $25? Let's check:
      // Net = 2000 - 119 = 1881. Reserve = 188. D0 = 1693. Maya recoup = 1693.
      // Maya gross = $16.93 (< $25.00). Carried forward = 1693, Payout = 0!
      const maya = trace.payeeAllocations.find((p) => p.payeeId === 'maya')!;
      expect(maya.payoutIssuedCents).toBe(0);
      expect(maya.newCarriedCents).toBe(1693);

      // Conservation invariant strictly holds with carried delta
      expect(trace.invariantVerified).toBe(true);
      expect(
        trace.feeCents +
        trace.reserveCents +
        trace.totalPayoutCents +
        trace.totalCarriedDeltaCents +
        trace.totalWithheldRecoveryCents
      ).toBe(2000);
    });

    it('handles single sale straddling the $2,000 net tier threshold cleanly', () => {
      // Prior net: $1,950 (195000 cents). Sale: $100 (net 9602).
      // Crosses threshold at $2,000 (200000 cents).
      const initialLedger: LedgerState = {
        cumulativeNetCents: 195000,
        recoupedCents: 40000, // already recouped
        availableReserveCents: 5000,
        payeeLedgers: {
          maya: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
          arjun: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
          lina: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
          dev: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
        },
      };

      const sale: SaleInput = {
        saleId: 'sale_straddle',
        grossCents: 10000,
        paypalFeeCents: 398,
      };

      const trace = executeSaleWaterfall(sale, { ...moonlitDealSpec, minPayoutCents: 0 }, initialLedger);

      expect(trace.tierApplied).toBe('STRADDLE');
      expect(trace.preTierDistributableCents + trace.postTierDistributableCents).toBe(trace.remainingDistributableCents);
      expect(trace.invariantVerified).toBe(true);
      expect(
        trace.feeCents +
        trace.reserveCents +
        trace.totalPayoutCents +
        trace.totalCarriedDeltaCents +
        trace.totalWithheldRecoveryCents
      ).toBe(10000);
    });
  });

  describe('4. Property-Based Tests (1,000 Randomized Runs via fast-check)', () => {
    it('proves Cent Conservation Invariant across 1,000 randomized sale & deal configurations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 5000000 }), // $1.00 to $50,000.00
          fc.integer({ min: 0, max: 3000 }), // 0% to 30% reserve
          fc.integer({ min: 0, max: 1000000 }), // recoup total up to $10,000
          fc.integer({ min: 0, max: 1000000 }), // already recouped
          fc.integer({ min: 0, max: 10000 }), // 4 weights summing to 10000
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          fc.boolean(), // fee provided or fallback
          (grossCents, reserveBps, recoupTotal, recoupedAlready, w1, w2, w3, useActualFee) => {
            // Generate 4 weights summing to 10000
            const rawWeights = [w1, w2, w3, 10000 - ((w1 + w2 + w3) % 10000)];
            const rawSum = rawWeights.reduce((a, b) => a + b, 0);
            const bps1 = Math.floor((rawWeights[0] * 10000) / rawSum);
            const bps2 = Math.floor((rawWeights[1] * 10000) / rawSum);
            const bps3 = Math.floor((rawWeights[2] * 10000) / rawSum);
            const bps4 = 10000 - (bps1 + bps2 + bps3);

            const testDeal: DealSpec = {
              dealId: 'deal_fuzz',
              version: 1,
              title: 'Fuzz Deal',
              payees: [
                { id: 'p1', name: 'P1', email: 'p1@test.com', tier1Bps: bps1, tier2Bps: 2500 },
                { id: 'p2', name: 'P2', email: 'p2@test.com', tier1Bps: bps2, tier2Bps: 2500 },
                { id: 'p3', name: 'P3', email: 'p3@test.com', tier1Bps: bps3, tier2Bps: 2500 },
                { id: 'p4', name: 'P4', email: 'p4@test.com', tier1Bps: bps4, tier2Bps: 2500 },
              ],
              recoupBucket: {
                payeeId: 'p1',
                totalCents: recoupTotal,
                feeBasis: 'NET_OF_FEES',
              },
              tierThresholdNetCents: 200000,
              reserveBps,
              holdbackDays: 14,
              minPayoutCents: 2500,
              clawbackRule: 'PRO_RATA_SALE_SHARE',
            };

            const initialLedger: LedgerState = {
              cumulativeNetCents: 0,
              recoupedCents: Math.min(recoupTotal, recoupedAlready),
              availableReserveCents: 0,
              payeeLedgers: {
                p1: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
                p2: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
                p3: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
                p4: { carriedForwardCents: 0, recoveryDeficitCents: 0, totalEarnedCents: 0, totalPaidCents: 0 },
              },
            };

            const fee = useActualFee ? Math.floor(grossCents * 0.0349) + 49 : undefined;
            const sale: SaleInput = {
              saleId: 'sale_fuzz',
              grossCents,
              paypalFeeCents: fee,
            };

            const trace = executeSaleWaterfall(sale, testDeal, initialLedger);

            // Hard Conservation Invariant Assertion
            const total =
              trace.feeCents +
              trace.reserveCents +
              trace.totalPayoutCents +
              trace.totalCarriedDeltaCents +
              trace.totalWithheldRecoveryCents;

            return total === grossCents && trace.invariantVerified === true;
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('proves Refund Invariant across 1,000 randomized partial/full refunds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 100000 }), // original gross $1 to $1,000
          fc.integer({ min: 1, max: 100 }), // refund percentage 1% to 100%
          fc.integer({ min: 0, max: 2000 }), // reserve bps
          (grossCents, refundPct, reserveBps) => {
            const deal: DealSpec = {
              dealId: 'deal_prop_refund',
              version: 1,
              title: 'Refund Prop Deal',
              payees: [
                { id: 'p1', name: 'P1', email: 'p1@test.com', tier1Bps: 4000, tier2Bps: 2500 },
                { id: 'p2', name: 'P2', email: 'p2@test.com', tier1Bps: 3000, tier2Bps: 2500 },
                { id: 'p3', name: 'P3', email: 'p3@test.com', tier1Bps: 2000, tier2Bps: 2500 },
                { id: 'p4', name: 'P4', email: 'p4@test.com', tier1Bps: 1000, tier2Bps: 2500 },
              ],
              reserveBps,
              tierThresholdNetCents: 200000,
              holdbackDays: 14,
              minPayoutCents: 0,
              clawbackRule: 'PRO_RATA_SALE_SHARE',
            };

            const initialLedger = createInitialLedgerState(deal);
            const saleTrace = executeSaleWaterfall(
              { saleId: 'sale_orig', grossCents, paypalFeeCents: Math.floor(grossCents * 0.0349) + 49 },
              deal,
              initialLedger
            );

            const refundGross = Math.max(1, Math.floor((grossCents * refundPct) / 100));
            const refundResult = executeRefundClawback(
              { refundId: 'ref_prop', originalSaleId: 'sale_orig', grossRefundCents: refundGross },
              saleTrace,
              deal,
              saleTrace.updatedLedgerState
            );

            const sumClawbacks = refundResult.payeeClawbacks.reduce((a, b) => a + b.clawbackCents, 0);
            return refundResult.reserveAbsorbedCents + sumClawbacks === refundGross && refundResult.invariantVerified;
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});
