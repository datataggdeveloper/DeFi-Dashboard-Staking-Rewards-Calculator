const tokenFormatter = (maximumFractionDigits: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits });

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const formatTokens = (value: number, maximumFractionDigits = 4) =>
  tokenFormatter(maximumFractionDigits).format(value);

export const formatUsd = (value: number) => usdFormatter.format(value);

/** Chart tooltip label: "Day 90" for sub-year points, "Year 1.5" otherwise. */
export const formatDuration = (years: number): string => {
  if (years === 0) return "Start";
  if (years < 1) return `Day ${Math.round(years * 365)}`;
  return `Year ${Number(years.toFixed(2))}`;
};
