/**
 * Pure-TypeScript port of `mercatr_market::pricing`.
 *
 * Re-implementing on the client lets a UI quote prices without a roundtrip,
 * and lets devs reason about the pricing ladder offline. For authoritative
 * quoting (e.g. before submitting a buyout) call the on-chain helpers:
 *
 *   - mercatr_market::trading::current_price
 *   - mercatr_market::trading::quote_bump_cost
 *   - mercatr_market::trading::quote_drop_cost
 *
 * via devInspectTransactionBlock.
 *
 * All math is BigInt. Premiums are stored as ppm (parts-per-million);
 * 1.0× = 1_000_000.
 */

import { PPM, POST_REGISTRATION_PREMIUM_PPM } from './constants.js';

/** Price split ratios — match the on-chain constants. */
export const SPLIT_BUYOUT = {
  sellerBps: 8500n, // 85%
  treasuryBps: 700n, // 7%
  hierarchyBps: 800n, // 8%
} as const;

export const SPLIT_REGISTRATION = {
  treasuryBps: 9200n, // 92%
  hierarchyBps: 800n, // 8%
} as const;

const BPS = 10_000n;

/** post_registration_premium_ppm() — first resale starts at 2.95×. */
export function postRegistrationPremiumPpm(): bigint {
  return POST_REGISTRATION_PREMIUM_PPM;
}

/**
 * Quote the buyout price for a parcel, given its physical area, the level rate,
 * and its current premium.
 *
 *   price = area × rate / 1e6 × premium / 1e6
 *
 * Note: the level rate `price_per_km2_mist` is itself "per km² in MIST scaled
 * by 10^6", per the docs. We use it as-is — the math here mirrors Move source.
 */
export function quotePriceFromPremium(
  areaM2: bigint,
  pricePerKm2Mist: bigint,
  premiumPpm: bigint,
): bigint {
  // Round up at each division step to match Move's ceiling semantics on resale
  // ladder math.
  const a = (areaM2 * pricePerKm2Mist + (PPM - 1n)) / PPM;
  return (a * premiumPpm + (PPM - 1n)) / PPM;
}

/** 85% of price (rounded down) goes to the seller in a buyout. */
export function sellerProceedsForPrice(price: bigint): bigint {
  return (price * SPLIT_BUYOUT.sellerBps) / BPS;
}

/** 7% of price → treasury. */
export function treasuryFeeForPrice(price: bigint): bigint {
  return (price * SPLIT_BUYOUT.treasuryBps) / BPS;
}

/** 8% of price → hierarchy pool. */
export function hierarchyPoolForPrice(price: bigint): bigint {
  return (price * SPLIT_BUYOUT.hierarchyBps) / BPS;
}

/**
 * Resale ladder. Each successful buyout advances `premium_ppm` to the next rung.
 * The ladder is geometric with a per-step multiplier; we mirror the on-chain
 * ratio (~1.5×) by stepping on `sale_idx`.
 *
 * The ladder is a public projection — the on-chain pricing module is the
 * authority. Use this for UI hints; cross-check with `quote_bump_cost`.
 */
const LADDER_NUM = 3n; // 1.5× per step
const LADDER_DEN = 2n;

export function nextResalePremiumPpm(currentPremiumPpm: bigint, _saleIdx: bigint): bigint {
  return ceilDiv(currentPremiumPpm * LADDER_NUM, LADDER_DEN);
}

export function prevResalePremiumPpm(
  currentPremiumPpm: bigint,
  _currentSaleCount: bigint,
): bigint {
  // Inverse of nextResalePremiumPpm, floored.
  return (currentPremiumPpm * LADDER_DEN) / LADDER_NUM;
}

function ceilDiv(num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new Error('ceilDiv: non-positive denominator');
  return (num + den - 1n) / den;
}

/** Convenience: full split for a buyout price. */
export function buyoutSplit(price: bigint): {
  seller: bigint;
  treasury: bigint;
  hierarchy: bigint;
} {
  return {
    seller: sellerProceedsForPrice(price),
    treasury: treasuryFeeForPrice(price),
    hierarchy: hierarchyPoolForPrice(price),
  };
}

/** Convenience: full split for a registration price (no seller). */
export function registrationSplit(price: bigint): { treasury: bigint; hierarchy: bigint } {
  return {
    treasury: (price * SPLIT_REGISTRATION.treasuryBps) / BPS,
    hierarchy: (price * SPLIT_REGISTRATION.hierarchyBps) / BPS,
  };
}
