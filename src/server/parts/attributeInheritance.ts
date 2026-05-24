import type {
  EffectiveCategoryAttribute,
  EffectiveAttributeDefaultValue
} from "./attributes";
import type { AttributeValueType } from "./attributeValues";

export type CategoryAttributeInheritanceInput = {
  categoryChain: Array<{
    id: string;
    valueAttributeId: string | null;
  }>;
  categoryAttributes: Array<{
    categoryId: string;
    attributeId: string;
    sortOrder: number;
    isPrimary: boolean;
    defaultValue: EffectiveAttributeDefaultValue | null;
    attribute: {
      id: string;
      name: string;
      description: string | null;
      type: AttributeValueType;
      baseUnitSymbol: string | null;
      choiceOptions: Array<{
        id: string;
        label: string;
        sortOrder: number;
      }>;
    };
  }>;
};

export function resolveEffectiveCategoryAttributes({
  categoryChain,
  categoryAttributes
}: CategoryAttributeInheritanceInput): EffectiveCategoryAttribute[] {
  const attributesByCategoryId = new Map<string, typeof categoryAttributes>();

  for (const categoryAttribute of categoryAttributes) {
    const existing = attributesByCategoryId.get(categoryAttribute.categoryId) ?? [];
    existing.push(categoryAttribute);
    attributesByCategoryId.set(categoryAttribute.categoryId, existing);
  }

  const effectiveByAttributeId = new Map<string, EffectiveCategoryAttribute>();

  for (const category of categoryChain) {
    const localAttributes = attributesByCategoryId.get(category.id) ?? [];

    for (const categoryAttribute of localAttributes) {
      const inheritedAttribute =
        effectiveByAttributeId.get(categoryAttribute.attributeId) ?? null;

      effectiveByAttributeId.set(categoryAttribute.attributeId, {
        attribute: categoryAttribute.attribute,
        sourceCategoryId: category.id,
        sortOrder: categoryAttribute.sortOrder,
        defaultValue: categoryAttribute.defaultValue,
        isValue: false,
        isPrimary: categoryAttribute.isPrimary,
        inheritedAttribute
      });
    }
  }

  const valueAttributeId = getEffectiveValueAttributeId(categoryChain);

  return [...effectiveByAttributeId.values()]
    .map((effectiveAttribute) => ({
      ...effectiveAttribute,
      isValue: effectiveAttribute.attribute.id === valueAttributeId
    }))
    .sort((left, right) => {
      const sortOrderDifference = left.sortOrder - right.sortOrder;

      if (sortOrderDifference !== 0) {
        return sortOrderDifference;
      }

      return left.attribute.name.localeCompare(right.attribute.name, "en", {
        sensitivity: "base"
      });
    });
}

export function getEffectiveValueAttributeId(
  categoryChain: Array<{
    valueAttributeId: string | null;
  }>
) {
  for (const category of [...categoryChain].reverse()) {
    if (category.valueAttributeId) {
      return category.valueAttributeId;
    }
  }

  return null;
}
