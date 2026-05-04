# Architecture walkthrough

This is the deeper-dive companion to the README. It explains *why* the demo's helpers
look the way they do, so you can adapt them in your own app.

## The protocol surface

merca.earth's on-chain layer is two Move packages and a small set of shared objects.

```
mercatr                            mercatr_market
├── core/index   ──────────┐       ├── trading      register, buy_full, bump, drop
├── core/metadata          │       ├── parcel_ops   expand, acquire, rebalance, split, merge
├── core/admin             │       ├── marks        paid reactions
├── geometry/{aabb, sat,   │       ├── proposals    POI proposal board
│            polygon,      │       ├── pricing      pure math (mirrored in src/merca/pricing.ts)
│            topology}     │       ├── revenue      internal payment routing
└── math/{morton, signed}  │       ├── tax          deferred tax buckets
                           ↓
                  six shared `Index` objects     one shared `Market`     MarkBoard, ProposalBoard
                  (Block, District, City,        (treasury, levels,
                   Region, Country, Continent)    capabilities, pause)
```

The split is enforced by capabilities. `mercatr_market` holds a `LifecycleCap` and a
`TransferCap` minted by `mercatr::admin`; the spatial engine never touches money, the
market never bypasses geometry validation.

For full surface area, see <https://docs.merca.earth/reference/api>.

## Reading without indexers

Every read in this demo goes through `devInspectTransactionBlock`. It runs a PTB against
current chain state, returns the BCS-encoded results of any Move calls inside, and costs
nothing — no signature, no gas.

That makes the read story very small:

```ts
const tx = new Transaction();
tx.moveCall({
  target: `${MERCATR_MARKET_PKG}::market::treasury_balance`,
  arguments: [tx.object(MARKET_ID)],
});
const res = await client.devInspectTransactionBlock({ transactionBlock: tx, sender: '0x0' });
const treasuryMist = bcs.u64().parse(Uint8Array.from(res.results![0].returnValues![0][0]));
```

You can chain six `index::count` calls into one inspect for a whole-protocol counter
sweep, or chain `premium_ppm` + `sale_count` + `trading::current_price` for a complete
parcel quote in one roundtrip. See `src/merca/market.ts` and `src/merca/parcels.ts`.

When you do want to surface raw object state (e.g. for a UI that walks the polygons
table directly), `client.getObject` and `client.getDynamicFieldObject` are the paths.
The `Market` is wrapped in `sui::versioned::Versioned`, so reading its inner fields by
hand requires loading the inner dynamic field — an example for the curious.

## Building transactions

Every PTB in this demo follows the same shape:

1. `splitCoins(tx.gas, [amount])` for the payment.
2. `moveCall` into the appropriate market function.
3. `mergeCoins(tx.gas, [leftover])` for the unspent change.

That last step matters. The `trading::*` functions return a `Coin<SUI>` of leftover
payment that **must be consumed**, or the PTB fails to type-check. Merging it back into
`tx.gas` is the cleanest pattern — no recipient address required at build time, no
extra UTXO created.

```ts
const tx = new Transaction();
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);
const [leftover] = tx.moveCall({
  target: `${MERCATR_MARKET_PKG}::trading::buy_full`,
  arguments: [tx.object(MARKET_ID), tx.object(indexId), tx.pure.id(polygonId), coin],
});
tx.mergeCoins(tx.gas, [leftover]);
```

The wallet sets the sender at sign time. Ownership-gated calls (`bump_price`,
`drop_price`) abort with `ENotOwner` if the sender isn't the parcel's current owner —
which is exactly what you want for a public demo: the simulation tells you whether
you're allowed to do the thing, before you spend a single MIST.

## Activity without a custom indexer

`recentActivity` in `src/merca/activity.ts` uses one fullnode call:

```ts
client.queryTransactionBlocks({
  filter: { MoveFunction: { package: MERCATR_MARKET_PKG } },
  options: { showInput: true },
  order: 'descending',
  limit,
});
```

The filter is package-scoped, not module-scoped, so we get every market call in one
sweep. We then walk the PTB inputs to classify each tx by its first MoveCall and pick
out the polygon ID heuristically (the first pure `address`/`ID` input that isn't the
market itself or one of the known indexes).

For real-time UIs, the same filter works with `client.subscribeTransaction` (websocket),
or you can switch to `client.queryEvents({ query: { MoveEventModule: { package, module } } })`
for an event-stream view. The protocol does emit on-chain events (e.g. `Registered`
from `mercatr::index`).

## Pricing, mirrored locally

`src/merca/pricing.ts` is a pure-TypeScript port of `mercatr_market::pricing`. It lets
the UI quote a parcel's buyout price *and* a hypothetical next-rung price without a
roundtrip. The split constants (85/7/8 on buyouts, 92/8 on registrations) live there
too.

The on-chain `trading::current_price` is the authority. Treat the local module as a
preview — never as the source of truth for a payment.

## Where to extend

- **Geometry rendering.** `mercatr::index::query_viewport` returns parcel IDs by AABB.
  Pair it with `mercatr::index::get` (or pull the polygons table dynamic fields) to
  draw shapes.
- **Tax flow.** `market::collect_tax` and `market::sweep_expired` aren't covered by
  this demo. Both are public and can be exposed as PTB builders the same way as
  `trading::*`.
- **POI proposals.** `proposals::propose_poi` / `accept_proposal` would slot in
  alongside `marks::mark` — same pattern, same dry-run path.
