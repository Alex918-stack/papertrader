export function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function shareWord(count: number): string {
  return count === 1 ? "share" : "shares";
}
