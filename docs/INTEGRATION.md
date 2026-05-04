# Integration recipe

How to drop the merca.earth protocol into your own Sui app — without copying the whole
demo.

## What you need

- Node ≥ 18.18 or any modern bundler (Vite, Next.js, etc.).
- `@mysten/sui` ≥ 1.21.

That's it. There's no merca-specific NPM package — just a handful of public Move
functions and a few permanent object IDs.

## Step 1: copy the constants

`src/merca/constants.ts` in this repo is the authoritative copy. It encodes:

- `MERCATR_PKG`, `MERCATR_MARKET_PKG` — permanent package addresses (always call into
  these; Sui routes to the latest version).
- `MARKET_ID` — the singleton shared market.
- One `Index` object ID per cadastral level (`block` through `continent`).
- `MARK_BOARD`, `PROPOSAL_BOARD`.
- The pricing-math constants (`PPM`, `POST_REGISTRATION_PREMIUM_PPM`).

If you're starting fresh, paste that file into your project. Source of truth:
<https://docs.merca.earth/reference/deployed-contracts>.

## Step 2: pick a read pattern

For most UIs, `devInspect` against the published Move getters is enough:

```ts
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

async function readMarket() {
  const tx = new Transaction();
  tx.moveCall({
    target: `${MERCATR_MARKET_PKG}::market::treasury_balance`,
    arguments: [tx.object(MARKET_ID)],
  });
  tx.moveCall({
    target: `${MERCATR_MARKET_PKG}::market::is_paused`,
    arguments: [tx.object(MARKET_ID)],
  });

  const res = await client.devInspectTransactionBlock({ transactionBlock: tx, sender: '0x0' });
  const treasury = bcs.u64().parse(Uint8Array.from(res.results![0].returnValues![0][0]));
  const paused = bcs.bool().parse(Uint8Array.from(res.results![1].returnValues![0][0]));
  return { treasury: BigInt(treasury), paused };
}
```

If you need to read raw Polygon structs (e.g. to render shapes), use
`client.getDynamicFieldObject` on the index's `polygons` table. The dynamic-field name is
the polygon ID; the value is the on-chain `Polygon` struct.

## Step 3: build a transaction

The pattern is the same for every market function:

```ts
const tx = new Transaction();
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
const [leftover] = tx.moveCall({
  target: `${MERCATR_MARKET_PKG}::trading::buy_full`,
  arguments: [tx.object(MARKET_ID), tx.object(indexId), tx.pure.id(polygonId), coin],
});
tx.mergeCoins(tx.gas, [leftover]);
```

A few rules:

- The level's `Index` is a separate argument from the `Market`. Pick the right one for
  the parcel (or call `findParcelLevel` to discover it).
- `splitCoins` from `tx.gas` always works — the SDK swaps in your gas coin at sign time.
- Always `mergeCoins(tx.gas, [leftover])` for `trading::*` — those functions return
  unspent payment that must be consumed.

## Step 4: simulate before signing

`devInspectTransactionBlock` is the cheapest pre-flight check on Sui. It runs the PTB
against current state, returns gas estimates, balance changes, and any events. No
signature, no fee.

```ts
const sim = await client.devInspectTransactionBlock({
  transactionBlock: tx,
  sender: senderAddress, // even owner-gated calls work — abort surfaces in the result
});

if (sim.effects?.status?.status !== 'success') {
  throw new Error(sim.effects?.status?.error ?? 'simulation failed');
}
```

For ownership-gated calls (`bump_price`, `drop_price`), the simulation will abort with
`ENotOwner` if the sender isn't the parcel owner — easier than chasing the error
yourself.

## Step 5: sign and execute

When you're ready for real:

```ts
const exec = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
  options: { showEffects: true, showEvents: true },
});
```

For browser apps, swap the keypair for `@mysten/dapp-kit`'s `useSignAndExecuteTransaction`
hook. The PTB shape is identical.

## Activity / events

Two paths:

```ts
// All txs that called a function in mercatr_market
client.queryTransactionBlocks({
  filter: { MoveFunction: { package: MERCATR_MARKET_PKG } },
  options: { showInput: true },
  order: 'descending',
});

// Or events emitted by a specific module
client.queryEvents({
  query: { MoveEventModule: { package: MERCATR_MARKET_PKG, module: 'trading' } },
});
```

Both paginate via `cursor`. For live updates, `client.subscribeTransaction` and
`client.subscribeEvent` accept the same filters over websocket.

## Capabilities — what you can't do

These are held by the deploy multisig and are out of scope for integrators:

- `AdminCap` (creates indexes, mints capabilities).
- `MarketAdminCap` (pauses, sets level pricing, configures tax).
- `TransferCap` / `LifecycleCap` (lives inside the `Market`; only callable from
  `mercatr_market`).

Your app works through the public entry points in `mercatr_market::trading`,
`mercatr_market::parcel_ops`, `mercatr_market::marks`, and `mercatr_market::proposals`.
That's the entire integration surface.
