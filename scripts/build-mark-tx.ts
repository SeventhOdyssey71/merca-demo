/**
 * Build a `marks::mark` PTB and dry-run it. No funds, no signature.
 *
 *   pnpm tsx scripts/build-mark-tx.ts <polygonId> [level] [amountSui]
 */
import {
  buildMarkTx,
  dryRun,
  findParcelLevel,
  parseSui,
  type LevelKey,
} from '../src/merca/index.js';
import { bold, exitOnError, jstr } from './_util.js';

const [, , idArg, levelArg, amtArg] = process.argv;
if (!idArg) {
  console.error('usage: tsx scripts/build-mark-tx.ts <polygonId> [level] [amountSui=0.001]');
  process.exit(1);
}

await exitOnError(
  (async () => {
    const level = ((levelArg as LevelKey) ?? (await findParcelLevel(idArg))) || null;
    if (!level) throw new Error('parcel not found at any level');

    const amountMist = parseSui(amtArg ?? '0.001');
    const tx = buildMarkTx({ polygonId: idArg, level, markType: 1, amountMist });

    const sender =
      process.env.SUI_SENDER ?? '0x0000000000000000000000000000000000000000000000000000000000000000';

    const sim = await dryRun(tx, sender);

    console.log(bold('dry-run'));
    console.log({
      status: sim.status,
      gasUsedMist: sim.gasUsedMist.toString(),
      events: sim.events.length,
      error: sim.error,
    });

    if (sim.events.length > 0) {
      console.log();
      console.log(bold('events'));
      console.log(jstr(sim.events));
    }
  })(),
);
