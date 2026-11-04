/**
 * Client-safe pricing and display constants for the sidebar Spotlight.
 * Server code imports them through lib/rail-spotlight.ts.
 */

/** Slots visible at once in the sidebar. */
export const RAIL_VISIBLE_SLOTS = 4;
/** With more live bookings than visible slots, the set rotates this often. */
export const RAIL_ROTATE_MS = 15_000;
export const RAIL_DAYS_PER_BLOCK = 3;
/** Price of one product for one 3-day block. */
export const RAIL_PRICE_PER_BLOCK_CENTS = 100;
/** Upper bound on one booking (120 blocks = 360 days). */
export const RAIL_MAX_BLOCKS = 120;
/** Products one booking can sponsor at once. */
export const RAIL_MAX_ITEMS = 10;

/**
 * Price of a booking: $1 per product per 3-day block. Dodo charges the $1
 * product `quantity` times.
 */
export function railQuote(blocks: number, products = 1) {
  const b = Math.min(RAIL_MAX_BLOCKS, Math.max(1, Math.floor(blocks)));
  const p = Math.min(RAIL_MAX_ITEMS, Math.max(1, Math.floor(products)));
  return {
    blocks: b,
    days: b * RAIL_DAYS_PER_BLOCK,
    products: p,
    quantity: b * p,
    amountCents: b * p * RAIL_PRICE_PER_BLOCK_CENTS,
  };
}
