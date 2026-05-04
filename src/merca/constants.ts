/**
 * Mainnet deployment of merca.earth.
 *
 * Source of truth: https://docs.merca.earth/reference/deployed-contracts
 *
 * The two packages are versioned via Sui's compatibility upgrade policy. Always
 * call into MERCATR_PKG / MERCATR_MARKET_PKG (the *permanent* addresses) — the
 * Sui runtime routes these to the latest on-chain version.
 */

export const NETWORK = 'mainnet' as const;
export const RPC_URL_DEFAULT = 'https://fullnode.mainnet.sui.io:443';

/** mercatr — spatial engine: geometry, collision, quadtree index. */
export const MERCATR_PKG =
  '0x4826a4d88d8ec8d40417a20ec7f07007f486404e06a09834a7e1e0c1756e9a6f';

/** mercatr_market — pricing, payment routing, forced-sale market. */
export const MERCATR_MARKET_PKG =
  '0xd3f040e18d5fb587c1801c1a61c782a7e443d3cacd7c652f220cec612a866d63';

/** Singleton shared market object. */
export const MARKET_ID =
  '0x54133dedf212704aaa9d13ee996fb33bb22306cfd0ecf28473471df5c8a8efc8';

export const MARK_BOARD =
  '0x8772d6a5b519f70511d6443f98f57e7f3b7da5b0f66c7ab923aedabf8cf0bd8e';

export const PROPOSAL_BOARD =
  '0x725648b41b399dacbb8e7344484dcb66042f0eacf517279ffc988ce578c40c35';

export type LevelKey = 'block' | 'district' | 'city' | 'region' | 'country' | 'continent';

export interface LevelInfo {
  key: LevelKey;
  rank: number;
  zoomMin: number;
  zoomMax: number;
  indexId: string;
  label: string;
}

/**
 * One shared `Index` object per cadastral level. The merca.earth client app
 * picks the right Index based on the user's zoom level.
 */
export const LEVELS: readonly LevelInfo[] = [
  {
    key: 'block',
    rank: 0,
    zoomMin: 15,
    zoomMax: 22,
    indexId: '0xe60aa995f92ab78ea6df30b6d65141af783980d295f7464f4326250af726ca5c',
    label: 'Block',
  },
  {
    key: 'district',
    rank: 1,
    zoomMin: 12,
    zoomMax: 14,
    indexId: '0x98cd36d3fe07b5b54527d80ec93f3c6bfd916c3fe6e5576fe3536167ce6f012b',
    label: 'District',
  },
  {
    key: 'city',
    rank: 2,
    zoomMin: 9,
    zoomMax: 11,
    indexId: '0x8da55fe39065949d1ae81856ac4e8bb81a006a6218b2da46012b424c72189f61',
    label: 'City',
  },
  {
    key: 'region',
    rank: 3,
    zoomMin: 6,
    zoomMax: 8,
    indexId: '0xdca83f897b2f94dd42aa816fda70579b3cc30c7e2738f9a48284a9ace26427fc',
    label: 'Region',
  },
  {
    key: 'country',
    rank: 4,
    zoomMin: 3,
    zoomMax: 5,
    indexId: '0xe3be85b61aa5c3a54d25238e4946cb5f65bf162e517fd53107b12443e2f5d80e',
    label: 'Country',
  },
  {
    key: 'continent',
    rank: 5,
    zoomMin: 1,
    zoomMax: 2,
    indexId: '0x64dee18714d3b57bf3aa3760cf954afc7ea87c99b8da89cf4ab0656de2fbcd62',
    label: 'Continent',
  },
] as const;

export function levelByKey(key: LevelKey): LevelInfo {
  const found = LEVELS.find((l) => l.key === key);
  if (!found) throw new Error(`unknown level ${key}`);
  return found;
}

/** Minutes-of-MIST — used everywhere on Sui. 1 SUI = 10^9 MIST. */
export const MIST_PER_SUI = 1_000_000_000n;

/**
 * Pricing constants from `mercatr_market::pricing`.
 * Premium is stored as parts-per-million (ppm). 1.0× = 1_000_000 ppm.
 */
export const PPM = 1_000_000n;
export const POST_REGISTRATION_PREMIUM_PPM = 2_950_000n; // 2.95×
