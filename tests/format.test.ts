import { describe, it, expect } from 'vitest';
import {
  formatArea,
  formatPremium,
  formatSui,
  parseSui,
  relativeTime,
  shortAddr,
} from '../src/merca/format.js';
import { MIST_PER_SUI } from '../src/merca/constants.js';

describe('formatSui', () => {
  it('handles zero', () => {
    expect(formatSui(0n)).toBe('0');
  });

  it('drops trailing zeros', () => {
    expect(formatSui(MIST_PER_SUI)).toBe('1');
    expect(formatSui(MIST_PER_SUI + 100_000_000n)).toBe('1.1');
  });

  it('preserves precision up to maxDecimals', () => {
    expect(formatSui(123_456_789n, 6)).toBe('0.123456');
    expect(formatSui(123_456_789n, 9)).toBe('0.123456789');
  });

  it('handles negatives', () => {
    expect(formatSui(-MIST_PER_SUI)).toBe('-1');
  });

  it('handles values larger than 2^53', () => {
    const huge = (1n << 60n) + 1n;
    const s = formatSui(huge);
    expect(s.length).toBeGreaterThan(0);
    expect(parseSui(s)).toBeLessThanOrEqual(huge);
  });
});

describe('parseSui', () => {
  it('round-trips', () => {
    for (const s of ['0', '1', '0.1', '12.34', '0.000000001']) {
      expect(formatSui(parseSui(s), 9)).toBe(s);
    }
  });

  it('rejects garbage', () => {
    expect(() => parseSui('abc')).toThrow();
    expect(() => parseSui('1.2.3')).toThrow();
  });

  it('truncates beyond 9 decimals', () => {
    expect(parseSui('0.1234567899')).toBe(123_456_789n);
  });
});

describe('shortAddr', () => {
  it('shortens long hex strings', () => {
    const a = '0x' + 'ab'.repeat(32);
    expect(shortAddr(a)).toMatch(/^0xabab…/);
    expect(shortAddr(a)).toContain('…');
  });

  it('passes through short strings unchanged', () => {
    expect(shortAddr('0x1234')).toBe('0x1234');
  });
});

describe('formatPremium', () => {
  it('renders 1.0× cleanly', () => {
    expect(formatPremium(1_000_000n)).toBe('1×');
  });

  it('renders 2.95× as expected', () => {
    expect(formatPremium(2_950_000n)).toBe('2.95×');
  });

  it('handles values below 1×', () => {
    expect(formatPremium(500_000n)).toBe('0.50×');
  });
});

describe('formatArea', () => {
  it('inserts thousands', () => {
    expect(formatArea(1_234_567n)).toBe('1,234,567 m²');
    expect(formatArea(0n)).toBe('0 m²');
  });
});

describe('relativeTime', () => {
  it('formats sub-minute deltas', () => {
    const now = 1_000_000_000_000;
    expect(relativeTime(now - 5_000, now)).toBe('5s ago');
    expect(relativeTime(now - 90_000, now)).toBe('1m ago');
    expect(relativeTime(null, now)).toBe('—');
  });
});
