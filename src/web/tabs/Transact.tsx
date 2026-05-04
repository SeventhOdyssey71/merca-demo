import { useEffect, useRef, useState } from 'react';
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
import { findParcelLevel } from '@merca/parcels';
import { quoteAllPrices, readParcelOwner } from '@merca/market';
import type { LevelKey } from '@merca/constants';
import {
  LEVELS,
  MARK_BOARD,
  MARKET_ID,
  MERCATR_MARKET_PKG,
} from '@merca/constants';
import type { DryRunSummary } from '@merca/types';
import { formatSui, parseSui, shortAddr } from '@merca/format';

const BLOCK_INDEX = LEVELS.find((l) => l.key === 'block')!;
type DetectStatus = 'idle' | 'detecting' | 'found' | 'not-found';

interface Quotes {
  buyMist: bigint;
  bumpMist: bigint;
  dropMist: bigint;
}

const MARK_DEFAULT_SUI = '0.001';
/** Pad buy_full / bump_price by 0.5% so a tick of premium movement between
 *  quote-time and execution-time doesn't trip EInsufficientPayment. The
 *  unspent change is merged back into the gas coin. */
function withHeadroom(mist: bigint, bps = 50n): bigint {
  return mist + (mist * bps) / 10_000n;
}

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
  const [levelTouched, setLevelTouched] = useState(false);
  const [detect, setDetect] = useState<DetectStatus>('idle');
  const lastDetected = useRef<string>('');
  const [amountSui, setAmountSui] = useState('0.001');
  const [sender, setSender] = useState(SAMPLE_SENDER);
  const [dry, setDry] = useState<DryRunSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<Quotes | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const quotedFor = useRef<{ id: string; level: LevelKey } | null>(null);
  const amountTouched = useRef(false);
  const senderTouched = useRef(false);

  // Debounced auto-detect: when the user pastes a well-formed polygon ID,
  // search every level until we find which one hosts it. If the user has
  // manually picked a level (`levelTouched`), don't override their choice.
  useEffect(() => {
    const id = polygonId.trim();
    const wellFormed = /^0x[0-9a-fA-F]{64}$/.test(id);
    if (!wellFormed) {
      setDetect('idle');
      return;
    }
    if (id === lastDetected.current) return;

    let cancelled = false;
    setDetect('detecting');
    const t = setTimeout(async () => {
      try {
        const found = await findParcelLevel(id);
        if (cancelled) return;
        lastDetected.current = id;
        if (found) {
          setDetect('found');
          if (!levelTouched) setLevel(found);
        } else {
          setDetect('not-found');
        }
      } catch {
        if (!cancelled) setDetect('not-found');
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [polygonId, levelTouched]);

  // Once the level is settled, fetch the on-chain quotes AND the parcel's
  // current owner in parallel. The quotes eliminate EInsufficientPayment;
  // the owner eliminates ENotOwner by letting us pre-fill the sender field
  // for owner-gated calls (bump_price, drop_price).
  useEffect(() => {
    if (detect !== 'found') {
      setQuotes(null);
      setOwner(null);
      return;
    }
    const id = polygonId.trim();
    if (!id) return;
    if (
      quotedFor.current &&
      quotedFor.current.id === id &&
      quotedFor.current.level === level
    ) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [q, o] = await Promise.all([
          quoteAllPrices(id, level),
          readParcelOwner(id, level).catch(() => null),
        ]);
        if (cancelled) return;
        setQuotes(q);
        setOwner(o?.owner ?? null);
        quotedFor.current = { id, level };
      } catch {
        if (cancelled) return;
        setQuotes(null);
        setOwner(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detect, polygonId, level]);

  // For owner-gated actions (bump_price), auto-fill the sender field with
  // the parcel's actual owner. The user can still override.
  useEffect(() => {
    if (!owner || senderTouched.current) return;
    if (action === 'bump') setSender(owner);
    else setSender(SAMPLE_SENDER);
  }, [action, owner]);

  // Auto-fill the amount field whenever quotes refresh or the action changes —
  // unless the user manually edited the amount. Adds a tiny headroom buffer
  // for buy/bump (price can drift; the leftover refunds to gas).
  useEffect(() => {
    if (!quotes) return;
    if (amountTouched.current) return;
    const target =
      action === 'mark'
        ? MARK_DEFAULT_SUI
        : action === 'bump'
          ? formatSui(withHeadroom(quotes.bumpMist), 9)
          : action === 'buy'
            ? formatSui(withHeadroom(quotes.buyMist), 9)
            : amountSui;
    setAmountSui(target);
    // amountSui intentionally omitted from deps — we don't want to re-fire
    // on our own setAmountSui call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, quotes]);

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
        {(owner || quotes) && (
          <div className="parcel-strip">
            {owner && (
              <span>
                <span className="label-inline">owner</span>{' '}
                <a
                  href={`https://suiscan.xyz/mainnet/account/${owner}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mono"
                  title={owner}
                >
                  {shortAddr(owner, 8, 6)}
                </a>
              </span>
            )}
            {quotes && (
              <>
                <span>
                  <span className="label-inline">buyout</span>{' '}
                  <span className="mono">{formatSui(quotes.buyMist, 6)} SUI</span>
                </span>
                <span>
                  <span className="label-inline">bump cost</span>{' '}
                  <span className="mono">{formatSui(quotes.bumpMist, 6)} SUI</span>
                </span>
                <span>
                  <span className="label-inline">drop cost</span>{' '}
                  <span className="mono">{formatSui(quotes.dropMist, 6)} SUI</span>
                </span>
              </>
            )}
          </div>
        )}

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
              onChange={(e) => {
                setPolygonId(e.target.value);
                // A new ID means the previous "manually picked" level no longer
                // applies — re-enable auto-detect so we can refit the level.
                setLevelTouched(false);
                amountTouched.current = false;
                senderTouched.current = false;
              }}
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
            <select
              id="lvl"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value as LevelKey);
                setLevelTouched(true);
              }}
            >
              {LEVELS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
            <span className="hint">
              {detect === 'detecting' && <>detecting level for this parcel…</>}
              {detect === 'found' && !levelTouched && (
                <>
                  auto-detected · <strong>{level}</strong>{' '}
                  <a
                    onClick={(e) => {
                      e.preventDefault();
                      setLevelTouched(true);
                    }}
                    href="#"
                    style={{ marginLeft: 6 }}
                  >
                    override
                  </a>
                </>
              )}
              {detect === 'found' && levelTouched && (
                <>using your selected level</>
              )}
              {detect === 'not-found' && (
                <>
                  parcel not found in any index — double-check the ID, then pick a level
                  manually.
                </>
              )}
              {detect === 'idle' && (
                <>Match the level the parcel was registered at. Wrong level → call aborts.</>
              )}
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
              onChange={(e) => {
                setAmountSui(e.target.value);
                amountTouched.current = true;
              }}
            />
            <span className="hint">
              {quotes && action !== 'mark' ? (
                <>
                  auto-quoted from <code>trading::{action === 'bump' ? 'quote_bump_cost' : 'current_price'}</code>{' '}
                  · base{' '}
                  <strong>
                    {formatSui(action === 'bump' ? quotes.bumpMist : quotes.buyMist, 6)} SUI
                  </strong>
                  {' '}+ 0.5% headroom
                </>
              ) : action === 'mark' ? (
                'Mark fee. Anything above the on-chain minimum works.'
              ) : action === 'bump' ? (
                'bump_price requires payment ≥ quote_bump_cost.'
              ) : (
                'buy_full requires payment ≥ current_price.'
              )}
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
              onChange={(e) => {
                setSender(e.target.value);
                senderTouched.current = true;
              }}
            />
            <span className="hint">
              {action === 'bump' && owner && sender === owner ? (
                <>
                  auto-filled with the parcel's <strong>current owner</strong> · this is the
                  only address that can <code>bump_price</code>.
                </>
              ) : action === 'bump' && owner ? (
                <>
                  Owner-gated. Current owner is{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setSender(owner);
                      senderTouched.current = false;
                    }}
                  >
                    {shortAddr(owner, 8, 6)}
                  </a>{' '}
                  — click to set as sender.
                </>
              ) : action === 'bump' ? (
                <>
                  Owner-gated. Owner not yet loaded — paste the parcel's owner address or
                  expect <code>market::ENotOwner (3110)</code>.
                </>
              ) : (
                <>For owner-gated calls (bump_price, drop_price), use the parcel's owner.</>
              )}
            </span>
          </div>
        </div>

        <div className="row" style={{ marginTop: 16, gap: 12 }}>
          <button
            className="primary"
            onClick={onDryRun}
            disabled={busy || detect === 'detecting'}
          >
            {busy
              ? 'simulating…'
              : detect === 'detecting'
                ? 'detecting level…'
                : 'Dry-run'}
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
