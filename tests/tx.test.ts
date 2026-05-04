import { describe, it, expect } from 'vitest';
import {
  buildBumpPriceTx,
  buildBuyFullTx,
  buildDropPriceTx,
  buildMarkTx,
} from '../src/merca/tx.js';
import {
  MARKET_ID,
  MARK_BOARD,
  MERCATR_MARKET_PKG,
  levelByKey,
} from '../src/merca/constants.js';

const SAMPLE_PARCEL = '0x' + 'cd'.repeat(32);

function ptbJson(tx: ReturnType<typeof buildMarkTx>): string {
  // getData() returns a builder snapshot we can introspect.
  // Stringifying captures targets, type args, and input shape.
  return JSON.stringify(
    tx.getData(),
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
    0,
  );
}

describe('buildMarkTx', () => {
  it('targets mercatr_market::marks::mark', () => {
    const tx = buildMarkTx({
      polygonId: SAMPLE_PARCEL,
      level: 'block',
      markType: 1,
      amountMist: 1_000_000n,
    });
    const j = ptbJson(tx);
    expect(j).toContain(`${MERCATR_MARKET_PKG}`);
    expect(j).toContain('marks');
    expect(j).toContain('mark');
    expect(j).toContain(MARK_BOARD);
    expect(j).toContain(MARKET_ID);
    expect(j).toContain(levelByKey('block').indexId);
  });

  it('throws on unknown level', () => {
    expect(() =>
      buildMarkTx({
        polygonId: SAMPLE_PARCEL,
        // @ts-expect-error testing runtime guard
        level: 'galaxy',
        markType: 1,
        amountMist: 1n,
      }),
    ).toThrow(/unknown level/);
  });
});

describe('trading::* builders', () => {
  for (const [name, build, fn] of [
    ['bump', buildBumpPriceTx, 'bump_price'],
    ['drop', buildDropPriceTx, 'drop_price'],
    ['buy', buildBuyFullTx, 'buy_full'],
  ] as const) {
    it(`${name} → calls trading::${fn}`, () => {
      const tx = build({
        polygonId: SAMPLE_PARCEL,
        level: 'block',
        amountMist: 1_000_000n,
      });
      const j = ptbJson(tx);
      expect(j).toContain('trading');
      expect(j).toContain(fn);
      expect(j).toContain(MARKET_ID);
      // Leftover coin must be merged back into gas — never transferred to a
      // placeholder address.
      expect(j).not.toContain(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      );
    });
  }
});
