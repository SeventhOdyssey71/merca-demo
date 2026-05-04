/**
 * Print the last N protocol transactions.
 *
 *   pnpm tsx scripts/recent-activity.ts          # last 25
 *   pnpm tsx scripts/recent-activity.ts 50
 */
import { recentActivity } from '../src/merca/index.js';
import { relativeTime, shortAddr } from '../src/merca/format.js';
import { bold, dim, exitOnError } from './_util.js';

const limit = Number(process.argv[2] ?? 25);

await exitOnError(
  (async () => {
    const items = await recentActivity(undefined, limit);
    if (items.length === 0) {
      console.log(dim('(no recent activity)'));
      return;
    }

    console.log(bold(`recent activity`) + dim(` · last ${items.length}`));
    for (const a of items) {
      const ts = relativeTime(a.timestampMs).padEnd(10);
      const kind = (a.kind === 'other' ? `${a.module}::${a.function}` : a.kind).padEnd(22);
      const sender = shortAddr(a.sender).padEnd(14);
      const target = a.polygonId ? shortAddr(a.polygonId, 8, 4) : dim('—');
      const dig = dim(shortAddr(a.digest));
      console.log(`${ts}  ${kind}  ${sender}  ${target.padEnd(15)}  ${dig}`);
    }
  })(),
);
