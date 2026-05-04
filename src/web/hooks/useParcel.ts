import { useEffect, useState } from 'react';
import { findParcelLevel, readParcel } from '@merca/parcels';
import type { ParcelView } from '@merca/types';
import type { LevelKey } from '@merca/constants';

export function useParcel(polygonId: string | null, hintLevel?: LevelKey) {
  const [parcel, setParcel] = useState<ParcelView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!polygonId) {
      setParcel(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let level: LevelKey | null = hintLevel ?? null;
        if (!level) level = await findParcelLevel(polygonId);
        if (!level) throw new Error('parcel not found at any level');
        const p = await readParcel(polygonId, level);
        if (!cancelled) setParcel(p);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setParcel(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [polygonId, hintLevel]);

  return { parcel, error, loading };
}
