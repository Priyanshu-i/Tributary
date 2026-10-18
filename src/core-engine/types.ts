import { z } from 'zod';

export const ClawbackRuleSchema = z.enum([
  'PRO_RATA_SALE_SHARE',
  'ACTIVE_TIER_WEIGHTS',
]);
export type ClawbackRule = z.infer<typeof ClawbackRuleSchema>;

export const FeeBasisSchema = z.enum(['NET_OF_FEES', 'GROSS']);
export type FeeBasis = z.infer<typeof FeeBasisSchema>;

export const PayeeSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  tier1Bps: z.number().int().min(0).max(10000),
  tier2Bps: z.number().int().min(0).max(10000),
});
export type PayeeSpec = z.infer<typeof PayeeSpecSchema>;

export const RecoupBucketSchema = z.object({
  payeeId: z.string().min(1),
  totalCents: z.number().int().nonnegative(),
  feeBasis: FeeBasisSchema.default('NET_OF_FEES'),
});
export type RecoupBucket = z.infer<typeof RecoupBucketSchema>;

export const DealSpecSchema = z
  .object({
    dealId: z.string().min(1),
    version: z.number().int().positive().default(1),
    title: z.string().min(1).default('Revenue Share Agreement'),
    sha256Hash: z.string().length(64).optional(),
    payees: z.array(PayeeSpecSchema).min(1),
    recoupBucket: RecoupBucketSchema.optional(),
    tierThresholdNetCents: z.number().int().nonnegative().default(200000), // $2,000.00
    reserveBps: z.number().int().min(0).max(10000).default(1000), // 10%
    holdbackDays: z.number().int().nonnegative().default(14),
    minPayoutCents: z.number().int().nonnegative().default(2500), // $25.00
    clawbackRule: ClawbackRuleSchema.default('PRO_RATA_SALE_SHARE'),
  })
  .refine(
    (spec) => {
      const sumTier1 = spec.payees.reduce((acc, p) => acc + p.tier1Bps, 0);
      return sumTier1 === 10000;
    },
    { message: 'Tier 1 basis points across all payees must sum to exactly 10000 (100%)' }
  )
  .refine(
    (spec) => {
      const sumTier2 = spec.payees.reduce((acc, p) => acc + p.tier2Bps, 0);
      return sumTier2 === 10000;
    },
    { message: 'Tier 2 basis points across all payees must sum to exactly 10000 (100%)' }
  );
export type DealSpec = z.infer<typeof DealSpecSchema>;

export interface PayeeLedgerState {
  carriedForwardCents: number;
  recoveryDeficitCents: number;
  totalEarnedCents: number;
  totalPaidCents: number;
}

export interface LedgerState {
  cumulativeNetCents: number;
  recoupedCents: number;
  availableReserveCents: number;
  payeeLedgers: Record<string, PayeeLedgerState>;
}

export interface SaleInput {
  saleId: string;
  grossCents: number;
  paypalFeeCents?: number;
  customId?: string;
  timestamp?: string;
}

export interface PayeeWaterfallAllocation {
  payeeId: string;
  name: string;
  email: string;
  tier1Bps: number;
  tier2Bps: number;
  recoupAwardedCents: number;
  splitAwardedCents: number;
  grossAwardedCents: number;
  recoveryWithheldCents: number;
  priorCarriedCents: number;
  payableBeforeMinCheckCents: number;
  payoutIssuedCents: number;
  newCarriedCents: number;
  newDeficitCents: number;
}

export interface WaterfallResult {
  saleId: string;
  grossCents: number;
  feeCents: number;
  feeSource: 'PAYPAL_ACTUAL' | 'FALLBACK_SCHEDULE';
  netCents: number;
  reserveCents: number;
  distributableCents: number;
  recoupPaidCents: number;
  recoupPayeeId?: string;
  remainingDistributableCents: number;
  tierApplied: 1 | 2 | 'STRADDLE';
  preTierDistributableCents: number;
  postTierDistributableCents: number;
  payeeAllocations: PayeeWaterfallAllocation[];
  totalPayoutCents: number;
  totalWithheldRecoveryCents: number;
  totalCarriedDeltaCents: number;
  updatedLedgerState: LedgerState;
  auditSummary: string;
  invariantVerified: boolean;
}

export interface RefundInput {
  refundId: string;
  originalSaleId: string;
  grossRefundCents: number;
  paypalFeeCreditCents?: number;
  timestamp?: string;
}

export interface RefundResult {
  refundId: string;
  originalSaleId: string;
  netDebitCents: number;
  reserveAbsorbedCents: number;
  remainingDeficitCents: number;
  clawbackRule: ClawbackRule;
  payeeClawbacks: Array<{
    payeeId: string;
    clawbackCents: number;
    newDeficitCents: number;
  }>;
  updatedLedgerState: LedgerState;
  invariantVerified: boolean;
}
