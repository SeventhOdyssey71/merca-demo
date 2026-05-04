import { Section } from '../components/Section.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { Tag } from '../components/Tag.js';
import { ChainId } from '../components/ChainId.js';
import {
  MARKET_ID,
  MERCATR_MARKET_PKG,
  MERCATR_PKG,
  MARK_BOARD,
  PROPOSAL_BOARD,
  LEVELS,
} from '@merca/constants';

const SDK_SNIPPET = `import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

// Read parcels, build PTBs, simulate, sign — all from the bare SDK.
// Every flow in this demo is one of those four operations.`;

export function Overview({ goRead }: { goRead: () => void }) {
  return (
    <>
      <section className="section hero" style={{ marginTop: 24 }}>
        <div className="hero-grid">
          <div className="prose">
            <h1>
              An onchain <em>land protocol,</em>
              <br />
              opened up for developers.
            </h1>
            <p style={{ marginTop: 24 }}>
              merca.earth is a Sui-native cadastre: every parcel is a polygon validated
              against an on-chain quadtree, every parcel is always for sale at its current
              premium, and every movement is one PTB. This demo reads parcels, builds
              transactions, and watches protocol activity using the bare{' '}
              <code>@mysten/sui</code> SDK.
            </p>
            <div className="row" style={{ marginTop: 32, flexWrap: 'wrap' }}>
              <button className="primary" onClick={goRead}>
                Open Read tab →
              </button>
              <a
                href="https://docs.merca.earth/protocol/how-it-works"
                target="_blank"
                rel="noreferrer"
              >
                Protocol docs
              </a>
              <a
                href="https://docs.merca.earth/reference/api"
                target="_blank"
                rel="noreferrer"
              >
                Move API
              </a>
              <a
                href="https://sdk.mystenlabs.com/typescript"
                target="_blank"
                rel="noreferrer"
              >
                Sui TS SDK
              </a>
            </div>
          </div>
          <div className="hero-aside">
            <CodeBlock code={SDK_SNIPPET} lang="ts" />
          </div>
        </div>
      </section>

      <Section
        title={
          <>
            Two packages, <em>six</em> indexes, one market
          </>
        }
        blurb="The protocol ships as two Move packages with a clean separation of concerns. mercatr is the spatial engine — geometry, collision, the quadtree. mercatr_market layers pricing, payment routing, and forced-sale mechanics on top."
      >
        <div className="grid-2">
          <div className="col">
            <span className="label">mercatr</span>
            <ChainId id={MERCATR_PKG} kind="package" />
            <p style={{ fontSize: 13 }}>
              Stores parcel polygons, validates new shapes against existing ones using
              fixed-point integer SAT, and runs the three-phase collision pipeline. Knows
              nothing about money.
            </p>
          </div>
          <div className="col">
            <span className="label">mercatr_market</span>
            <ChainId id={MERCATR_MARKET_PKG} kind="package" />
            <p style={{ fontSize: 13 }}>
              Prices every registration and buyout, splits payments (
              <span className="mono">85/7/8</span> on buyouts, <span className="mono">92/8</span> on
              registrations), and holds the <code>TransferCap</code> that flips ownership during
              a forced sale.
            </p>
          </div>
        </div>
      </Section>

      <Section
        title={
          <>
            The shared <em>Market</em> object
          </>
        }
        blurb="One singleton holds the treasury, per-parcel pricing state, level pricing, and the capability that authorizes forced transfers. Every transaction that writes the cadastre runs through it."
      >
        <dl className="kv">
          <dt>Market</dt>
          <dd>
            <ChainId id={MARKET_ID} />
          </dd>
          <dt>MarkBoard</dt>
          <dd>
            <ChainId id={MARK_BOARD} />
          </dd>
          <dt>ProposalBoard</dt>
          <dd>
            <ChainId id={PROPOSAL_BOARD} />
          </dd>
          <dt>Type</dt>
          <dd className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {MERCATR_MARKET_PKG}::market::Market
          </dd>
        </dl>
      </Section>

      <Section
        title="Six cadastral levels"
        blurb="Zoom in on the map and the client app picks the right Index. Each is an independent shared object with its own parcel count and cell size."
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Level</th>
              <th>Rank</th>
              <th>Zoom</th>
              <th>Index ID</th>
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((l) => (
              <tr key={l.key}>
                <td>{l.label}</td>
                <td className="num">{l.rank}</td>
                <td className="num">
                  {l.zoomMin}–{l.zoomMax}
                </td>
                <td>
                  <ChainId id={l.indexId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        title="What's in this demo"
        blurb="Read the protocol → quote a buyout price → build a PTB → simulate it on chain → optionally sign one safe flow."
      >
        <ul style={{ paddingLeft: 20, color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.7 }}>
          <li>
            <strong>Read</strong> — live treasury, paused state, parcel counts per level,
            single-parcel lookup with current buyout price.
          </li>
          <li>
            <strong>Transact</strong> — build PTBs for <code>marks::mark</code>,{' '}
            <code>trading::bump_price</code>, and <code>trading::buy_full</code>; dry-run via{' '}
            <code>devInspectTransactionBlock</code>; opt-in real signing for the cheapest flow.
          </li>
          <li>
            <strong>Activity</strong> — recent on-chain protocol calls, classified by module
            and function, polled every six seconds with a fresh-row pulse.
          </li>
        </ul>
        <div className="row" style={{ marginTop: 16 }}>
          <Tag>read-only by default</Tag>
          <Tag tone="warn">mainnet</Tag>
        </div>
      </Section>
    </>
  );
}
