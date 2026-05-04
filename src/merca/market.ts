import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import type { SuiClient } from '@mysten/sui/client';
import {
  LEVELS,
  MARKET_ID,
  MERCATR_MARKET_PKG,
  MERCATR_PKG,
  type LevelKey,
} from './constants.js';
import { getClient } from './client.js';
import type { LevelIndexStats, MarketView } from './types.js';

const READ_SENDER = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Read the cheap-to-fetch market state via devInspect. No tx, no signature.
 *
 * For richer fields (per-level rates, price-per-km², tax config) the
 * authoritative source is `current_price` / `quote_bump_cost` per parcel.
 */
export async function readMarketState(client: SuiClient = getClient()): Promise<MarketView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${MERCATR_MARKET_PKG}::market::is_paused`,
    arguments: [tx.object(MARKET_ID)],
  });
  tx.moveCall({
    target: `${MERCATR_MARKET_PKG}::market::treasury_balance`,
    arguments: [tx.object(MARKET_ID)],
  });

  const res = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: READ_SENDER,
  });

  if (res.error) throw new Error(`market read failed: ${res.error}`);
  const calls = res.results ?? [];
  const paused = decodeBool(calls[0]?.returnValues?.[0]?.[0]);
  const treasuryMist = decodeU64(calls[1]?.returnValues?.[0]?.[0]);

  return {
    marketId: MARKET_ID,
    paused,
    treasuryMist,
    // Per-level pricing requires walking the Versioned MarketInner's `levels`
    // vector. Devs who need it: read the parcel's price via current_price().
    levels: [],
  };
}

/**
 * Read each level's index counters. One devInspect tx with six chained calls.
 * Returns `parcelCount`, `cellSize`, `maxDepth` per level.
 */
export async function readLevelStats(
  client: SuiClient = getClient(),
): Promise<LevelIndexStats[]> {
  const tx = new Transaction();
  for (const lvl of LEVELS) {
    tx.moveCall({
      target: `${MERCATR_PKG}::index::count`,
      arguments: [tx.object(lvl.indexId)],
    });
    tx.moveCall({
      target: `${MERCATR_PKG}::index::cell_size`,
      arguments: [tx.object(lvl.indexId)],
    });
    tx.moveCall({
      target: `${MERCATR_PKG}::index::max_depth`,
      arguments: [tx.object(lvl.indexId)],
    });
  }

  const res = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: READ_SENDER,
  });
  if (res.error) throw new Error(`level stats read failed: ${res.error}`);

  const r = res.results ?? [];
  const out: LevelIndexStats[] = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const base = i * 3;
    out.push({
      levelKey: LEVELS[i].key,
      indexId: LEVELS[i].indexId,
      parcelCount: decodeU64(r[base + 0]?.returnValues?.[0]?.[0]),
      cellSize: decodeU64(r[base + 1]?.returnValues?.[0]?.[0]),
      maxDepth: Number(decodeU8(r[base + 2]?.returnValues?.[0]?.[0])),
    });
  }
  return out;
}

/**
 * Quote a parcel's market state in a single roundtrip.
 *
 * Calls `current_price(market, index, id)`, `premium_ppm(market, id)`,
 * `sale_count(market, id)` and decodes them.
 */
export async function readParcelMarketState(
  polygonId: string,
  level: LevelKey,
  client: SuiClient = getClient(),
): Promise<{ premiumPpm: bigint; saleCount: bigint; currentPriceMist: bigint }> {
  const lvl = LEVELS.find((l) => l.key === level);
  if (!lvl) throw new Error(`unknown level: ${level}`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${MERCATR_MARKET_PKG}::market::premium_ppm`,
    arguments: [tx.object(MARKET_ID), tx.pure.id(polygonId)],
  });
  tx.moveCall({
    target: `${MERCATR_MARKET_PKG}::market::sale_count`,
    arguments: [tx.object(MARKET_ID), tx.pure.id(polygonId)],
  });
  tx.moveCall({
    target: `${MERCATR_MARKET_PKG}::trading::current_price`,
    arguments: [tx.object(MARKET_ID), tx.object(lvl.indexId), tx.pure.id(polygonId)],
  });

  const res = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: READ_SENDER,
  });
  if (res.error) throw new Error(`parcel market state read failed: ${res.error}`);

  const r = res.results ?? [];
  return {
    premiumPpm: decodeU64(r[0]?.returnValues?.[0]?.[0]),
    saleCount: decodeU64(r[1]?.returnValues?.[0]?.[0]),
    currentPriceMist: decodeU64(r[2]?.returnValues?.[0]?.[0]),
  };
}

/* ── BCS decoders ────────────────────────────────────────────────────────── */

function toBytes(input: number[] | Uint8Array | undefined): Uint8Array {
  if (!input) throw new Error('missing return value bytes');
  return input instanceof Uint8Array ? input : Uint8Array.from(input);
}

function decodeBool(input: number[] | Uint8Array | undefined): boolean {
  return bcs.bool().parse(toBytes(input));
}

function decodeU8(input: number[] | Uint8Array | undefined): bigint {
  return BigInt(bcs.u8().parse(toBytes(input)));
}

function decodeU64(input: number[] | Uint8Array | undefined): bigint {
  return BigInt(bcs.u64().parse(toBytes(input)));
}
