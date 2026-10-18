import { describe, it, expect } from 'vitest';
import {
  parseAmountToCents,
  formatCentsToAmount,
  formatCentsToCurrency,
  InvalidAmountError,
} from '../amount-parser.js';

describe('Integer-Cent Amount Parser (Zero Floats for Money)', () => {
  it('1. correctly parses standard two-decimal string "100.00"', () => {
    expect(parseAmountToCents('100.00')).toBe(10000);
  });

  it('2. correctly parses whole dollar string without decimal "100"', () => {
    expect(parseAmountToCents('100')).toBe(10000);
  });

  it('3. correctly parses smallest cent string "0.01"', () => {
    expect(parseAmountToCents('0.01')).toBe(1);
  });

  it('4. correctly parses arbitrary cents "96.02"', () => {
    expect(parseAmountToCents('96.02')).toBe(9602);
  });

  it('5. correctly parses zero string "0.00" and "0"', () => {
    expect(parseAmountToCents('0.00')).toBe(0);
    expect(parseAmountToCents('0')).toBe(0);
  });

  it('6. correctly parses single decimal digit "100.5" as 50 cents', () => {
    expect(parseAmountToCents('100.5')).toBe(10050);
  });

  it('7. handles leading/trailing whitespace gracefully "  49.99  "', () => {
    expect(parseAmountToCents('  49.99  ')).toBe(4999);
  });

  it('8. rejects raw JS numbers / floats to prevent IEEE 754 precision loss', () => {
    expect(() => parseAmountToCents(100.02 as any)).toThrow(InvalidAmountError);
    expect(() => parseAmountToCents(100 as any)).toThrow(InvalidAmountError);
  });

  it('9. rejects negative amount strings "-100.00"', () => {
    expect(() => parseAmountToCents('-100.00')).toThrow(InvalidAmountError);
    expect(() => parseAmountToCents('-0.01')).toThrow(InvalidAmountError);
  });

  it('10. rejects 3 or more decimal places "100.005"', () => {
    expect(() => parseAmountToCents('100.005')).toThrow(InvalidAmountError);
  });

  it('11. rejects alphanumeric and currency symbols "$100.00", "100 USD"', () => {
    expect(() => parseAmountToCents('$100.00')).toThrow(InvalidAmountError);
    expect(() => parseAmountToCents('100 USD')).toThrow(InvalidAmountError);
    expect(() => parseAmountToCents('one hundred')).toThrow(InvalidAmountError);
  });

  it('12. rejects empty strings or whitespace-only strings', () => {
    expect(() => parseAmountToCents('')).toThrow(InvalidAmountError);
    expect(() => parseAmountToCents('   ')).toThrow(InvalidAmountError);
  });

  it('13. rejects multiple decimal points "10.0.0"', () => {
    expect(() => parseAmountToCents('10.0.0')).toThrow(InvalidAmountError);
  });

  it('14. rejects null, undefined, objects, and NaN', () => {
    expect(() => parseAmountToCents(null as any)).toThrow(InvalidAmountError);
    expect(() => parseAmountToCents(undefined as any)).toThrow(InvalidAmountError);
    expect(() => parseAmountToCents({} as any)).toThrow(InvalidAmountError);
    expect(() => parseAmountToCents(NaN as any)).toThrow(InvalidAmountError);
  });

  it('15. correctly formats cents back to amounts and currency representations', () => {
    expect(formatCentsToAmount(10000)).toBe('100.00');
    expect(formatCentsToAmount(9602)).toBe('96.02');
    expect(formatCentsToAmount(1)).toBe('0.01');
    expect(formatCentsToAmount(0)).toBe('0.00');
    expect(formatCentsToCurrency(10000)).toBe('$100.00');
    expect(formatCentsToCurrency(9602)).toBe('$96.02');
    expect(formatCentsToCurrency(1)).toBe('$0.01');
  });

  it('16. correctly formats negative recovery deficits and negative cents', () => {
    expect(formatCentsToAmount(-500)).toBe('-5.00');
    expect(formatCentsToCurrency(-500)).toBe('-$5.00');
  });
});
