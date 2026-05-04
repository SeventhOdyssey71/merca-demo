/**
 * Read one parcel by ID. We try every level until we find it.
 *
 *   pnpm tsx scripts/read-parcel.ts 0x<polygon-id>
 *   pnpm tsx scripts/read-parcel.ts 0x<polygon-id> block
 */
import {
  findParcelLevel,
  readParcel,
  type LevelKey,
} from '../src/merca/index.js';
import { formatPremium, formatSui } from '../src/merca/format.js';
import { bold, exitOnError } from './_util.js';

const [, , idArg, levelArg] = process.argv;
if (!idArg) {
  console.error('usage: tsx scripts/read-parcel.ts <polygonId> [level]');
  process.exit(1);
}

await exitOnError(
  (async () => {
    let level: LevelKey | null = (levelArg as LevelKey) ?? null;
    if (!level) {
      console.log(`searching all levels for ${idArg}…`);
      level = await findParcelLevel(idArg);
      if (!level) {
        throw new Error('parcel not found at any level');
      }
    }

    const parcel = await readParcel(idArg, level);

    console.log(bold('parcel'));
    console.log({
      polygonId: parcel.polygonId,
      level: parcel.levelKey,
      indexId: parcel.indexId,
      premium: formatPremium(parcel.market.premiumPpm),
      saleCount: parcel.market.saleCount.toString(),
      currentPrice: `${formatSui(parcel.market.currentPriceMist, 6)} SUI`,
      currentPriceMist: parcel.market.currentPriceMist.toString(),
    });
  })(),
);
