/** A byte count for people: "0 B", "812 B", "14.2 kB", "3.1 MB" (powers of 1000, as disk sizes are). */
export function formatBytes(bytes: number): string {
  const units = ["B", "kB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }

  return unit === 0 ? `${Math.round(value)} ${units[0]}` : `${value.toFixed(1)} ${units[unit]}`;
}
