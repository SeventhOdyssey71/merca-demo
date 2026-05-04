/**
 * Compare the on-chain quoted buyout price with the pure-TS pricing math.
 * Useful as a sanity check of the local pricing module.
 *
 *   pnpm tsx scripts/quote-price.ts <polygonId> [level]
 */
import {
  findParcelLevel,
  readParcel,
  type LevelKey,
  buyoutSplit,
} from '../src/merca/index.js';
import { formatPremium, formatSui } from '../src/merca/format.js';
import { bold, exitOnError } from './_util.js';

const [, , idArg, levelArg] = process.argv;
if (!idArg) {
  console.error('usage: tsx scripts/quote-price.ts <polygonId> [level]');
  process.exit(1);
}

await exitOnError(
  (async () => {
    const level = ((levelArg as LevelKey) ?? (await findParcelLevel(idArg))) || null;
    if (!level) throw new Error('parcel not found at any level');

    const parcel = await readParcel(idArg, level);
    const split = buyoutSplit(parcel.market.currentPriceMist);

    console.log(bold('on-chain quote'));
    console.log({
      level,
      premium: formatPremium(parcel.market.premiumPpm),
      saleCount: parcel.market.saleCount.toString(),
      currentPrice: `${formatSui(parcel.market.currentPriceMist, 6)} SUI`,
    });

    console.log();
    console.log(bold('local split (85/7/8)'));
    console.log({
      seller: `${formatSui(split.seller, 6)} SUI`,
      treasury: `${formatSui(split.treasury, 6)} SUI`,
      hierarchy: `${formatSui(split.hierarchy, 6)} SUI`,
    });
  })(),
);
