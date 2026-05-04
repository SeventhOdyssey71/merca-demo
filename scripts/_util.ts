/**
 * Shared script helpers. Imported by every script in this folder.
 * Loads .env, exposes the SuiClient, prints things prettily.
 */
import 'dotenv/config';

export function bold(s: string): string {
  return `[1m${s}[22m`;
}

export function dim(s: string): string {
  return `[2m${s}[22m`;
}

export function jstr(v: unknown): string {
  return JSON.stringify(
    v,
    (_k, val) => (typeof val === 'bigint' ? val.toString() : val),
    2,
  );
}

export function table(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    console.log(dim('(empty)'));
    return;
  }
  const stringy = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = typeof v === 'bigint' ? v.toString() : String(v ?? '');
    }
    return out;
  });
  console.table(stringy);
}

export function exitOnError<T>(p: Promise<T>): Promise<T> {
  return p.catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
