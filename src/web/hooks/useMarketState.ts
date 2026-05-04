import { useEffect, useState } from 'react';
import { readMarketState, readLevelStats } from '@merca/market';
import type { MarketView, LevelIndexStats } from '@merca/types';

export function useMarketState() {
  const [market, setMarket] = useState<MarketView | null>(null);
  const [levels, setLevels] = useState<LevelIndexStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, l] = await Promise.all([readMarketState(), readLevelStats()]);
        if (cancelled) return;
        setMarket(m);
        setLevels(l);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { market, levels, error, loading };
}
