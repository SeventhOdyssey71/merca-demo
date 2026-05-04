import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import type { SuiClient } from '@mysten/sui/client';
import {
  LEVELS,
  MERCATR_PKG,
  type LevelInfo,
  type LevelKey,
} from './constants.js';
import { getClient } from './client.js';
import { readParcelMarketState } from './market.js';
import type { ParcelView } from './types.js';

const READ_SENDER = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Run `mercatr::index::query_viewport` against one level. Returns the polygon
 * IDs whose AABBs touch the rectangle. Coordinates are in the protocol's
 * fixed-point world space (the index's own scaling — see Architecture).
 */
export async function queryViewport(
  level: LevelKey,
  rect: { minX: bigint; minY: bigint; maxX: bigint; maxY: bigint },
  client: SuiClient = getClient(),
): Promise<string[]> {
  const lvl = pickLevel(level);

  const tx = new Transaction();
  tx.moveCall({
    target: `${MERCATR_PKG}::index::query_viewport`,
    arguments: [
      tx.object(lvl.indexId),
      tx.pure.u64(rect.minX),
      tx.pure.u64(rect.minY),
      tx.pure.u64(rect.maxX),
      tx.pure.u64(rect.maxY),
    ],
  });

  const res = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: READ_SENDER,
  });
  if (res.error) throw new Error(`query_viewport failed: ${res.error}`);

  const bytes = res.results?.[0]?.returnValues?.[0]?.[0];
  if (!bytes) return [];
  // The function returns vector<ID>. ID is a 32-byte address under BCS.
  return bcs.vector(bcs.Address).parse(toUint8Array(bytes)) as string[];
}

/**
 * Read parcels for IDs that all live on the same `Index` level.
 * Each call goes through `readParcelMarketState`, which is one devInspect
 * roundtrip per parcel — fine for a UI demo, batch externally if you need
 * thousands.
 */
export async function readParcel(
  polygonId: string,
  level: LevelKey,
  client: SuiClient = getClient(),
): Promise<ParcelView> {
  const lvl = pickLevel(level);
  const market = await readParcelMarketState(polygonId, level, client);
  return {
    polygonId,
    levelKey: lvl.key,
    indexId: lvl.indexId,
    market,
  };
}

/**
 * Try every level in turn until we find the one that hosts this polygon.
 * Useful when a dev pastes an ID and we don't know the level yet.
 */
export async function findParcelLevel(
  polygonId: string,
  client: SuiClient = getClient(),
): Promise<LevelKey | null> {
  for (const lvl of LEVELS) {
    try {
      await readParcelMarketState(polygonId, lvl.key, client);
      return lvl.key;
    } catch {
      // Polygon isn't in this index — try the next level.
    }
  }
  return null;
}

function pickLevel(key: LevelKey): LevelInfo {
  const lvl = LEVELS.find((l) => l.key === key);
  if (!lvl) throw new Error(`unknown level ${key}`);
  return lvl;
}

function toUint8Array(input: number[] | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : Uint8Array.from(input);
}
