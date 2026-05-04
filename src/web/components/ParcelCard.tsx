import type { ParcelView } from '@merca/types';
import { formatPremium, formatSui, shortAddr } from '@merca/format';

export function ParcelCard({ parcel }: { parcel: ParcelView }) {
  const { polygonId, levelKey, market } = parcel;
  return (
    <div className="parcel-card">
      <div className="col" style={{ gap: 4 }}>
        <span className="id" title={polygonId}>
          {shortAddr(polygonId, 10, 8)}
        </span>
        <span className="meta">
          {levelKey} · premium {formatPremium(market.premiumPpm)} · sales{' '}
          {market.saleCount.toString()}
        </span>
      </div>
      <div className="price">
        <div>{formatSui(market.currentPriceMist, 4)}</div>
        <div className="meta">SUI buyout</div>
      </div>
    </div>
  );
}
