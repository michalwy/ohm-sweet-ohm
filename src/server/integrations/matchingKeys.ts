// Pure key helpers shared by the supplier matching suggestion action (`matching.ts`) and the
// learning step of part creation (`matchingLearning.ts`). Not a "use server" module: nothing here
// is meant to be callable from the browser.

const UNCATEGORIZED_SOURCE_KEY = "uncategorized";
const NO_TARGET_CATEGORY_SCOPE_KEY = "__none__";

export function normalizeSourceCategoryKey(sourceCategory: string | null | undefined) {
  if (!sourceCategory) {
    return UNCATEGORIZED_SOURCE_KEY;
  }

  const normalized = normalizeKey(sourceCategory);
  return normalized || UNCATEGORIZED_SOURCE_KEY;
}

export function normalizeSourceManufacturerKey(
  sourceManufacturerName: string | null | undefined
) {
  if (!sourceManufacturerName) {
    return UNCATEGORIZED_SOURCE_KEY;
  }

  const normalized = normalizeKey(sourceManufacturerName);
  return normalized || UNCATEGORIZED_SOURCE_KEY;
}

export function buildSourceAttributeKey(input: {
  name: string;
  unit?: string | null;
}) {
  const nameKey = normalizeKey(input.name);
  const unitKey = normalizeKey(input.unit ?? "");

  return `${nameKey}::${unitKey}`;
}

export function normalizeSourceValue(value: string) {
  return value.trim();
}

export function formatSourceAttributeDisplay(input: { name: string; unit?: string | null }) {
  const name = input.name.trim();
  const unit = (input.unit ?? "").trim();

  return unit ? `${name} (${unit})` : name;
}

export function getTargetCategoryScopeKey(targetCategoryId: string | null) {
  return targetCategoryId || NO_TARGET_CATEGORY_SCOPE_KEY;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");
}
