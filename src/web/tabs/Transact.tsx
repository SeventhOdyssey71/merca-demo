import { useState } from 'react';
import { Section } from '../components/Section.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { Tag } from '../components/Tag.js';
import { DryRunPanel } from '../components/DryRunPanel.js';
import { SignPanel } from '../components/SignPanel.js';
import {
  buildBumpPriceTx,
  buildBuyFullTx,
  buildMarkTx,
  dryRun,
} from '@merca/tx';
import type { LevelKey } from '@merca/constants';
import {
  LEVELS,
  MARK_BOARD,
  MARKET_ID,
  MERCATR_MARKET_PKG,
} from '@merca/constants';
import type { DryRunSummary } from '@merca/types';
import { parseSui } from '@merca/format';

const BLOCK_INDEX = LEVELS.find((l) => l.key === 'block')!;

type Action = 'mark' | 'bump' | 'buy';

const SAMPLE_SENDER = '0x0000000000000000000000000000000000000000000000000000000000000000';

const ADDRS_HEADER = `// Permanent addresses (docs.merca.earth/reference/deployed-contracts)
const MARKET_PKG     = '${MERCATR_MARKET_PKG}';
const MARKET_ID      = '${MARKET_ID}';
const MARK_BOARD     = '${MARK_BOARD}';
const BLOCK_INDEX_ID = '${BLOCK_INDEX.indexId}';
`;

const SNIPPETS: Record<Action, string> = {
  mark: `// marks::mark — paid reaction on any parcel. Anyone can call.
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

${ADDRS_HEADER}
const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const tx = new Transaction();
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1_000_000n)]); // 0.001 SUI
tx.moveCall({
  target: \`\${MARKET_PKG}::marks::mark\`,
  arguments: [
    tx.object(MARK_BOARD),
    tx.object(MARKET_ID),
    tx.object(BLOCK_INDEX_ID),
    tx.pure.id(parcelId),
    tx.pure.u8(1),  // mark_type
    coin,
  ],
});

// Simulate first — no funds, no signature.
const sim = await client.devInspectTransactionBlock({
  transactionBlock: tx, sender: myAddress,
});

// Only sign if simulation succeeded.
if (sim.effects?.status?.status === 'success') {
  await client.signAndExecuteTransaction({ signer: keypair, transaction: tx });
}`,
  bump: `// trading::bump_price — owner-only. Advances the parcel up the resale ladder.
import { Transaction } from '@mysten/sui/transactions';

${ADDRS_HEADER}
const tx = new Transaction();
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(50_000_000n)]); // 0.05 SUI
const [leftover] = tx.moveCall({
  target: \`\${MARKET_PKG}::trading::bump_price\`,
  arguments: [
    tx.object(MARKET_ID),
    tx.object(BLOCK_INDEX_ID),
    tx.pure.id(parcelId),
    coin,
  ],
});
tx.mergeCoins(tx.gas, [leftover]); // refund unspent payment to gas

// devInspect surfaces ENotOwner cleanly if sender ≠ parcel owner.
const sim = await client.devInspectTransactionBlock({
  transactionBlock: tx, sender: ownerAddress,
});`,
  buy: `// trading::buy_full — Harberger flip. The seller cannot refuse.
// Always dry-run before signing. The real call is irreversible.
import { Transaction } from '@mysten/sui/transactions';

${ADDRS_HEADER}
const tx = new Transaction();
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1_000_000_000n)]); // 1 SUI cap
const [leftover] = tx.moveCall({
  target: \`\${MARKET_PKG}::trading::buy_full\`,
  arguments: [
    tx.object(MARKET_ID),
    tx.object(BLOCK_INDEX_ID),
    tx.pure.id(parcelId),
    coin,
  ],
});
tx.mergeCoins(tx.gas, [leftover]);

// Splits 85% seller, 7% treasury, 8% hierarchy pool — on chain.
const sim = await client.devInspectTransactionBlock({
  transactionBlock: tx, sender: myAddress,
});`,
};

export function Transact() {
  const [action, setAction] = useState<Action>('mark');
  const [polygonId, setPolygonId] = useState('');
  const [level, setLevel] = useState<LevelKey>('block');
  const [amountSui, setAmountSui] = useState('0.001');
  const [sender, setSender] = useState(SAMPLE_SENDER);
  const [dry, setDry] = useState<DryRunSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const buildTx = () => {
    const amountMist = parseSui(amountSui);
    const args = { polygonId: polygonId.trim(), level, amountMist };
    if (action === 'mark') return buildMarkTx({ ...args, markType: 1 });
    if (action === 'bump') return buildBumpPriceTx(args);
    return buildBuyFullTx(args);
  };

  const onDryRun = async () => {
    if (!polygonId.trim().startsWith('0x')) {
      setErr('paste a polygon ID first');
      return;
    }
    setBusy(true);
    setErr(null);
    setDry(null);
    try {
      const tx = buildTx();
      const summary = await dryRun(tx, sender.trim() || SAMPLE_SENDER);
      setDry(summary);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section
        title={
          <>
            Build, <em>simulate</em>, then (maybe) sign
          </>
        }
        blurb="Pick an action and a parcel. We build a real PTB and run it through devInspect. No funds, no signature — until you opt in to the mark flow."
      >
        <div className="action-tabs">
          <button
            className={action === 'mark' ? 'active' : ''}
            onClick={() => setAction('mark')}
          >
            marks::mark
          </button>
          <button
            className={action === 'bump' ? 'active' : ''}
            onClick={() => setAction('bump')}
          >
            trading::bump_price
          </button>
          <button
            className={action === 'buy' ? 'active' : ''}
            onClick={() => setAction('buy')}
          >
            trading::buy_full
          </button>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="pid">
              polygon id
            </label>
            <input
              id="pid"
              placeholder="0x…"
              value={polygonId}
              onChange={(e) => setPolygonId(e.target.value)}
            />
            <span className="hint">
              Browse the{' '}
              <a href="https://merca.earth/" target="_blank" rel="noreferrer">
                map
              </a>{' '}
              and copy a parcel's ID, or use the Activity tab for live ones.
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="lvl">
              level
            </label>
            <select id="lvl" value={level} onChange={(e) => setLevel(e.target.value as LevelKey)}>
              {LEVELS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
            <span className="hint">
              Match the level the parcel was registered at. Wrong level → call aborts.
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="amt">
              amount (SUI)
            </label>
            <input
              id="amt"
              inputMode="decimal"
              value={amountSui}
              onChange={(e) => setAmountSui(e.target.value)}
            />
            <span className="hint">
              {action === 'mark'
                ? 'Mark fee. Anything above the on-chain minimum works.'
                : action === 'bump'
                  ? 'bump_price requires payment ≥ quote_bump_cost.'
                  : 'buy_full requires payment ≥ current_price.'}
            </span>
          </div>
          <div className="field">
            <label className="label" htmlFor="sender">
              sender (for simulation)
            </label>
            <input
              id="sender"
              placeholder="0x…"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
            />
            <span className="hint">
              For owner-gated calls (bump / drop), use the parcel's actual owner.
            </span>
          </div>
        </div>

        <div className="row" style={{ marginTop: 16, gap: 12 }}>
          <button className="primary" onClick={onDryRun} disabled={busy}>
            {busy ? 'simulating…' : 'Dry-run'}
          </button>
          <Tag>{action === 'mark' ? 'safe to sign live' : 'dry-run only'}</Tag>
        </div>

        {err && <pre style={{ color: 'var(--warn)', marginTop: 12 }}>{err}</pre>}

        <div style={{ marginTop: 24 }}>
          <DryRunPanel result={dry} />
        </div>

        {action === 'mark' && polygonId.trim().startsWith('0x') && (
          <SignPanel buildTx={buildTx} />
        )}

        <div style={{ height: 16 }} />
        <CodeBlock code={SNIPPETS[action]} lang="ts" />
      </Section>
    </>
  );
}
