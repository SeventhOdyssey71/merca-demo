import { useEffect, useRef, useState } from 'react';
import { recentActivity } from '@merca/activity';
import type { Activity } from '@merca/types';

const POLL_MS = 6_000;

export function useActivity(limit = 25) {
  const [items, setItems] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [freshDigests, setFreshDigests] = useState<Set<string>>(new Set());

  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const list = await recentActivity(undefined, limit);
        if (cancelled) return;

        const incoming = list.map((a) => a.digest);
        const next = new Set<string>();
        for (const d of incoming) if (!seen.current.has(d)) next.add(d);
        if (next.size > 0) {
          setFreshDigests(next);
          for (const d of incoming) seen.current.add(d);
          setTimeout(() => {
            if (!cancelled) setFreshDigests(new Set());
          }, 1500);
        }

        setItems(list);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [limit]);

  return { items, error, loading, freshDigests };
}
