import type { DryRunSummary } from '@merca/types';
import { formatSui } from '@merca/format';
import { Tag } from './Tag.js';

export function DryRunPanel({ result }: { result: DryRunSummary | null }) {
  if (!result) {
    return (
      <div className="dryrun">
        <div className="row-h">
          <span className="label">simulation</span>
          <Tag>idle</Tag>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Click <em>Dry-run</em> to simulate the PTB against current chain state. No funds, no
          signature.
        </p>
      </div>
    );
  }

  return (
    <div className="dryrun">
      <div className="row-h">
        <span className="label">simulation</span>
        <Tag tone={result.status === 'success' ? 'live' : 'warn'}>{result.status}</Tag>
      </div>

      <div className="grid-2">
        <div className="stat">
          <span className="label">Net gas (simulated)</span>
          <span className="value">{formatSui(result.gasUsedMist, 6)} SUI</span>
        </div>
        <div className="stat">
          <span className="label">Events emitted</span>
          <span className="value">{result.events.length}</span>
        </div>
      </div>

      {result.error && (
        <pre style={{ color: 'var(--warn)' }}>{result.error}</pre>
      )}

      {result.events.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--ink-soft)' }}>
            event payloads
          </summary>
          <pre>{stringify(result.events)}</pre>
        </details>
      )}

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--ink-soft)' }}>
          full devInspect response
        </summary>
        <pre>{stringify(result.raw)}</pre>
      </details>
    </div>
  );
}

function stringify(v: unknown): string {
  return JSON.stringify(
    v,
    (_k, val) => (typeof val === 'bigint' ? val.toString() : val),
    2,
  );
}
