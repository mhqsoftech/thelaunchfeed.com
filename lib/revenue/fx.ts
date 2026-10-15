import { ProviderUnavailableError } from "./types";

/**
 * Currency normalisation. Verified revenue is shown in USD so founders on
 * different gateways can be compared honestly — using real daily FX rates,
 * never a hard-coded divisor.
 */

/** ISO 4217 exponent for currencies that don't use 2 minor-unit decimals. */
const EXPONENT: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, MGA: 0, PYG: 0,
  RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

export function currencyExponent(currency: string): number {
  return EXPONENT[currency.toUpperCase()] ?? 2;
}

let cache: { at: number; rates: Record<string, number> } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000;

/** Units of each currency per 1 USD. */
async function usdRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rates;
  const sources: Array<() => Promise<Record<string, number>>> = [
    async () => {
      const r = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
      const j = await r.json();
      if (j?.result !== "success" || typeof j.rates !== "object") throw new Error("bad fx payload");
      return j.rates as Record<string, number>;
    },
    async () => {
      const r = await fetch("https://api.frankfurter.app/latest?from=USD", { cache: "no-store" });
      const j = await r.json();
      if (typeof j?.rates !== "object") throw new Error("bad fx payload");
      return { ...(j.rates as Record<string, number>), USD: 1 };
    },
  ];
  for (const src of sources) {
    try {
      const rates = await src();
      cache = { at: Date.now(), rates };
      return rates;
    } catch {
      // try next source
    }
  }
  if (cache) return cache.rates; // stale beats nothing for a few hours
  throw new ProviderUnavailableError("Currency rates are temporarily unavailable, so non-USD revenue can't be verified right now.");
}

/** Batch helper: one rate lookup, many conversions. */
export async function converter(): Promise<(minor: number, currency: string) => number> {
  const rates = await usdRates().catch(() => null);
  return (minor: number, currency: string) => {
    const cur = (currency || "USD").toUpperCase();
    if (cur === "USD") return Math.round(minor);
    const rate = rates?.[cur];
    if (!rate || rate <= 0) {
      throw new ProviderUnavailableError(`No exchange rate available for ${cur}; revenue can't be verified in USD.`);
    }
    return Math.round((minor / 10 ** currencyExponent(cur) / rate) * 100);
  };
}
