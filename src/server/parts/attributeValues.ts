import {
  normalizeWhitespace,
  normalizeDecimalString,
  parseQuantityValue as parseQuantityValueLib,
  parseNumberValue as parseNumberValueLib
} from "@/lib/quantityParsing";

export type AttributeValueType =
  | "TEXT"
  | "NUMBER"
  | "QUANTITY"
  | "BOOLEAN"
  | "CHOICE";

export type ChoiceOptionInput = {
  id: string;
  label: string;
};

export type ParsedAttributeValue =
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

export function normalizeDictionaryName(value: string) {
  return normalizeWhitespace(value).toLocaleLowerCase("en");
}

export function normalizeTextAttributeValue(value: string) {
  return normalizeWhitespace(value);
}

export function parseAttributeValue({
  type,
  rawValue,
  baseUnitSymbol,
  choiceOptions = []
}: {
  type: AttributeValueType;
  rawValue: string;
  baseUnitSymbol?: string | null;
  choiceOptions?: ChoiceOptionInput[];
}): ParsedAttributeValue {
  switch (type) {
    case "TEXT": {
      const displayValue = normalizeTextAttributeValue(rawValue);

      if (!displayValue) {
        throw new Error("attribute-value-required");
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
    case "QUANTITY": {
      const unitSymbol = normalizeWhitespace(baseUnitSymbol ?? "");

      if (!unitSymbol) {
        throw new Error("quantity-unit-required");
      }

      const result = parseQuantityValueLib({ rawValue, baseUnitSymbol: unitSymbol });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return {
        type: "QUANTITY",
        quantityBaseValue: result.baseValue,
        displayValue: result.displayValue
      };
    }
    case "BOOLEAN":
      return parseBooleanValue(rawValue);
    case "CHOICE":
      return parseChoiceValue({ rawValue, choiceOptions });
  }
}

function parseBooleanValue(rawValue: string): ParsedAttributeValue {
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

  throw new Error("invalid-boolean-value");
}

function parseChoiceValue({
  rawValue,
  choiceOptions
}: {
  rawValue: string;
  choiceOptions: ChoiceOptionInput[];
}): ParsedAttributeValue {
  const normalizedValue = normalizeDictionaryName(rawValue);
  const option = choiceOptions.find(
    (choiceOption) => normalizeDictionaryName(choiceOption.label) === normalizedValue
  );

  if (!option) {
    throw new Error("invalid-choice-value");
  }

  return {
    type: "CHOICE",
    choiceOptionId: option.id,
    displayValue: normalizeWhitespace(option.label)
  };
}

function normalizeNumberDisplay(value: string) {
  return normalizeDecimalString(normalizeWhitespace(value).replace(",", "."));
}

// Re-export for callers that use these utilities directly.
export { normalizeWhitespace, normalizeDecimalString, parseNumberValueLib as parseNumberValue };
