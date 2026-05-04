import type { LevelKey } from './constants.js';

/** A snapshot of the shared market object — the cheap useful subset. */
export interface MarketView {
  marketId: string;
  paused: boolean;
  treasuryMist: bigint;
  /** Per-level pricing entries from `Market.levels`. */
  levels: LevelPricing[];
}

export interface LevelPricing {
  levelKey: LevelKey;
  indexId: string;
  pricePerKm2Mist: bigint;
  minAreaM2: bigint;
  maxAreaM2: bigint;
}

/** Index-side counters for one cadastral level. */
export interface LevelIndexStats {
  levelKey: LevelKey;
  indexId: string;
  parcelCount: bigint;
  cellSize: bigint;
  maxDepth: number;
}

/** A parcel's market-side state. */
export interface ParcelMarketState {
  premiumPpm: bigint;
  saleCount: bigint;
  /** Buyout price in MIST = area × rate / 1e6 × premium / 1e6. */
  currentPriceMist: bigint;
}

/** Everything a UI needs to render a parcel row. */
export interface ParcelView {
  polygonId: string;
  levelKey: LevelKey;
  indexId: string;
  market: ParcelMarketState;
}

export type ActivityKind =
  | 'register'
  | 'buy_full'
  | 'bump_price'
  | 'drop_price'
  | 'mark'
  | 'mark_poi'
  | 'propose_poi'
  | 'accept_proposal'
  | 'expand_unclaimed'
  | 'acquire_slice'
  | 'rebalance_slice'
  | 'split_owned'
  | 'merge_owned'
  | 'collect_tax'
  | 'remove'
  | 'other';

export interface Activity {
  digest: string;
  timestampMs: number | null;
  kind: ActivityKind;
  module: string;
  function: string;
  sender: string;
  /** First polygon ID we can find in the tx inputs, if any. */
  polygonId: string | null;
}

export interface DryRunSummary {
  status: 'success' | 'failure';
  error: string | null;
  gasUsedMist: bigint;
  events: Array<{ type: string; parsed: unknown }>;
  /** Raw response — devs can dig deeper. */
  raw: unknown;
}
