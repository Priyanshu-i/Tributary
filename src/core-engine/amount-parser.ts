/**
 * Tributary Core Engine: Integer-Cent Amount Parser
 * 
 * Invariant: ZERO FLOATS FOR MONEY.
 * Never use `parseFloat(val) * 100` or `Number(val) * 100`.
 * All PayPal currency strings are strictly parsed via regex into exact integer cents.
 */

const CURRENCY_REGEX = /^(\d+)(?:\.(\d{1,2}))?$/;

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(`[InvalidAmountError] ${message}`);
    this.name = 'InvalidAmountError';
  }
}

/**
 * Strict parser converting currency string (e.g., "100.02", "100", "0.01") to integer cents.
 * Rejects floats, numbers, negative strings, exponential notations, and non-conforming formats.
 */
export function parseAmountToCents(amount: unknown): number {
  if (typeof amount !== 'string') {
    throw new InvalidAmountError(
      `Amount must be a string to avoid IEEE 754 precision loss. Received type: ${typeof amount}`
    );
  }

  const trimmed = amount.trim();
  if (!trimmed) {
    throw new InvalidAmountError('Amount string cannot be empty');
  }

  const match = trimmed.match(CURRENCY_REGEX);
  if (!match) {
    throw new InvalidAmountError(
      `Invalid currency format: "${amount}". Must match non-negative currency format like "100.00", "100", or "0.01"`
    );
  }

  const dollarsStr = match[1];
  const centsStr = match[2];

  const dollars = parseInt(dollarsStr, 10);
  if (!Number.isSafeInteger(dollars)) {
    throw new InvalidAmountError(`Dollar amount exceeds safe integer range: "${dollarsStr}"`);
  }

  let cents = 0;
  if (centsStr !== undefined) {
    if (centsStr.length === 1) {
      cents = parseInt(centsStr, 10) * 10;
    } else if (centsStr.length === 2) {
      cents = parseInt(centsStr, 10);
    }
  }

  const totalCents = dollars * 100 + cents;
  if (!Number.isSafeInteger(totalCents)) {
    throw new InvalidAmountError(`Calculated cents exceed safe integer range`);
  }

  return totalCents;
}

/**
 * Formats integer cents into standard 2-decimal string (e.g. 10002 -> "100.02")
 */
export function formatCentsToAmount(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new InvalidAmountError(`Cents must be an integer. Received: ${cents}`);
  }
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  const formatted = `${dollars}.${remainder.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formats integer cents into display currency (e.g. 10002 -> "$100.02")
 */
export function formatCentsToCurrency(cents: number): string {
  const isNegative = cents < 0;
  const absFormatted = formatCentsToAmount(Math.abs(cents));
  return isNegative ? `-$${absFormatted}` : `$${absFormatted}`;
}
