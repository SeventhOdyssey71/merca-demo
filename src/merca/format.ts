import { MIST_PER_SUI, PPM } from './constants.js';

/**
 * Format MIST as SUI with up to `maxDecimals` places. No trailing zeros.
 * BigInt-safe — never coerces through `Number` for the integer part.
 */
export function formatSui(mist: bigint, maxDecimals = 6): string {
  const neg = mist < 0n;
  const abs = neg ? -mist : mist;
  const whole = abs / MIST_PER_SUI;
  const frac = abs % MIST_PER_SUI;
  const fracStr = frac.toString().padStart(9, '0').slice(0, maxDecimals);
  const trimmed = fracStr.replace(/0+$/, '');
  const sign = neg ? '-' : '';
  return trimmed.length === 0
    ? `${sign}${whole.toString()}`
    : `${sign}${whole.toString()}.${trimmed}`;
}

/** Parse a decimal SUI string into MIST. Throws on malformed input. */
export function parseSui(input: string): bigint {
  const m = input.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!m) throw new Error(`not a decimal number: ${input}`);
  const [, sign, whole, fracRaw = ''] = m;
  const frac = (fracRaw + '000000000').slice(0, 9);
  const mist = BigInt(whole) * MIST_PER_SUI + BigInt(frac || '0');
  return sign === '-' ? -mist : mist;
}

/**
 * Shorten a long identifier for display: hex addresses ("0xabcd…1234"),
 * Sui transaction digests (base58), object IDs — anything string-like.
 */
export function shortAddr(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Premium ppm → human display, e.g. 2_950_000 → "2.95×". */
export function formatPremium(ppm: bigint, decimals = 2): string {
  const scale = 10n ** BigInt(decimals);
  const scaled = (ppm * scale) / PPM;
  const whole = scaled / scale;
  const frac = scaled % scale;
  if (frac === 0n) return `${whole}×`;
  return `${whole}.${frac.toString().padStart(decimals, '0')}×`;
}

/** m² with thousands separators. */
export function formatArea(m2: bigint): string {
  return `${insertThousands(m2.toString())} m²`;
}

function insertThousands(s: string): string {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format an absolute timestamp as a relative phrase ("12s ago"). */
export function relativeTime(ts: number | null, now = Date.now()): string {
  if (ts == null) return '—';
  const delta = Math.max(0, Math.floor((now - ts) / 1000));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}
