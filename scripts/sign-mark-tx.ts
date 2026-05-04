/**
 * Build a `marks::mark` PTB, sign with SUI_PRIVATE_KEY from .env, and submit.
 *
 *   SUI_PRIVATE_KEY=suiprivkey1… pnpm tsx scripts/sign-mark-tx.ts <polygonId> [level] [amountSui]
 *
 * Real mainnet transaction. Use a dedicated dev wallet — never your main one.
 */
import 'dotenv/config';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  buildMarkTx,
  findParcelLevel,
  getClient,
  parseSui,
  type LevelKey,
} from '../src/merca/index.js';
import { bold, exitOnError } from './_util.js';

const key = process.env.SUI_PRIVATE_KEY;
if (!key) {
  console.error('set SUI_PRIVATE_KEY in .env (suiprivkey1… form)');
  process.exit(1);
}

const [, , idArg, levelArg, amtArg] = process.argv;
if (!idArg) {
  console.error('usage: tsx scripts/sign-mark-tx.ts <polygonId> [level] [amountSui=0.001]');
  process.exit(1);
}

await exitOnError(
  (async () => {
    const { schema, secretKey } = decodeSuiPrivateKey(key);
    if (schema !== 'ED25519') throw new Error(`only Ed25519 keys supported (got ${schema})`);
    const kp = Ed25519Keypair.fromSecretKey(secretKey);
    const sender = kp.toSuiAddress();

    const level = ((levelArg as LevelKey) ?? (await findParcelLevel(idArg))) || null;
    if (!level) throw new Error('parcel not found at any level');

    const amountMist = parseSui(amtArg ?? '0.001');
    const tx = buildMarkTx({ polygonId: idArg, level, markType: 1, amountMist });
    tx.setSender(sender);

    console.log(bold(`signing as ${sender}`));
    const exec = await getClient().signAndExecuteTransaction({
      signer: kp,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });

    console.log({
      digest: exec.digest,
      status: exec.effects?.status?.status,
      gasUsed: exec.effects?.gasUsed,
      events: exec.events?.length ?? 0,
    });
    console.log(`https://suiscan.xyz/mainnet/tx/${exec.digest}`);
  })(),
);
