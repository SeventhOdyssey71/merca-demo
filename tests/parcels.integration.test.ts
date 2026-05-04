/**
 * Integration tests — hit live mainnet RPC.
 * Skipped by default. Enable with: RUN_INTEGRATION=1 pnpm test
 */
import { describe, expect, it } from "vitest";
import {
  readMarketState,
  readLevelStats,
  queryViewport,
} from "../src/merca/index.js";

const enabled = process.env.RUN_INTEGRATION === "1";
const d = enabled ? describe : describe.skip;

d("mainnet reads", () => {
  it("readMarketState returns shape", async () => {
    const m = await readMarketState();
    expect(m.marketId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(typeof m.paused).toBe("boolean");
    expect(typeof m.treasuryMist).toBe("bigint");
  });

  it("readLevelStats returns 6 levels with non-negative counts", async () => {
    const stats = await readLevelStats();
    expect(stats).toHaveLength(6);
    for (const s of stats) {
      expect(typeof s.parcelCount).toBe("bigint");
      expect(s.parcelCount >= 0n).toBe(true);
      expect(typeof s.cellSize).toBe("bigint");
      expect(typeof s.maxDepth).toBe("number");
    }
  });

  it("queryViewport on the block level returns an array", async () => {
    const ids = await queryViewport("block", {
      minX: 0n,
      minY: 0n,
      maxX: 1_000_000_000n,
      maxY: 1_000_000_000n,
    });
    expect(Array.isArray(ids)).toBe(true);
  });
});
