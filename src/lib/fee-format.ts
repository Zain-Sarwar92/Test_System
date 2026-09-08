export function formatPkr(
  value: { toFixed(decimalPlaces: number): string } | number | string,
) {
  const amount =
    typeof value === "string"
      ? Number(value).toFixed(2)
      : typeof value === "number"
        ? value.toFixed(2)
        : value.toFixed(2);
  return `PKR ${Number(amount).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
