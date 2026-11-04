/**
 * Client-safe pricing and display constants for the sidebar Spotlight.
 * Server code imports them through lib/rail-spotlight.ts.
 */

/** Slots visible at once in the sidebar. */
export const RAIL_VISIBLE_SLOTS = 4;
/** With more live bookings than visible slots, the set rotates this often. */
export const RAIL_ROTATE_MS = 15_000;
export const RAIL_DAYS_PER_BLOCK = 3;
export const RAIL_PRICE_PER_BLOCK_CENTS = 100;
/** Upper bound on one booking (120 blocks = 360 days). */
export const RAIL_MAX_BLOCKS = 120;

export function railQuote(blocks: number) {
  const b = Math.min(RAIL_MAX_BLOCKS, Math.max(1, Math.floor(blocks)));
  return { blocks: b, days: b * RAIL_DAYS_PER_BLOCK, amountCents: b * RAIL_PRICE_PER_BLOCK_CENTS };
}
