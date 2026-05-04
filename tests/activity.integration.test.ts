/**
 * Integration test — hits live mainnet RPC.
 * Skipped by default. Enable with: RUN_INTEGRATION=1 pnpm test
 */
import { describe, expect, it } from 'vitest';
import { recentActivity } from '../src/merca/index.js';

const enabled = process.env.RUN_INTEGRATION === '1';
const d = enabled ? describe : describe.skip;

d('mainnet activity', () => {
  it('recentActivity returns well-formed rows', async () => {
    const items = await recentActivity(undefined, 5);
    expect(Array.isArray(items)).toBe(true);
    for (const a of items) {
      expect(typeof a.digest).toBe('string');
      expect(typeof a.module).toBe('string');
      expect(typeof a.function).toBe('string');
      expect(typeof a.sender).toBe('string');
    }
  });
});
