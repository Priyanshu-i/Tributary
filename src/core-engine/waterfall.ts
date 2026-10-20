import {
  DealSpec,
  LedgerState,
  SaleInput,
  WaterfallResult,
  RefundInput,
  RefundResult,
  PayeeWaterfallAllocation,
} from './types.js';

export class InvariantViolationError extends Error {
  public details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(`[InvariantViolationError] ${message} | Context: ${JSON.stringify(details)}`);
    this.name = 'InvariantViolationError';
    this.details = details;
  }
}

/**
 * Largest-Remainder Method (Hamilton-Hare) for integer-cent distribution.
 * Guarantees zero floating-point cents lost or created.
 * Deterministic tie-breaking is strictly based on payee index (0, 1, 2, 3...).
 */
export function allocatePoolByBpsLargestRemainder(
  poolCents: number,
  bpsWeights: number[]
): number[] {
  if (poolCents === 0) {
    return bpsWeights.map(() => 0);
  }
  if (poolCents < 0) {
    throw new InvariantViolationError('Pool cents cannot be negative', { poolCents });
  }

  const totalBps = bpsWeights.reduce((a, b) => a + b, 0);
  if (totalBps !== 10000) {
    throw new InvariantViolationError(
      `Basis points must sum to 10000 (100%). Received sum: ${totalBps}`,
      { bpsWeights, totalBps }
    );
  }

  const n = bpsWeights.length;
  const flooredShares = new Array<number>(n);
  const remainders: Array<{ index: number; remainder: number }> = new Array(n);

  let allocatedSum = 0;

  for (let i = 0; i < n; i++) {
    const bps = bpsWeights[i];
    // Exact integer product
    const product = poolCents * bps;
    const share = Math.floor(product / 10000);
    const rem = product % 10000;

    flooredShares[i] = share;
    remainders[i] = { index: i, remainder: rem };
    allocatedSum += share;
  }

  const leftoverCents = poolCents - allocatedSum;

  if (leftoverCents < 0 || leftoverCents > n) {
    throw new InvariantViolationError('Leftover cents out of valid range', {
      poolCents,
      allocatedSum,
      leftoverCents,
    });
  }

  // Sort descending by remainder; tie-breaker: ascending by index
  remainders.sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }
    return a.index - b.index;
  });

  for (let k = 0; k < leftoverCents; k++) {
    const targetIdx = remainders[k].index;
    flooredShares[targetIdx] += 1;
  }

  // Final sanity assertion
  const finalSum = flooredShares.reduce((a, b) => a + b, 0);
  if (finalSum !== poolCents) {
    throw new InvariantViolationError(
      `Cent allocation mismatch: sum(${finalSum}) !== pool(${poolCents})`,
      { poolCents, finalSum, flooredShares }
    );
  }

  return flooredShares;
}

/**
 * Creates an empty initial ledger state for a given DealSpec
 */
export function createInitialLedgerState(dealSpec: DealSpec): LedgerState {
  const payeeLedgers: LedgerState['payeeLedgers'] = {};
  for (const payee of dealSpec.payees) {
    payeeLedgers[payee.id] = {
      carriedForwardCents: 0,
      recoveryDeficitCents: 0,
      totalEarnedCents: 0,
      totalPaidCents: 0,
    };
  }
  return {
    cumulativeNetCents: 0,
    recoupedCents: 0,
    availableReserveCents: 0,
    payeeLedgers,
  };
}

/**
 * Executes the pure integer-cent waterfall for an individual captured sale.
 * Strictly enforces the 7-step process and hard conservation invariant.
 */
export function executeSaleWaterfall(
  sale: SaleInput,
  dealSpec: DealSpec,
  ledgerState: LedgerState
): WaterfallResult {
  const G = sale.grossCents;
  if (!Number.isInteger(G) || G <= 0) {
    throw new InvariantViolationError(`Gross cents must be a positive integer. Received: ${G}`, { G });
  }

  // STEP 1: PayPal Fee & Net Revenue
  let F: number;
  let feeSource: 'PAYPAL_ACTUAL' | 'FALLBACK_SCHEDULE';

  if (sale.paypalFeeCents !== undefined && Number.isInteger(sale.paypalFeeCents)) {
    F = sale.paypalFeeCents;
    feeSource = 'PAYPAL_ACTUAL';
  } else {
    // Fallback standard PayPal schedule: 3.49% + $0.49
    F = Math.floor((G * 349) / 10000) + 49;
    feeSource = 'FALLBACK_SCHEDULE';
  }

  if (F > G) {
    throw new InvariantViolationError('PayPal fee exceeds gross sale amount', { G, F });
  }

  const N = G - F;

  // STEP 2: Refund Reserve Holdback
  const R = Math.floor((N * dealSpec.reserveBps) / 10000);
  const D0 = N - R;

  // STEP 3: Recoupment Bucket
  let recoupPaid = 0;
  let recoupPayeeId: string | undefined = undefined;

  if (dealSpec.recoupBucket) {
    recoupPayeeId = dealSpec.recoupBucket.payeeId;
    const remainingRecoup = Math.max(
      0,
      dealSpec.recoupBucket.totalCents - ledgerState.recoupedCents
    );
    recoupPaid = Math.min(D0, remainingRecoup);
  }

  const D1 = D0 - recoupPaid;

  // STEP 4: Tier Boundary Split & Allocation
  const priorCumulativeNet = ledgerState.cumulativeNetCents;
  const newCumulativeNet = priorCumulativeNet + N;
  const threshold = dealSpec.tierThresholdNetCents;

  let tierApplied: 1 | 2 | 'STRADDLE';
  let preTierDistributableCents = 0;
  let postTierDistributableCents = 0;
  let splitAwarded: number[];

  if (threshold <= 0 || priorCumulativeNet >= threshold) {
    // Fully in Tier 2
    tierApplied = 2;
    postTierDistributableCents = D1;
    splitAwarded = allocatePoolByBpsLargestRemainder(
      D1,
      dealSpec.payees.map((p) => p.tier2Bps)
    );
  } else if (newCumulativeNet <= threshold) {
    // Fully in Tier 1
    tierApplied = 1;
    preTierDistributableCents = D1;
    splitAwarded = allocatePoolByBpsLargestRemainder(
      D1,
      dealSpec.payees.map((p) => p.tier1Bps)
    );
  } else {
    // Straddles the boundary!
    tierApplied = 'STRADDLE';
    const preTierNet = threshold - priorCumulativeNet;
    const postTierNet = N - preTierNet;

    // Distribute D1 pool strictly proportionally without losing cents
    preTierDistributableCents = Math.floor((D1 * preTierNet) / N);
    postTierDistributableCents = D1 - preTierDistributableCents;

    const preShares = allocatePoolByBpsLargestRemainder(
      preTierDistributableCents,
      dealSpec.payees.map((p) => p.tier1Bps)
    );
    const postShares = allocatePoolByBpsLargestRemainder(
      postTierDistributableCents,
      dealSpec.payees.map((p) => p.tier2Bps)
    );

    splitAwarded = preShares.map((s, idx) => s + postShares[idx]);
  }

  // STEP 5 & 6: Recovery Deficit Netting & Minimum Payout Carry
  const payeeAllocations: PayeeWaterfallAllocation[] = [];
  let totalPayoutCents = 0;
  let totalWithheldRecoveryCents = 0;
  let totalCarriedDeltaCents = 0;

  const nextPayeeLedgers: LedgerState['payeeLedgers'] = {};

  dealSpec.payees.forEach((payee, idx) => {
    const isRecoupPayee = payee.id === recoupPayeeId;
    const recoupAwarded = isRecoupPayee ? recoupPaid : 0;
    const splitAwardedPayee = splitAwarded[idx];
    const grossAwarded = recoupAwarded + splitAwardedPayee;

    const currentPayeeLedger = ledgerState.payeeLedgers[payee.id] || {
      carriedForwardCents: 0,
      recoveryDeficitCents: 0,
      totalEarnedCents: 0,
      totalPaidCents: 0,
    };

    const priorDeficit = currentPayeeLedger.recoveryDeficitCents;
    const priorCarried = currentPayeeLedger.carriedForwardCents;

    // Deduct existing deficit
    const recoveryWithheld = Math.min(grossAwarded, priorDeficit);
    const newDeficit = priorDeficit - recoveryWithheld;
    const earningsAfterRecovery = grossAwarded - recoveryWithheld;

    // Check minimum payout carry
    const payableBeforeMinCheck = earningsAfterRecovery + priorCarried;
    let payoutIssued = 0;
    let newCarried = 0;

    if (payableBeforeMinCheck >= dealSpec.minPayoutCents) {
      payoutIssued = payableBeforeMinCheck;
      newCarried = 0;
    } else {
      payoutIssued = 0;
      newCarried = payableBeforeMinCheck;
    }

    const carriedDelta = newCarried - priorCarried;

    totalPayoutCents += payoutIssued;
    totalWithheldRecoveryCents += recoveryWithheld;
    totalCarriedDeltaCents += carriedDelta;

    payeeAllocations.push({
      payeeId: payee.id,
      name: payee.name,
      email: payee.email,
      tier1Bps: payee.tier1Bps,
      tier2Bps: payee.tier2Bps,
      recoupAwardedCents: recoupAwarded,
      splitAwardedCents: splitAwardedPayee,
      grossAwardedCents: grossAwarded,
      recoveryWithheldCents: recoveryWithheld,
      priorCarriedCents: priorCarried,
      payableBeforeMinCheckCents: payableBeforeMinCheck,
      payoutIssuedCents: payoutIssued,
      newCarriedCents: newCarried,
      newDeficitCents: newDeficit,
    });

    nextPayeeLedgers[payee.id] = {
      carriedForwardCents: newCarried,
      recoveryDeficitCents: newDeficit,
      totalEarnedCents: currentPayeeLedger.totalEarnedCents + grossAwarded,
      totalPaidCents: currentPayeeLedger.totalPaidCents + payoutIssued,
    };
  });

  // STEP 7: Hard Conservation Check
  // Invariant: F + R + sum(payouts) + sum(carriedDelta) + totalWithheldRecovery === G
  const sumCheck =
    F +
    R +
    totalPayoutCents +
    totalCarriedDeltaCents +
    totalWithheldRecoveryCents;

  if (sumCheck !== G) {
    throw new InvariantViolationError(
      `Conservation Invariant Violated! Sum(${sumCheck}) !== Gross(${G}) (Diff: ${sumCheck - G} cents)`,
      {
        grossCents: G,
        feeCents: F,
        reserveCents: R,
        totalPayoutCents,
        totalCarriedDeltaCents,
        totalWithheldRecoveryCents,
        sumCheck,
        diff: sumCheck - G,
      }
    );
  }

  const updatedLedgerState: LedgerState = {
    cumulativeNetCents: newCumulativeNet,
    recoupedCents: ledgerState.recoupedCents + recoupPaid,
    availableReserveCents: ledgerState.availableReserveCents + R,
    payeeLedgers: nextPayeeLedgers,
  };

  const auditSummary =
    `Sale ${sale.saleId}: Gross $${(G / 100).toFixed(2)}, Fee $${(F / 100).toFixed(2)} (${feeSource}), ` +
    `Reserve $${(R / 100).toFixed(2)}, Recoup $${(recoupPaid / 100).toFixed(2)}, Split $${(D1 / 100).toFixed(2)} (${tierApplied}). ` +
    `Payouts: [${payeeAllocations.map((p) => `${p.name}: $${(p.payoutIssuedCents / 100).toFixed(2)}`).join(', ')}]. Conservation: EXACT.`;

  return {
    saleId: sale.saleId,
    grossCents: G,
    feeCents: F,
    feeSource,
    netCents: N,
    reserveCents: R,
    distributableCents: D0,
    recoupPaidCents: recoupPaid,
    recoupPayeeId,
    remainingDistributableCents: D1,
    tierApplied,
    preTierDistributableCents,
    postTierDistributableCents,
    payeeAllocations,
    totalPayoutCents,
    totalWithheldRecoveryCents,
    totalCarriedDeltaCents,
    updatedLedgerState,
    auditSummary,
    invariantVerified: true,
  };
}

/**
 * Executes a post-payout refund clawback against a prior sale.
 * 1. Reserve absorbs first.
 * 2. Any remaining deficit is distributed according to dealSpec.clawbackRule
 *    and added to each payee's recoveryDeficitCents.
 */
export function executeRefundClawback(
  refund: RefundInput,
  originalSaleTrace: WaterfallResult,
  dealSpec: DealSpec,
  ledgerState: LedgerState
): RefundResult {
  const grossRefund = refund.grossRefundCents;
  const feeCredit = refund.paypalFeeCreditCents || 0;
  const netDebit = grossRefund - feeCredit;

  if (netDebit <= 0) {
    throw new InvariantViolationError(`Refund net debit must be positive. Received: ${netDebit}`, {
      grossRefund,
      feeCredit,
      netDebit,
    });
  }

  // 1. Drain Reserve First
  const reserveAbsorbed = Math.min(ledgerState.availableReserveCents, netDebit);
  const remainingDeficit = netDebit - reserveAbsorbed;
  const newAvailableReserve = ledgerState.availableReserveCents - reserveAbsorbed;

  // 2. Allocate Remaining Deficit Across Payees
  const payeeClawbacks: Array<{ payeeId: string; clawbackCents: number; newDeficitCents: number }> = [];
  const nextPayeeLedgers: LedgerState['payeeLedgers'] = { ...ledgerState.payeeLedgers };

  if (remainingDeficit > 0) {
    let allocatedDeficits: number[];

    if (dealSpec.clawbackRule === 'PRO_RATA_SALE_SHARE') {
      // In revenue share contracts, recoupment covers sunken fixed production costs;
      // post-payout deficit clawbacks are apportioned pro-rata to profit split earnings.
      const originalEarnings = originalSaleTrace.payeeAllocations.map(
        (p) => (p.splitAwardedCents ?? Math.max(0, p.grossAwardedCents - (p.recoupAwardedCents || 0)))
      );
      const totalOriginal = originalEarnings.reduce((a, b) => a + b, 0);

      if (totalOriginal > 0) {
        // Largest-Remainder allocation based on original sale earnings
        const n = originalEarnings.length;
        const shares = new Array<number>(n);
        const remainders: Array<{ index: number; remainder: number }> = new Array(n);
        let sumShares = 0;

        for (let i = 0; i < n; i++) {
          const product = remainingDeficit * originalEarnings[i];
          const s = Math.floor(product / totalOriginal);
          const r = product % totalOriginal;
          shares[i] = s;
          remainders[i] = { index: i, remainder: r };
          sumShares += s;
        }

        const leftover = remainingDeficit - sumShares;
        remainders.sort((a, b) => {
          if (b.remainder !== a.remainder) return b.remainder - a.remainder;
          return a.index - b.index;
        });

        for (let k = 0; k < leftover; k++) {
          shares[remainders[k].index] += 1;
        }

        allocatedDeficits = shares;
      } else {
        // Fall back to active tier weights
        allocatedDeficits = allocatePoolByBpsLargestRemainder(
          remainingDeficit,
          dealSpec.payees.map((p) => p.tier1Bps)
        );
      }
    } else {
      // ACTIVE_TIER_WEIGHTS
      const isTier2 =
        dealSpec.tierThresholdNetCents > 0 &&
        ledgerState.cumulativeNetCents >= dealSpec.tierThresholdNetCents;
      const bps = dealSpec.payees.map((p) => (isTier2 ? p.tier2Bps : p.tier1Bps));
      allocatedDeficits = allocatePoolByBpsLargestRemainder(remainingDeficit, bps);
    }

    // Apply to payee ledgers
    dealSpec.payees.forEach((payee, idx) => {
      const clawback = allocatedDeficits[idx];
      const cur = ledgerState.payeeLedgers[payee.id] || {
        carriedForwardCents: 0,
        recoveryDeficitCents: 0,
        totalEarnedCents: 0,
        totalPaidCents: 0,
      };

      const newDeficit = cur.recoveryDeficitCents + clawback;
      payeeClawbacks.push({
        payeeId: payee.id,
        clawbackCents: clawback,
        newDeficitCents: newDeficit,
      });

      nextPayeeLedgers[payee.id] = {
        ...cur,
        recoveryDeficitCents: newDeficit,
      };
    });
  } else {
    // Reserve absorbed 100%
    dealSpec.payees.forEach((payee) => {
      const cur = ledgerState.payeeLedgers[payee.id] || {
        carriedForwardCents: 0,
        recoveryDeficitCents: 0,
        totalEarnedCents: 0,
        totalPaidCents: 0,
      };
      payeeClawbacks.push({
        payeeId: payee.id,
        clawbackCents: 0,
        newDeficitCents: cur.recoveryDeficitCents,
      });
    });
  }

  // Hard Invariant Check on Refund
  const totalClawedBack = payeeClawbacks.reduce((a, b) => a + b.clawbackCents, 0);
  if (reserveAbsorbed + totalClawedBack !== netDebit) {
    throw new InvariantViolationError(
      `Refund conservation mismatch: absorbed(${reserveAbsorbed}) + clawed(${totalClawedBack}) !== netDebit(${netDebit})`,
      { reserveAbsorbed, totalClawedBack, netDebit }
    );
  }

  // Update cumulative revenue state
  const updatedLedgerState: LedgerState = {
    cumulativeNetCents: Math.max(0, ledgerState.cumulativeNetCents - netDebit),
    recoupedCents: ledgerState.recoupedCents,
    availableReserveCents: newAvailableReserve,
    payeeLedgers: nextPayeeLedgers,
  };

  return {
    refundId: refund.refundId,
    originalSaleId: refund.originalSaleId,
    netDebitCents: netDebit,
    reserveAbsorbedCents: reserveAbsorbed,
    remainingDeficitCents: remainingDeficit,
    clawbackRule: dealSpec.clawbackRule,
    payeeClawbacks,
    updatedLedgerState,
    invariantVerified: true,
  };
}
