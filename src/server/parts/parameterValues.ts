export type ParameterValueType =
  | "TEXT"
  | "NUMBER"
  | "QUANTITY"
  | "BOOLEAN"
  | "CHOICE";

export type ChoiceOptionInput = {
  id: string;
  label: string;
};

export type ParsedParameterValue =
  | {
      type: "TEXT";
      textValue: string;
      displayValue: string;
    }
  | {
      type: "NUMBER";
      numberValue: string;
      displayValue: string;
    }
  | {
      type: "QUANTITY";
      quantityBaseValue: string;
      displayValue: string;
    }
  | {
      type: "BOOLEAN";
      booleanValue: boolean;
      displayValue: "Yes" | "No";
    }
  | {
      type: "CHOICE";
      choiceOptionId: string;
      displayValue: string;
    };

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

export function normalizeDictionaryName(value: string) {
  return normalizeWhitespace(value).toLocaleLowerCase("en");
}

export function normalizeTextParameterValue(value: string) {
  return normalizeWhitespace(value);
}

export function parseParameterValue({
  type,
  rawValue,
  baseUnitSymbol,
  choiceOptions = []
}: {
  type: ParameterValueType;
  rawValue: string;
  baseUnitSymbol?: string | null;
  choiceOptions?: ChoiceOptionInput[];
}): ParsedParameterValue {
  switch (type) {
    case "TEXT": {
      const displayValue = normalizeTextParameterValue(rawValue);

      if (!displayValue) {
        throw new Error("parameter_value_required");
      }

      return {
        type,
        textValue: displayValue,
        displayValue
      };
    }
    case "NUMBER": {
      const displayValue = normalizeNumberDisplay(rawValue);

      return {
        type,
        numberValue: normalizeDecimalString(displayValue),
        displayValue
      };
    }
    case "QUANTITY":
      return parseQuantityValue({ rawValue, baseUnitSymbol });
    case "BOOLEAN":
      return parseBooleanValue(rawValue);
    case "CHOICE":
      return parseChoiceValue({ rawValue, choiceOptions });
  }
}

function parseQuantityValue({
  rawValue,
  baseUnitSymbol
}: {
  rawValue: string;
  baseUnitSymbol?: string | null;
}): ParsedParameterValue {
  const unitSymbol = normalizeWhitespace(baseUnitSymbol ?? "");

  if (!unitSymbol) {
    throw new Error("quantity_unit_required");
  }

  const compactValue = normalizeWhitespace(rawValue).replace(",", ".");
  const match = compactValue.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(.*)$/);

  if (!match) {
    throw new Error("invalid_quantity_value");
  }

  const numericDisplay = normalizeNumberDisplay(match[1] ?? "");
  const suffix = normalizeWhitespace(match[2] ?? "").replace(/\s/g, "");
  const { prefix, displayUnit } = parseQuantitySuffix({
    suffix,
    baseUnitSymbol: unitSymbol
  });
  const exponent = SI_PREFIX_EXPONENTS.get(prefix);

  if (exponent === undefined) {
    throw new Error("invalid_quantity_prefix");
  }

  return {
    type: "QUANTITY",
    quantityBaseValue: multiplyDecimalByPowerOfTen(
      normalizeDecimalString(numericDisplay),
      exponent
    ),
    displayValue: `${numericDisplay} ${displayUnit}`
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
    return {
      prefix: "",
      displayUnit: baseUnitSymbol
    };
  }

  if (SI_PREFIX_EXPONENTS.has(suffix)) {
    const prefix = canonicalPrefix(suffix);

    return {
      prefix,
      displayUnit: `${prefix}${baseUnitSymbol}`
    };
  }

  const prefixCandidate = suffix.slice(0, 1);
  const hasPrefix = SI_PREFIX_EXPONENTS.has(prefixCandidate);
  const rawPrefix = hasPrefix ? prefixCandidate : "";
  const rawUnit = hasPrefix ? suffix.slice(1) : suffix;

  if (!isUnitAlias(rawUnit, baseUnitSymbol)) {
    throw new Error("invalid_quantity_unit");
  }

  const prefix = canonicalPrefix(rawPrefix);

  return {
    prefix,
    displayUnit: `${prefix}${baseUnitSymbol}`
  };
}

function isUnitAlias(value: string, baseUnitSymbol: string) {
  if (baseUnitSymbol === "Ω") {
    return ["ω", "ohm", "ohms"].includes(value.toLocaleLowerCase("en"));
  }

  return value.toLocaleLowerCase("en") === baseUnitSymbol.toLocaleLowerCase("en");
}

function parseBooleanValue(rawValue: string): ParsedParameterValue {
  const normalizedValue = normalizeWhitespace(rawValue).toLocaleLowerCase("en");

  if (["true", "yes", "1"].includes(normalizedValue)) {
    return {
      type: "BOOLEAN",
      booleanValue: true,
      displayValue: "Yes"
    };
  }

  if (["false", "no", "0"].includes(normalizedValue)) {
    return {
      type: "BOOLEAN",
      booleanValue: false,
      displayValue: "No"
    };
  }

  throw new Error("invalid_boolean_value");
}

function parseChoiceValue({
  rawValue,
  choiceOptions
}: {
  rawValue: string;
  choiceOptions: ChoiceOptionInput[];
}): ParsedParameterValue {
  const normalizedValue = normalizeDictionaryName(rawValue);
  const option = choiceOptions.find(
    (choiceOption) => normalizeDictionaryName(choiceOption.label) === normalizedValue
  );

  if (!option) {
    throw new Error("invalid_choice_value");
  }

  return {
    type: "CHOICE",
    choiceOptionId: option.id,
    displayValue: normalizeWhitespace(option.label)
  };
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeNumberDisplay(value: string) {
  return normalizeDecimalString(normalizeWhitespace(value).replace(",", "."));
}

function normalizeDecimalString(value: string) {
  const match = value.match(/^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/);

  if (!match) {
    throw new Error("invalid_number_value");
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

  if (isZeroDecimal(result)) {
    return "0";
  }

  return `${sign}${result}`;
}

function trimLeadingZeroes(value: string) {
  return value.replace(/^0+(?=\d)/, "") || "0";
}

function trimInsignificantZeroes(value: string) {
  const [integerPart = "0", fractionPart] = value.split(".");
  const normalizedInteger = trimLeadingZeroes(integerPart);

  if (fractionPart === undefined) {
    return normalizedInteger;
  }

  const normalizedFraction = fractionPart.replace(/0+$/, "");

  return normalizedFraction
    ? `${normalizedInteger}.${normalizedFraction}`
    : normalizedInteger;
}

function isZeroDecimal(value: string) {
  return /^0(?:\.0*)?$/.test(value);
}

function canonicalPrefix(prefix: string) {
  return CANONICAL_PREFIXES.get(prefix) ?? prefix;
}
