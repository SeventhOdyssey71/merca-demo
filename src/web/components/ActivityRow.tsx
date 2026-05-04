import type { Activity } from '@merca/types';
import { relativeTime, shortAddr } from '@merca/format';

export function ActivityRow({ a, fresh }: { a: Activity; fresh?: boolean }) {
  const label = a.kind === 'other' ? `${a.module}::${a.function}` : a.kind.replace(/_/g, ' ');
  return (
    <div className={`activity-row${fresh ? ' live-pulse' : ''}`}>
      <span className="when">{relativeTime(a.timestampMs)}</span>
      <span className="kind" title={label}>
        {label}
      </span>
      <span className="who" title={a.sender}>
        {shortAddr(a.sender)}
        {a.polygonId ? ` → ${shortAddr(a.polygonId, 8, 6)}` : ''}
      </span>
      <a
        className="digest"
        href={`https://suiscan.xyz/mainnet/tx/${a.digest}`}
        target="_blank"
        rel="noreferrer"
        title={a.digest}
      >
        {shortAddr(a.digest, 6, 4)}
      </a>
    </div>
  );
}
