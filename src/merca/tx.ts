import { Transaction } from '@mysten/sui/transactions';
import type { SuiClient } from '@mysten/sui/client';
import {
  LEVELS,
  MARK_BOARD,
  MARKET_ID,
  MERCATR_MARKET_PKG,
  type LevelKey,
} from './constants.js';
import { getClient } from './client.js';
import type { DryRunSummary } from './types.js';

const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Default gas budget for sign-and-execute paths, in MIST (0.05 SUI).
 *
 * Setting an explicit budget lets the SDK skip its internal gas-estimation
 * dry-run, which can fail with the same Move abort as the user's PTB and
 * surface as a confusing "Dry run failed, could not automatically determine
 * a budget: …" instead of the underlying error.
 *
 * 50_000_000 MIST is comfortable for any single Move call in this protocol;
 * unused gas is refunded.
 */
export const DEFAULT_GAS_BUDGET_MIST = 50_000_000n;

/* ── PTB builders ────────────────────────────────────────────────────────── */

/**
 * `mercatr_market::marks::mark` — pay a small fee to attach a reaction to a
 * parcel. Anyone can call this on any parcel, which makes it the cleanest
 * end-to-end demo flow.
 *
 * @param mark_type — the on-chain code interprets this as a u8 reaction type.
 * @param amountMist — the payment, in MIST. The `MarkBoard`'s minimum fee is
 *  enforced on-chain; pass a small but non-zero value (e.g. 100_000n).
 */
export function buildMarkTx(args: {
  polygonId: string;
  level: LevelKey;
  markType: number;
  amountMist: bigint;
}): Transaction {
  const lvl = level(args.level);

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(args.amountMist)]);
  tx.moveCall({
    target: `${MERCATR_MARKET_PKG}::marks::mark`,
    arguments: [
      tx.object(MARK_BOARD),
      tx.object(MARKET_ID),
      tx.object(lvl.indexId),
      tx.pure.id(args.polygonId),
      tx.pure.u8(args.markType),
      coin,
    ],
  });
  return tx;
}

/**
 * `mercatr_market::trading::bump_price` — owner-only. Pays to advance the
 * parcel's premium one rung up the resale ladder. Leftover payment coin
 * is merged back into the gas coin so it lands in the sender's wallet.
 */
export function buildBumpPriceTx(args: {
  polygonId: string;
  level: LevelKey;
  amountMist: bigint;
}): Transaction {
  return tradingPaymentTx('bump_price', args);
}

/** `mercatr_market::trading::drop_price` — owner-only. Mirror of bump_price. */
export function buildDropPriceTx(args: {
  polygonId: string;
  level: LevelKey;
  amountMist: bigint;
}): Transaction {
  return tradingPaymentTx('drop_price', args);
}

/**
 * `mercatr_market::trading::buy_full` — forced buyout. Splits payment 85%
 * to seller, 7% to treasury, 8% to hierarchy pool. Always dry-run before
 * signing — the real call is irreversible.
 */
export function buildBuyFullTx(args: {
  polygonId: string;
  level: LevelKey;
  amountMist: bigint;
}): Transaction {
  return tradingPaymentTx('buy_full', args);
}

function tradingPaymentTx(
  fn: 'buy_full' | 'bump_price' | 'drop_price',
  args: { polygonId: string; level: LevelKey; amountMist: bigint },
): Transaction {
  const lvl = level(args.level);
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(args.amountMist)]);
  const [leftover] = tx.moveCall({
    target: `${MERCATR_MARKET_PKG}::trading::${fn}`,
    arguments: [
      tx.object(MARKET_ID),
      tx.object(lvl.indexId),
      tx.pure.id(args.polygonId),
      coin,
    ],
  });
  // Merge any unspent payment back into the gas coin; cleaner than transferring
  // to the sender (which would require knowing the sender at build time).
  tx.mergeCoins(tx.gas, [leftover]);
  return tx;
}

/* ── Dry-run helper ──────────────────────────────────────────────────────── */

/**
 * Run `devInspectTransactionBlock` and shape the response into a tidy summary.
 *
 * No funds change hands. No signature is required. The simulation runs
 * against current chain state, so prices and ownership are real.
 *
 * @param sender — the fullnode treats this as the would-be sender. Passing
 *   the zero address works for read-only flows; for tx flows that gate on
 *   ownership (bump_price, drop_price), pass the actual owner's address or
 *   expect the call to abort with `ENotOwner`.
 */
export async function dryRun(
  tx: Transaction,
  sender: string,
  client: SuiClient = getClient(),
): Promise<DryRunSummary> {
  const res = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: sender || ZERO,
  });

  const status = res.effects?.status?.status === 'success' ? 'success' : 'failure';
  const error = res.error ?? res.effects?.status?.error ?? null;
  const gasUsed = sumGas(res.effects?.gasUsed);
  const events = (res.events ?? []).map((e) => ({
    type: e.type,
    parsed: e.parsedJson ?? null,
  }));

  return { status, error, gasUsedMist: gasUsed, events, raw: res };
}

function sumGas(g: GasUsed | undefined): bigint {
  if (!g) return 0n;
  const c = BigInt(g.computationCost ?? 0);
  const s = BigInt(g.storageCost ?? 0);
  const r = BigInt(g.storageRebate ?? 0);
  // Net cost, never negative.
  const net = c + s - r;
  return net < 0n ? 0n : net;
}

interface GasUsed {
  computationCost?: string | number;
  storageCost?: string | number;
  storageRebate?: string | number;
  nonRefundableStorageFee?: string | number;
}

/* ── Internals ───────────────────────────────────────────────────────────── */

function level(key: LevelKey) {
  const lvl = LEVELS.find((l) => l.key === key);
  if (!lvl) throw new Error(`unknown level ${key}`);
  return lvl;
}
