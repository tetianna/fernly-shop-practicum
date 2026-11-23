/** Formats dollars for display, e.g. 24.5 → "$24.50". */
export function formatPrice(amount: number): string {
  return `$${(Math.round(amount * 100) / 100).toFixed(2)}`;
}
