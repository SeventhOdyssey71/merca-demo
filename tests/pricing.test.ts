import { describe, it, expect } from 'vitest';
import {
  POST_REGISTRATION_PREMIUM_PPM,
  PPM,
} from '../src/merca/constants.js';
import {
  buyoutSplit,
  hierarchyPoolForPrice,
  nextResalePremiumPpm,
  postRegistrationPremiumPpm,
  prevResalePremiumPpm,
  quotePriceFromPremium,
  registrationSplit,
  sellerProceedsForPrice,
  treasuryFeeForPrice,
} from '../src/merca/pricing.js';

describe('post-registration premium', () => {
  it('is 2.95× (2_950_000 ppm) per the protocol docs', () => {
    expect(postRegistrationPremiumPpm()).toBe(2_950_000n);
    expect(POST_REGISTRATION_PREMIUM_PPM).toBe(2_950_000n);
  });
});

describe('buyout split (85/7/8)', () => {
  const cases = [
    1_000n,
    1_000_000n,
    1_000_000_000n,
    123_456_789n,
    999_999_999_999n,
  ];

  it.each(cases)(
    'seller + treasury + hierarchy ≈ price (≤ 3 MIST rounding) for %d MIST',
    (price) => {
      const split = buyoutSplit(price);
      const sum = split.seller + split.treasury + split.hierarchy;
      // BigInt floor on three BPS divisions can lose up to 3 MIST. The Move
      // implementation handles the residual the same way; this is by design.
      expect(sum <= price).toBe(true);
      expect(price - sum <= 3n).toBe(true);
    },
  );

  it('matches each accessor', () => {
    const p = 100_000_000n;
    expect(sellerProceedsForPrice(p)).toBe((p * 8500n) / 10_000n);
    expect(treasuryFeeForPrice(p)).toBe((p * 700n) / 10_000n);
    expect(hierarchyPoolForPrice(p)).toBe((p * 800n) / 10_000n);
  });

  it('zero price → all zeros', () => {
    expect(buyoutSplit(0n)).toEqual({ seller: 0n, treasury: 0n, hierarchy: 0n });
  });
});

describe('registration split (92/8)', () => {
  it('treasury + hierarchy ≈ price (≤ 2 MIST rounding)', () => {
    const p = 1_000_000n;
    const r = registrationSplit(p);
    const sum = r.treasury + r.hierarchy;
    expect(sum <= p).toBe(true);
    expect(p - sum <= 2n).toBe(true);
    expect(r.treasury).toBe((p * 9200n) / 10_000n);
    expect(r.hierarchy).toBe((p * 800n) / 10_000n);
  });
});

describe('quotePriceFromPremium', () => {
  it('scales linearly with premium', () => {
    const area = 1_000n; // m²
    const rate = 1_000_000n; // mist per km² × 1e6 — placeholder
    const a = quotePriceFromPremium(area, rate, PPM); // 1.0×
    const b = quotePriceFromPremium(area, rate, 2n * PPM); // 2.0×
    expect(b).toBeGreaterThan(a);
    // 2× input → 2× output (within ceiling rounding of 1)
    expect(b - 2n * a >= -1n && b - 2n * a <= 1n).toBe(true);
  });

  it('zero area or zero rate → zero', () => {
    expect(quotePriceFromPremium(0n, 1_000_000n, PPM)).toBe(0n);
    expect(quotePriceFromPremium(1_000n, 0n, PPM)).toBe(0n);
  });
});

describe('resale ladder', () => {
  it('next is strictly greater than current', () => {
    const p = postRegistrationPremiumPpm();
    expect(nextResalePremiumPpm(p, 0n)).toBeGreaterThan(p);
  });

  it('prev × ladder ≈ original (floor / ceil rounding)', () => {
    const p = postRegistrationPremiumPpm();
    const next = nextResalePremiumPpm(p, 0n);
    const back = prevResalePremiumPpm(next, 1n);
    // Ceiling on the way up + floor on the way down → can drift by ≤ 1 ppm.
    expect(back >= p - 1n && back <= p).toBe(true);
  });

  it('ladder is monotone over many steps', () => {
    let p = postRegistrationPremiumPpm();
    for (let i = 0; i < 16; i++) {
      const n = nextResalePremiumPpm(p, BigInt(i));
      expect(n).toBeGreaterThan(p);
      p = n;
    }
  });
});
