import type {
  SuiClient,
  SuiTransactionBlockResponse,
} from "@mysten/sui/client";
import { LEVELS, MARKET_ID, MERCATR_MARKET_PKG } from "./constants.js";
import { getClient } from "./client.js";
import type { Activity, ActivityKind } from "./types.js";

const KNOWN_OBJECTS = new Set<string>([
  MARKET_ID,
  ...LEVELS.map((l) => l.indexId),
]);

/**
 * Recent on-chain activity for the merca.earth protocol.
 *
 * Strategy: ask the fullnode for recent txs whose first MoveCall is in the
 * `mercatr_market` package, then classify each by (module, function).
 *
 * For an extractor that's resilient to indexer outages or downstream renames,
 * call `client.queryEvents` keyed by MoveEventModule instead — the protocol
 * does emit events (e.g. `Registered` from mercatr::index).
 */
export async function recentActivity(
  client: SuiClient = getClient(),
  limit = 25,
): Promise<Activity[]> {
  const page = await client.queryTransactionBlocks({
    filter: { MoveFunction: { package: MERCATR_MARKET_PKG } },
    options: {
      showInput: true,
      showEffects: false,
      showEvents: false,
    },
    order: "descending",
    limit,
  });
  return (page.data ?? []).map(toActivity).filter(Boolean) as Activity[];
}

function toActivity(tx: SuiTransactionBlockResponse): Activity | null {
  const data = tx.transaction?.data;
  if (!data) return null;
  if (data.transaction.kind !== "ProgrammableTransaction") return null;

  const ptb = data.transaction;
  const sender = data.sender;

  // Walk PTB commands and pick the first MoveCall into our market package
  // — that's the user-facing intent for the transaction.
  let primary: MoveCallShape | null = null;
  for (const t of ptb.transactions) {
    const mc = (t as { MoveCall?: MoveCallShape }).MoveCall;
    if (mc && mc.package === MERCATR_MARKET_PKG) {
      primary = mc;
      break;
    }
  }
  if (!primary) return null;

  const { module, function: fn } = primary;
  const polygonId = guessPolygonId(ptb.inputs as SuiInput[]);
  return {
    digest: tx.digest,
    timestampMs: tx.timestampMs ? Number(tx.timestampMs) : null,
    kind: classify(module, fn),
    module,
    function: fn,
    sender,
    polygonId,
  };
}

function classify(module: string, fn: string): ActivityKind {
  if (module === "trading") {
    switch (fn) {
      case "register":
        return "register";
      case "buy_full":
        return "buy_full";
      case "bump_price":
        return "bump_price";
      case "drop_price":
        return "drop_price";
      case "remove":
        return "remove";
    }
  }
  if (module === "marks") {
    if (fn === "mark") return "mark";
    if (fn === "mark_poi") return "mark_poi";
  }
  if (module === "proposals") {
    if (fn === "propose_poi") return "propose_poi";
    if (fn === "accept_proposal") return "accept_proposal";
  }
  if (module === "parcel_ops") {
    switch (fn) {
      case "expand_unclaimed":
        return "expand_unclaimed";
      case "acquire_slice":
        return "acquire_slice";
      case "rebalance_slice":
        return "rebalance_slice";
      case "split_owned":
        return "split_owned";
      case "merge_owned":
        return "merge_owned";
    }
  }
  if (module === "market" && fn === "collect_tax") return "collect_tax";
  return "other";
}

/**
 * Heuristic: scan the tx inputs for a pure `address` that isn't the market
 * itself and isn't one of the known shared indexes. The first such value is
 * usually the polygon ID. Good enough for a public activity feed.
 */
function guessPolygonId(inputs: SuiInput[]): string | null {
  for (const inp of inputs) {
    if (inp.type !== "pure") continue;
    const valueType = inp.valueType ?? "";
    if (valueType !== "address" && !valueType.endsWith("::ID")) continue;
    const v = inp.value as string | undefined;
    if (!v || typeof v !== "string") continue;
    if (!v.startsWith("0x")) continue;
    if (KNOWN_OBJECTS.has(v)) continue;
    return v;
  }
  return null;
}

/* ── Local shapes — minimal subset of SDK types we care about ────────────── */

interface MoveCallShape {
  package: string;
  module: string;
  function: string;
}

interface SuiInput {
  type: "pure" | "object";
  valueType?: string;
  value?: unknown;
  objectType?: string;
  objectId?: string;
}
