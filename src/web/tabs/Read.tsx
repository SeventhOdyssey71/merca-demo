import { useState } from 'react';
import { Section } from '../components/Section.js';
import { Stat } from '../components/Stat.js';
import { Tag } from '../components/Tag.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { ParcelCard } from '../components/ParcelCard.js';
import { useMarketState } from '../hooks/useMarketState.js';
import { useParcel } from '../hooks/useParcel.js';
import { formatSui } from '@merca/format';
import { LEVELS, MARKET_ID, MERCATR_MARKET_PKG } from '@merca/constants';

const BLOCK_INDEX = LEVELS.find((l) => l.key === 'block')!;

const READ_MARKET_SNIPPET = `// Raw @mysten/sui — no wrapper. One devInspect, two return values.
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

// Permanent addresses from docs.merca.earth/reference/deployed-contracts
const MARKET_PKG = '${MERCATR_MARKET_PKG}';
const MARKET_ID  = '${MARKET_ID}';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const tx = new Transaction();
tx.moveCall({ target: \`\${MARKET_PKG}::market::is_paused\`,
              arguments: [tx.object(MARKET_ID)] });
tx.moveCall({ target: \`\${MARKET_PKG}::market::treasury_balance\`,
              arguments: [tx.object(MARKET_ID)] });

const res = await client.devInspectTransactionBlock({
  transactionBlock: tx, sender: '0x0',
});

const paused   = bcs.bool().parse(Uint8Array.from(res.results![0].returnValues![0][0]));
const treasury = BigInt(bcs.u64().parse(Uint8Array.from(res.results![1].returnValues![0][0])));`;

const READ_PARCEL_SNIPPET = `// Quote a parcel: premium × sale-count × current buyout, all in one trip.
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';

// One Index per cadastral level — Block is the deepest (zoom 15-22).
const BLOCK_INDEX_ID = '${BLOCK_INDEX.indexId}';

const tx = new Transaction();
tx.moveCall({
  target: \`${MERCATR_MARKET_PKG}::trading::current_price\`,
  arguments: [tx.object('${MARKET_ID}'), tx.object(BLOCK_INDEX_ID), tx.pure.id(parcelId)],
});

const res = await client.devInspectTransactionBlock({ transactionBlock: tx, sender: '0x0' });
const priceMist = BigInt(bcs.u64().parse(Uint8Array.from(res.results![0].returnValues![0][0])));`;

export function Read() {
  const { market, levels, error, loading } = useMarketState();
  const [parcelInput, setParcelInput] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const parcelQuery = useParcel(submittedId);

  return (
    <>
      <Section
        title="Market state"
        blurb="One devInspect call against the singleton market — no signature, no funds, real chain state."
      >
        {error && (
          <pre style={{ color: 'var(--warn)' }}>read failed: {error}</pre>
        )}
        <div className="grid-3">
          <Stat
            label="Status"
            value={
              loading ? '…' : market?.paused ? <Tag tone="warn">paused</Tag> : <Tag tone="live">live</Tag>
            }
          />
          <Stat
            label="Treasury"
            value={
              loading || !market
                ? '…'
                : `${formatSui(market.treasuryMist, 4)} SUI`
            }
            sub={market ? `${market.treasuryMist.toString()} MIST` : undefined}
          />
          <Stat
            label="Total parcels"
            value={
              loading || !levels
                ? '…'
                : levels
                    .reduce((a, l) => a + l.parcelCount, 0n)
                    .toString()
            }
          />
        </div>

        <div style={{ height: 16 }} />
        <CodeBlock code={READ_MARKET_SNIPPET} lang="ts" />
      </Section>

      <Section
        title="Parcel counts per level"
        blurb="Each level is a separate shared Index object. We chain six index::count calls in one devInspect tx."
      >
        <div className="grid-fit fade-in-stagger">
          {levels?.map((l) => (
            <Stat
              key={l.levelKey}
              label={l.levelKey}
              value={l.parcelCount.toString()}
              sub={`cell ${l.cellSize.toString()} · depth ${l.maxDepth}`}
            />
          ))}
          {loading && !levels && <p className="muted">loading levels…</p>}
        </div>
      </Section>

      <Section
        title="Look up a parcel"
        blurb="Paste a polygon ID. We try each level in turn, then call premium_ppm, sale_count, and trading::current_price in one roundtrip."
      >
        <form
          className="lookup-form"
          onSubmit={(e) => {
            e.preventDefault();
            const v = parcelInput.trim();
            if (v.startsWith('0x') && v.length >= 4) setSubmittedId(v);
          }}
        >
          <input
            placeholder="0x…"
            value={parcelInput}
            onChange={(e) => setParcelInput(e.target.value)}
          />
          <button className="primary" type="submit" disabled={!parcelInput.trim()}>
            Look up
          </button>
        </form>

        {parcelQuery.loading && (
          <p className="muted" style={{ marginTop: 16 }}>
            searching levels…
          </p>
        )}
        {parcelQuery.error && (
          <pre style={{ color: 'var(--warn)', marginTop: 16 }}>{parcelQuery.error}</pre>
        )}
        {parcelQuery.parcel && (
          <div style={{ marginTop: 24 }}>
            <ParcelCard parcel={parcelQuery.parcel} />
          </div>
        )}

        <div style={{ height: 16 }} />
        <CodeBlock code={READ_PARCEL_SNIPPET} lang="ts" />
      </Section>
    </>
  );
}
