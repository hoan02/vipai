export const QUOTA_PER_USD = 500_000;

/** USD formatting: two decimals above $1, four below, trailing zeros trimmed. */
export function usd(value: number): string {
  const text = value >= 1 ? value.toFixed(2) : value.toFixed(4);
  return `$${text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")}`;
}
