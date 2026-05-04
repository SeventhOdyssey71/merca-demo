/**
 * Decode `MoveAbort` errors from `devInspectTransactionBlock` / execution
 * responses into a one-line, developer-friendly message.
 *
 * The abort-code table mirrors the constants documented in
 * docs.merca.earth/reference/architecture#error-code-reference.
 */

export interface MoveAbortDecoded {
  module: string;
  function: string | null;
  code: number;
  name: string;
  hint: string;
}

interface Entry {
  name: string;
  hint: string;
}

const TABLE: Record<string, Record<number, Entry>> = {
  // mercatr::index
  index: {
    4001: { name: 'EBadVertices', hint: 'Vertex array is malformed.' },
    4002: { name: 'EMismatch', hint: 'Vertex count mismatch between x and y arrays.' },
    4005: {
      name: 'ENotFound',
      hint: 'Parcel ID is not in this index — try a different cadastral level (District, City, Region, Country, or Continent).',
    },
    4006: { name: 'ENotOwner', hint: 'Sender is not the parcel owner.' },
    4009: { name: 'EBadMaxDepth', hint: 'Index max_depth out of range.' },
    4010: { name: 'ETooManyParts', hint: 'Polygon has more than 10 parts.' },
    4012: { name: 'EOverlap', hint: 'Geometry overlaps an existing parcel.' },
    4013: { name: 'EIndexNotEmpty', hint: 'Cannot destroy a non-empty index.' },
    4014: { name: 'EBadCellSize', hint: 'Index cell_size out of range.' },
    4015: { name: 'ENotAuthorized', hint: 'Capability is not authorized on this index.' },
    4016: { name: 'ECoordinateTooLarge', hint: 'Coordinate exceeds the world bounds.' },
    4017: { name: 'EZeroAreaParcel', hint: 'Parcel area is zero.' },
    4018: { name: 'EBadConfig', hint: 'Index config is invalid.' },
    4019: { name: 'ECapIndexMismatch', hint: 'Capability is for a different index.' },
    4020: { name: 'ECapRevoked', hint: 'Capability has been revoked.' },
    4021: { name: 'EQueryTooLarge', hint: 'Viewport query exceeds the broadphase budget.' },
    4022: { name: 'EIndexEmpty', hint: 'Index has no parcels.' },
    4023: {
      name: 'EBroadphaseBudgetExceeded',
      hint: 'Broadphase probe budget exceeded — narrow the query.',
    },
    4024: { name: 'ECellOccupancyExceeded', hint: 'Cell occupancy limit exceeded.' },
    4025: { name: 'EIndexSealed', hint: 'Index is sealed; new caps cannot be minted.' },
  },

  // mercatr::polygon
  polygon: {
    2001: { name: 'EEmpty', hint: 'Polygon has no parts.' },
    2002: { name: 'ETooManyParts', hint: 'Polygon has more than 10 parts.' },
    2003: { name: 'ENotConvex', hint: 'A polygon part is not convex.' },
    2004: { name: 'EBadVertices', hint: 'Vertex array is malformed.' },
    2005: { name: 'EMismatch', hint: 'Vertex count mismatch.' },
    2006: { name: 'EPartOverlap', hint: 'Polygon parts overlap each other.' },
    2007: { name: 'EInvalidMultipartContact', hint: 'Multipart contact is invalid.' },
    2008: { name: 'EDisconnectedMultipart', hint: 'Multipart polygon is disconnected.' },
    2009: { name: 'EInvalidBoundary', hint: 'Boundary topology is invalid.' },
    2010: { name: 'EEdgeTooShort', hint: 'Polygon edge is below the minimum length.' },
    2011: { name: 'ECompactnessTooLow', hint: 'Polygon is too sliver-shaped (low compactness).' },
    2012: { name: 'EAreaConservationViolation', hint: 'Area conservation check failed.' },
    2013: { name: 'ECoordinateOutOfWorld', hint: 'Coordinate is outside the world rectangle.' },
    2014: { name: 'EArithmeticOverflow', hint: 'Integer overflow during geometry math.' },
  },

  // mercatr::metadata
  metadata: {
    6000: { name: 'ENotOwner', hint: 'Only the parcel owner can set metadata.' },
    6001: { name: 'EMetadataNotFound', hint: 'No metadata stored for this parcel.' },
    6002: { name: 'ECidTooLong', hint: 'Metadata URI exceeds the 128-byte limit.' },
  },

  // mercatr::mutations
  mutations: {
    5001: { name: 'ENotContained', hint: 'New geometry is not contained in the parent parcel.' },
    5002: { name: 'EOverlap', hint: 'Resulting geometry overlaps another parcel.' },
    5003: { name: 'ESelfRepartition', hint: 'Cannot repartition a parcel with itself.' },
    5004: { name: 'ENotAdjacent', hint: 'Parcels are not adjacent.' },
    5005: { name: 'EOwnerMismatch', hint: 'Both parcels must share the same owner.' },
    5006: { name: 'ESelfMerge', hint: 'Cannot merge a parcel with itself.' },
    5007: { name: 'EInvalidChildCount', hint: 'Split must produce 2–10 children.' },
    5008: { name: 'ETooManyChildren', hint: 'Too many children in split.' },
    5009: { name: 'EAreaShrunk', hint: 'Total area decreased during the operation.' },
  },

  // mercatr_market::market
  market: {
    3100: { name: 'EInvalidLevelPrice', hint: 'Level price is invalid.' },
    3101: { name: 'EInvalidAreaRange', hint: 'Area range is invalid.' },
    3102: { name: 'EDuplicateLevel', hint: 'Level is already registered.' },
    3103: { name: 'EInvalidRate', hint: 'Rate is invalid.' },
    3104: { name: 'EInvalidFee', hint: 'Fee is invalid.' },
    3105: {
      name: 'EUnknownIndex',
      hint: 'The market does not recognize this Index — wrong level for this parcel.',
    },
    3107: { name: 'EAreaOutOfRange', hint: 'Parcel area falls outside this level\'s min/max.' },
    3109: {
      name: 'EInsufficientPayment',
      hint: 'Payment coin is below the quoted price. Increase the amount.',
    },
    3110: {
      name: 'ENotOwner',
      hint: 'Sender is not the parcel owner — bump_price and drop_price are owner-gated.',
    },
    3111: { name: 'ENotRegistered', hint: 'Parcel is not registered with the market.' },
    3112: { name: 'EZeroAreaSlice', hint: 'Slice has zero area.' },
  },
};

// Match `Identifier("<module>")` ... optional `function_name: Some("<fn>")` ...
// and the abort code at the end of `MoveAbort(... }, <code>)`.
//
// The Sui stack renders the abort code in either decimal (`4005`) or hex
// (`0xFA5`) depending on which surface the error reaches us through
// (devInspect vs sign-and-execute vs gas estimation), so accept both.
const RE_MODULE = /Identifier\("([A-Za-z_][\w]*)"\)/;
const RE_FN = /function_name:\s*Some\(\s*"([^"]+)"\s*\)/;
const RE_CODE = /MoveAbort\([^]*?\}\s*,\s*(0x[0-9a-fA-F]+|\d+)\)/;
const RE_SUB_STATUS = /sub_status:\s*Some\(\s*(0x[0-9a-fA-F]+|\d+)\s*\)/;

/** `Number()` handles both '4005' and '0xFA5' correctly. */
function parseAbortCode(s: string): number {
  return Number(s);
}

/**
 * Parse a Move abort error from a raw string (what devInspect / execution
 * surfaces in `error` / `effects.status.error`). Returns `null` if the string
 * doesn't look like a Move abort.
 */
export function decodeMoveAbort(raw: string | null | undefined): MoveAbortDecoded | null {
  if (!raw) return null;
  const moduleMatch = raw.match(RE_MODULE);
  const codeMatch = raw.match(RE_CODE) ?? raw.match(RE_SUB_STATUS);
  if (!moduleMatch || !codeMatch) return null;
  const module = moduleMatch[1];
  const code = parseAbortCode(codeMatch[1]);
  const fn = raw.match(RE_FN)?.[1] ?? null;
  const entry = TABLE[module]?.[code];
  return {
    module,
    function: fn,
    code,
    name: entry?.name ?? `E${code}`,
    hint:
      entry?.hint ??
      'Unknown abort — see docs.merca.earth/reference/architecture for the full code list.',
  };
}
