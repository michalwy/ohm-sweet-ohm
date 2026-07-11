// Isomorphic quantity and number parsing — safe to import from both client and server components.

export type ParseQuantityResult =
  | { ok: true; baseValue: string; displayValue: string }
  | { ok: false; error: string };

export type ParseNumberResult =
  | { ok: true; value: string; displayValue: string }
  | { ok: false; error: string };

// ─── SI prefix tables ─────────────────────────────────────────────────────────

const SI_PREFIX_EXPONENTS = new Map([
  ["p", -12],
  ["n", -9],
  ["µ", -6],
  ["u", -6],
  ["m", -3],
  ["", 0],
  ["k", 3],
  ["K", 3],
  ["M", 6],
  ["G", 9]
]);

const CANONICAL_PREFIXES = new Map([
  ["u", "µ"],
  ["K", "k"]
]);

const NORMALIZABLE_PREFIX_EXPONENTS = [-12, -9, -6, -3, 0, 3, 6, 9];

const EXPONENT_PREFIXES = new Map(
  NORMALIZABLE_PREFIX_EXPONENTS.map((exponent) => [
    exponent,
    exponent === -6
      ? "µ"
      : ([...SI_PREFIX_EXPONENTS.entries()].find(([, value]) => value === exponent)?.[0] ?? "")
  ])
);

// ─── Public utilities ─────────────────────────────────────────────────────────

export function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeDecimalString(value: string) {
  const match = value.match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/);

  if (!match) {
    throw new Error("invalid-number-value");
  }

  const sign = match[1] === "-" ? "-" : "";
  const integerPart = trimLeadingZeroes(match[2] ?? "0");
  const fractionPart = match[3] ?? match[4] ?? "";
  const normalized = fractionPart ? `${integerPart}.${fractionPart}` : integerPart;

  if (isZeroDecimal(normalized)) {
    return fractionPart ? `0.${fractionPart}` : "0";
  }

  return `${sign}${normalized}`;
}

// ─── Exported parsers (Result API) ────────────────────────────────────────────

/**
 * Parse a quantity string (e.g. "1mV", "100 µF", "10kΩ") into a base-unit
 * decimal string and a normalized display string.
 *
 * `baseUnitSymbol` must be provided (e.g. "V", "Ω", "F").
 */
export function parseQuantityValue({
  rawValue,
  baseUnitSymbol
}: {
  rawValue: string;
  baseUnitSymbol: string;
}): ParseQuantityResult {
  try {
    const result = parseQuantityValueInternal({ rawValue, baseUnitSymbol });
    return { ok: true, baseValue: result.quantityBaseValue, displayValue: result.displayValue };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "invalid-quantity-value" };
  }
}

/**
 * Parse a plain number string (e.g. "100", "1.5", "-10") into a normalized
 * decimal string. No SI prefix or unit handling.
 */
export function parseNumberValue({ rawValue }: { rawValue: string }): ParseNumberResult {
  try {
    const displayValue = normalizeDecimalString(
      normalizeWhitespace(rawValue).replace(",", ".")
    );
    return { ok: true, value: displayValue, displayValue };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "invalid-number-value" };
  }
}

// ─── Internal quantity parsing (throws on error) ──────────────────────────────

function parseQuantityValueInternal({
  rawValue,
  baseUnitSymbol
}: {
  rawValue: string;
  baseUnitSymbol: string;
}): { quantityBaseValue: string; displayValue: string } {
  const unitSymbol = normalizeWhitespace(baseUnitSymbol);

  if (!unitSymbol) {
    throw new Error("quantity-unit-required");
  }

  const isPercentUnit = unitSymbol === "%";
  const compactValue = normalizePercentSignInput({
    value: normalizeWhitespace(rawValue).replace(",", "."),
    isPercentUnit
  });
  const match = compactValue.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(.*)$/);

  if (!match) {
    throw new Error("invalid-quantity-value");
  }

  const numericDisplay = normalizeDecimalString(
    normalizeWhitespace(match[1] ?? "").replace(",", ".")
  );
  const suffix = normalizeWhitespace(match[2] ?? "").replace(/\s/g, "");
  const { prefix, displayUnit } = parseQuantitySuffix({ suffix, baseUnitSymbol: unitSymbol });
  const exponent = SI_PREFIX_EXPONENTS.get(prefix);

  if (exponent === undefined) {
    throw new Error("invalid-quantity-prefix");
  }

  const quantityBaseValue = multiplyDecimalByPowerOfTen(
    normalizeDecimalString(numericDisplay),
    exponent
  );
  const normalizedDisplay = getNormalizedQuantityDisplay({
    baseValue: quantityBaseValue,
    baseUnitSymbol: unitSymbol,
    preserveBaseUnit: isPercentUnit
  });

  return {
    quantityBaseValue,
    displayValue: normalizedDisplay ?? `${numericDisplay} ${displayUnit}`
  };
}

function parseQuantitySuffix({
  suffix,
  baseUnitSymbol
}: {
  suffix: string;
  baseUnitSymbol: string;
}) {
  if (!suffix) {
    return { prefix: "", displayUnit: baseUnitSymbol };
  }

  if (SI_PREFIX_EXPONENTS.has(suffix)) {
    const prefix = canonicalPrefix(suffix);
    return { prefix, displayUnit: `${prefix}${baseUnitSymbol}` };
  }

  const prefixCandidate = suffix.slice(0, 1);
  const hasPrefix = SI_PREFIX_EXPONENTS.has(prefixCandidate);
  const rawPrefix = hasPrefix ? prefixCandidate : "";
  const rawUnit = hasPrefix ? suffix.slice(1) : suffix;

  if (!isUnitAlias(rawUnit, baseUnitSymbol)) {
    throw new Error("invalid-quantity-unit");
  }

  const prefix = canonicalPrefix(rawPrefix);
  return { prefix, displayUnit: `${prefix}${baseUnitSymbol}` };
}

function isUnitAlias(value: string, baseUnitSymbol: string) {
  if (baseUnitSymbol === "Ω") {
    return ["ω", "ohm", "ohms"].includes(value.toLocaleLowerCase("en"));
  }
  return value.toLocaleLowerCase("en") === baseUnitSymbol.toLocaleLowerCase("en");
}

function normalizePercentSignInput({
  value,
  isPercentUnit
}: {
  value: string;
  isPercentUnit: boolean;
}) {
  if (!isPercentUnit) return value;
  return value.replace(/^(?:±|\+\/-)\s*/, "");
}

function getNormalizedQuantityDisplay({
  baseValue,
  baseUnitSymbol,
  preserveBaseUnit
}: {
  baseValue: string;
  baseUnitSymbol: string;
  preserveBaseUnit: boolean;
}) {
  if (preserveBaseUnit) {
    return `${baseValue} ${baseUnitSymbol}`;
  }

  if (isZeroDecimal(baseValue)) {
    return `0 ${baseUnitSymbol}`;
  }

  const chosenExponent = chooseBestQuantityExponent(baseValue);
  const chosenPrefix = EXPONENT_PREFIXES.get(chosenExponent);

  if (chosenPrefix === undefined) return null;

  const scaledValue = multiplyDecimalByPowerOfTen(baseValue, -chosenExponent);
  return `${scaledValue} ${chosenPrefix}${baseUnitSymbol}`;
}

function chooseBestQuantityExponent(baseValue: string) {
  for (const exponent of NORMALIZABLE_PREFIX_EXPONENTS) {
    const scaledValue = multiplyDecimalByPowerOfTen(baseValue, -exponent);
    const absoluteScaled = getAbsoluteDecimal(scaledValue);

    if (
      comparePositiveDecimal(absoluteScaled, "1") >= 0 &&
      comparePositiveDecimal(absoluteScaled, "1000") < 0
    ) {
      return exponent;
    }
  }

  const smallestExponent = NORMALIZABLE_PREFIX_EXPONENTS[0] ?? 0;
  const largestExponent = NORMALIZABLE_PREFIX_EXPONENTS[NORMALIZABLE_PREFIX_EXPONENTS.length - 1] ?? 0;
  const smallestScaled = getAbsoluteDecimal(
    multiplyDecimalByPowerOfTen(baseValue, -smallestExponent)
  );

  if (comparePositiveDecimal(smallestScaled, "1") < 0) {
    return smallestExponent;
  }

  return largestExponent;
}

function getAbsoluteDecimal(value: string) {
  return value.startsWith("-") ? value.slice(1) : value;
}

function comparePositiveDecimal(left: string, right: string) {
  const [leftInteger = "0", leftFraction = ""] = left.split(".");
  const [rightInteger = "0", rightFraction = ""] = right.split(".");
  const normalizedLeftInteger = trimLeadingZeroes(leftInteger);
  const normalizedRightInteger = trimLeadingZeroes(rightInteger);

  if (normalizedLeftInteger.length !== normalizedRightInteger.length) {
    return normalizedLeftInteger.length < normalizedRightInteger.length ? -1 : 1;
  }

  if (normalizedLeftInteger !== normalizedRightInteger) {
    return normalizedLeftInteger < normalizedRightInteger ? -1 : 1;
  }

  const maxFractionLength = Math.max(leftFraction.length, rightFraction.length);
  const normalizedLeftFraction = leftFraction.padEnd(maxFractionLength, "0");
  const normalizedRightFraction = rightFraction.padEnd(maxFractionLength, "0");

  if (normalizedLeftFraction === normalizedRightFraction) return 0;
  return normalizedLeftFraction < normalizedRightFraction ? -1 : 1;
}

function multiplyDecimalByPowerOfTen(value: string, exponent: number) {
  const sign = value.startsWith("-") ? "-" : "";
  const unsignedValue = sign ? value.slice(1) : value;
  const [integerPart = "0", fractionPart = ""] = unsignedValue.split(".");
  const digits = `${integerPart}${fractionPart}`;
  const decimalIndex = integerPart.length + exponent;
  let result: string;

  if (decimalIndex <= 0) {
    result = `0.${"0".repeat(Math.abs(decimalIndex))}${digits}`;
  } else if (decimalIndex >= digits.length) {
    result = `${digits}${"0".repeat(decimalIndex - digits.length)}`;
  } else {
    result = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }

  result = trimInsignificantZeroes(result);

  if (isZeroDecimal(result)) return "0";
  return `${sign}${result}`;
}

function trimLeadingZeroes(value: string) {
  return value.replace(/^0+(?=\d)/, "") || "0";
}

function trimInsignificantZeroes(value: string) {
  const [integerPart = "0", fractionPart] = value.split(".");
  const normalizedInteger = trimLeadingZeroes(integerPart);

  if (fractionPart === undefined) return normalizedInteger;

  const normalizedFraction = fractionPart.replace(/0+$/, "");
  return normalizedFraction ? `${normalizedInteger}.${normalizedFraction}` : normalizedInteger;
}

function isZeroDecimal(value: string) {
  return /^0(?:\.0*)?$/.test(value);
}

function canonicalPrefix(prefix: string) {
  return CANONICAL_PREFIXES.get(prefix) ?? prefix;
}
