import { parseAmountToCents, formatCentsToCurrency } from '../core-engine/amount-parser.js';

export interface NumberVerificationResult {
  verified: boolean;
  prose: string;
  foundDollarTokens: string[];
  unverifiedTokens: string[];
  isFallback: boolean;
  fallbackReason?: string;
}

/**
 * Regex identifying dollar currency tokens: $100.00, $100, $0.52, -$5.00
 */
const DOLLAR_TOKEN_REGEX = /-?\$([0-9]+(?:\.[0-9]{1,2})?)/g;

/**
 * Strict Number-Citation Verifier Guardrail.
 * Scans every dollar figure in the LLM-generated prose.
 * Converts each figure to integer cents and asserts it exists in the deterministic trace allowlist.
 * If the model hallucinates even a single unverified dollar amount, the prose is strictly rejected.
 */
export function verifyNumbersInProse(
  prose: string,
  allowedCents: number[],
  deterministicFallback: string
): NumberVerificationResult {
  const allowedSet = new Set<number>(allowedCents.map((c) => Math.abs(c)));
  // Always allow 0 cents
  allowedSet.add(0);

  const foundDollarTokens: string[] = [];
  const unverifiedTokens: string[] = [];

  let match: RegExpExecArray | null;
  const regex = new RegExp(DOLLAR_TOKEN_REGEX);

  while ((match = regex.exec(prose)) !== null) {
    const rawToken = match[0];
    const amountPart = match[1];
    foundDollarTokens.push(rawToken);

    try {
      const cents = parseAmountToCents(amountPart);
      if (!allowedSet.has(cents)) {
        unverifiedTokens.push(rawToken);
      }
    } catch {
      unverifiedTokens.push(rawToken);
    }
  }

  if (unverifiedTokens.length > 0) {
    return {
      verified: false,
      prose: deterministicFallback,
      foundDollarTokens,
      unverifiedTokens,
      isFallback: true,
      fallbackReason: `Hallucinated currency amount(s) detected: ${unverifiedTokens.join(', ')} not present in engine trace.`,
    };
  }

  return {
    verified: true,
    prose,
    foundDollarTokens,
    unverifiedTokens: [],
    isFallback: false,
  };
}
