/**
 * Run mercatr::index::query_viewport against one cadastral level.
 *
 *   pnpm tsx scripts/viewport-query.ts <level> <minX> <minY> <maxX> <maxY>
 *   pnpm tsx scripts/viewport-query.ts block 0 0 1000000000 1000000000
 */
import { LEVELS, queryViewport, type LevelKey } from '../src/merca/index.js';
import { bold, dim, exitOnError } from './_util.js';

const args = process.argv.slice(2);
if (args.length < 5) {
  console.error('usage: tsx scripts/viewport-query.ts <level> <minX> <minY> <maxX> <maxY>');
  console.error('levels: ' + LEVELS.map((l) => l.key).join(', '));
  process.exit(1);
}
const [level, minX, minY, maxX, maxY] = args;

await exitOnError(
  (async () => {
    const ids = await queryViewport(level as LevelKey, {
      minX: BigInt(minX),
      minY: BigInt(minY),
      maxX: BigInt(maxX),
      maxY: BigInt(maxY),
    });

    console.log(
      bold(`${ids.length} parcel${ids.length === 1 ? '' : 's'}`) +
        dim(` in viewport on level ${level}`),
    );
    for (const id of ids) console.log(id);
  })(),
);
