const siPrefixFactorBySymbol: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  m: 1e-3,
  "": 1,
  k: 1e3,
  M: 1e6,
  G: 1e9
};

function parseQuantityDisplayValue(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(
    /^([+-]?\d+(?:[.,]\d+)?)\s*([pnumkMGµ]?)([a-zA-Z]+)?$/u
  );

  if (!match) {
    return null;
  }

  const numericPart = Number(match[1].replace(",", "."));
  if (!Number.isFinite(numericPart)) {
    return null;
  }

  const prefix = match[2] ?? "";
  const factor = siPrefixFactorBySymbol[prefix];

  if (!factor) {
    return null;
  }

  return numericPart * factor;
}

export function compareTextValues(left: string, right: string) {
  return left.localeCompare(right, "en", {
    sensitivity: "base",
    numeric: true
  });
}

export function compareNumericDisplayValues(left: string, right: string) {
  const leftNumber = Number(left.replace(",", "."));
  const rightNumber = Number(right.replace(",", "."));
  const leftValid = Number.isFinite(leftNumber);
  const rightValid = Number.isFinite(rightNumber);

  if (!leftValid && !rightValid) {
    return compareTextValues(left, right);
  }
  if (!leftValid) {
    return 1;
  }
  if (!rightValid) {
    return -1;
  }
  if (leftNumber < rightNumber) {
    return -1;
  }
  if (leftNumber > rightNumber) {
    return 1;
  }
  return 0;
}

export function compareQuantityDisplayValues(left: string, right: string) {
  const leftQuantity = parseQuantityDisplayValue(left);
  const rightQuantity = parseQuantityDisplayValue(right);

  if (leftQuantity === null && rightQuantity === null) {
    return compareTextValues(left, right);
  }
  if (leftQuantity === null) {
    return 1;
  }
  if (rightQuantity === null) {
    return -1;
  }
  if (leftQuantity < rightQuantity) {
    return -1;
  }
  if (leftQuantity > rightQuantity) {
    return 1;
  }
  return 0;
}

export function formatFilteredPartsSummary(
  copy: { filteredPartsSummary: string },
  counts: { total: number; visible: number }
) {
  return copy.filteredPartsSummary
    .replace("{visible}", counts.visible.toLocaleString("en"))
    .replace("{total}", counts.total.toLocaleString("en"));
}
