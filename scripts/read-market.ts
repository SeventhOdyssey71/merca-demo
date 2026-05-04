/**
 * Print live state of the merca.earth market: paused?, treasury balance,
 * and parcel counts per cadastral level.
 *
 *   pnpm tsx scripts/read-market.ts
 */
import { readLevelStats, readMarketState } from '../src/merca/index.js';
import { formatSui } from '../src/merca/format.js';
import { bold, exitOnError, table } from './_util.js';

await exitOnError(
  (async () => {
    const [market, levels] = await Promise.all([readMarketState(), readLevelStats()]);

    console.log(bold('market'));
    console.log({
      marketId: market.marketId,
      paused: market.paused,
      treasury: `${formatSui(market.treasuryMist, 6)} SUI`,
      treasuryMist: market.treasuryMist.toString(),
    });

    console.log();
    console.log(bold('levels'));
    table(
      levels.map((l) => ({
        level: l.levelKey,
        parcels: l.parcelCount,
        cellSize: l.cellSize,
        maxDepth: l.maxDepth,
      })),
    );
  })(),
);
