/** "$1.2K / mo" — shared, dependency-free formatter for verified USD MRR. */
export function formatUsdMonthly(cents: number): string {
  if (cents >= 100_000) return `$${(cents / 100_000).toFixed(1)}K / mo`;
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d : d.toFixed(2)} / mo`;
}
