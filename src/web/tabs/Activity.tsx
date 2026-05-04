import { Section } from '../components/Section.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { ActivityRow } from '../components/ActivityRow.js';
import { useActivity } from '../hooks/useActivity.js';
import { MERCATR_MARKET_PKG } from '@merca/constants';

const SNIPPET = `// Raw @mysten/sui — no off-chain indexer needed.
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

// mercatr_market — permanent package address.
const MARKET_PKG = '${MERCATR_MARKET_PKG}';

const page = await client.queryTransactionBlocks({
  filter: { MoveFunction: { package: MARKET_PKG } },
  options: { showInput: true },
  order: 'descending',
  limit: 25,
});

for (const tx of page.data) {
  const ptb = tx.transaction?.data.transaction;
  if (ptb?.kind !== 'ProgrammableTransaction') continue;

  // First MoveCall = user-facing intent.
  const call = ptb.transactions
    .map(t => 'MoveCall' in t ? t.MoveCall : null)
    .find(c => c?.package === MARKET_PKG);

  console.log(\`\${call?.module}::\${call?.function}\`, tx.sender, tx.digest);
}`;

const EVENT_SNIPPET = `// Or stream events directly — same package, different API.
import { SuiClient } from '@mysten/sui/client';

const MARKET_PKG = '${MERCATR_MARKET_PKG}';

const events = await client.queryEvents({
  query: { MoveEventModule: { package: MARKET_PKG, module: 'trading' } },
  order: 'descending',
  limit: 25,
});

// Real-time over WebSocket:
const unsubscribe = await client.subscribeEvent({
  filter: { MoveEventModule: { package: MARKET_PKG, module: 'trading' } },
  onMessage: (e) => console.log(e.type, e.parsedJson),
});`;

export function Activity() {
  const { items, error, loading, freshDigests } = useActivity(25);

  return (
    <>
      <Section
        title={
          <>
            Recent <em>protocol</em> activity
          </>
        }
        blurb="Polled every six seconds. Each row is one transaction whose first MoveCall lives in mercatr_market — registers, buyouts, marks, POI proposals, bumps, drops."
      >
        {error && <pre style={{ color: 'var(--warn)' }}>{error}</pre>}

        {loading && items.length === 0 && (
          <p className="muted">fetching the latest 25 protocol calls…</p>
        )}

        <div>
          {items.map((a) => (
            <ActivityRow key={a.digest} a={a} fresh={freshDigests.has(a.digest)} />
          ))}
        </div>

        <div style={{ height: 16 }} />
        <CodeBlock code={SNIPPET} lang="ts" />
      </Section>

      <Section
        title="Or subscribe to events"
        blurb="MoveEventModule lets you scope to one module. Pair queryEvents with subscribeEvent for a real-time feed over WebSocket."
      >
        <CodeBlock code={EVENT_SNIPPET} lang="ts" />
      </Section>
    </>
  );
}
