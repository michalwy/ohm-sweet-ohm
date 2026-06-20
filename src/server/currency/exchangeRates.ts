import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

type FrankfurterResponse = {
  rates: Record<string, number>;
};

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Returns the exchange rate to convert 1 unit of `from` to `to` on the given date.
 * Checks the DB cache first; fetches from the Frankfurter API (ECB data) on a miss.
 * Returns null if the currencies match or if the lookup fails.
 */
export async function getExchangeRate(
  from: string,
  to: string,
  date: Date
): Promise<Prisma.Decimal | null> {
  if (from === to) return new Prisma.Decimal(1);

  const dateOnly = toDateOnly(date);

  const cached = await prisma.exchangeRate.findUnique({
    where: { baseCurrency_quoteCurrency_date: { baseCurrency: from, quoteCurrency: to, date: dateOnly } },
    select: { rate: true }
  });

  if (cached) return cached.rate;

  const dateStr = formatDate(dateOnly);

  let rate: number;
  try {
    const res = await fetch(`https://api.frankfurter.app/${dateStr}?from=${from}&to=${to}`);
    if (!res.ok) {
      console.error(`[exchangeRates] Frankfurter responded ${res.status} for ${from}→${to} on ${dateStr}`);
      return null;
    }
    const body = (await res.json()) as FrankfurterResponse;
    rate = body.rates[to];
    if (rate == null) {
      console.error(`[exchangeRates] No rate for ${to} in Frankfurter response for ${dateStr}`);
      return null;
    }
  } catch (err) {
    console.error(`[exchangeRates] Fetch failed for ${from}→${to} on ${dateStr}:`, err);
    return null;
  }

  const decimalRate = new Prisma.Decimal(rate);

  await prisma.exchangeRate.upsert({
    where: { baseCurrency_quoteCurrency_date: { baseCurrency: from, quoteCurrency: to, date: dateOnly } },
    create: { baseCurrency: from, quoteCurrency: to, date: dateOnly, rate: decimalRate },
    update: { rate: decimalRate, fetchedAt: new Date() }
  });

  return decimalRate;
}

/**
 * Converts an amount from `fromCurrency` to the workspace's `primaryCurrency` using the rate
 * on the given date. Returns the amount unchanged if currencies are the same.
 * Returns null if the rate cannot be determined.
 */
export async function convertToWorkspacePrimary(
  amount: Prisma.Decimal,
  fromCurrency: string,
  primaryCurrency: string,
  date: Date
): Promise<Prisma.Decimal | null> {
  if (fromCurrency === primaryCurrency) return amount;
  const rate = await getExchangeRate(fromCurrency, primaryCurrency, date);
  if (!rate) return null;
  return amount.mul(rate);
}

export class ExchangeRateUnavailableError extends Error {
  readonly from: string;
  readonly to: string;
  readonly date: string;
  constructor(from: string, to: string, date: string) {
    super("exchange-rate-unavailable");
    this.from = from;
    this.to = to;
    this.date = date;
  }
}

export async function getExchangeRateOrThrow(
  from: string,
  to: string,
  date: Date
): Promise<Prisma.Decimal> {
  if (from === to) return new Prisma.Decimal(1);
  const rate = await getExchangeRate(from, to, date);
  if (!rate) throw new ExchangeRateUnavailableError(from, to, formatDate(toDateOnly(date)));
  return rate;
}

export async function saveManualExchangeRate(
  from: string,
  to: string,
  date: Date,
  rateStr: string
): Promise<Prisma.Decimal> {
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(rateStr.trim());
  } catch {
    throw new Error("invalid-exchange-rate");
  }
  if (decimal.lessThanOrEqualTo(0)) throw new Error("invalid-exchange-rate");

  const dateOnly = toDateOnly(date);
  await prisma.exchangeRate.upsert({
    where: { baseCurrency_quoteCurrency_date: { baseCurrency: from, quoteCurrency: to, date: dateOnly } },
    create: { baseCurrency: from, quoteCurrency: to, date: dateOnly, rate: decimal },
    update: { rate: decimal, fetchedAt: new Date() }
  });
  return decimal;
}

/**
 * Batch-fetches exchange rates for multiple (from, to, date) combinations, deduplicating
 * lookups. Returns a map keyed by `"${from}:${to}:${YYYY-MM-DD}"`.
 */
export async function batchGetExchangeRates(
  requests: Array<{ from: string; to: string; date: Date }>
): Promise<Map<string, Prisma.Decimal | null>> {
  const result = new Map<string, Prisma.Decimal | null>();

  // Deduplicate
  const unique = new Map<string, { from: string; to: string; date: Date }>();
  for (const req of requests) {
    if (req.from === req.to) continue;
    const key = `${req.from}:${req.to}:${formatDate(toDateOnly(req.date))}`;
    if (!unique.has(key)) unique.set(key, req);
  }

  await Promise.all(
    Array.from(unique.entries()).map(async ([key, req]) => {
      const rate = await getExchangeRate(req.from, req.to, req.date);
      result.set(key, rate);
    })
  );

  // Fill same-currency entries
  for (const req of requests) {
    const key = `${req.from}:${req.to}:${formatDate(toDateOnly(req.date))}`;
    if (req.from === req.to) result.set(key, new Prisma.Decimal(1));
  }

  return result;
}
