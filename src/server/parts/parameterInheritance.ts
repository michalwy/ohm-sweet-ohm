import type {
  EffectiveCategoryParameter,
  EffectiveParameterDefaultValue
} from "./parameters";
import type { ParameterValueType } from "./parameterValues";

export type CategoryParameterInheritanceInput = {
  categoryChain: Array<{
    id: string;
    valueParameterId: string | null;
  }>;
  categoryParameters: Array<{
    categoryId: string;
    parameterId: string;
    sortOrder: number;
    isPrimary: boolean;
    defaultValue: EffectiveParameterDefaultValue | null;
    parameter: {
      id: string;
      name: string;
      description: string | null;
      type: ParameterValueType;
      baseUnitSymbol: string | null;
      choiceOptions: Array<{
        id: string;
        label: string;
        sortOrder: number;
      }>;
    };
  }>;
};

export function resolveEffectiveCategoryParameters({
  categoryChain,
  categoryParameters
}: CategoryParameterInheritanceInput): EffectiveCategoryParameter[] {
  const parametersByCategoryId = new Map<string, typeof categoryParameters>();

  for (const categoryParameter of categoryParameters) {
    const existing = parametersByCategoryId.get(categoryParameter.categoryId) ?? [];
    existing.push(categoryParameter);
    parametersByCategoryId.set(categoryParameter.categoryId, existing);
  }

  const effectiveByParameterId = new Map<string, EffectiveCategoryParameter>();

  for (const category of categoryChain) {
    const localParameters = parametersByCategoryId.get(category.id) ?? [];

    for (const categoryParameter of localParameters) {
      const inheritedParameter =
        effectiveByParameterId.get(categoryParameter.parameterId) ?? null;

      effectiveByParameterId.set(categoryParameter.parameterId, {
        parameter: categoryParameter.parameter,
        sourceCategoryId: category.id,
        sortOrder: categoryParameter.sortOrder,
        defaultValue: categoryParameter.defaultValue,
        isValue: false,
        isPrimary: categoryParameter.isPrimary,
        inheritedParameter
      });
    }
  }

  const valueParameterId = getEffectiveValueParameterId(categoryChain);

  return [...effectiveByParameterId.values()]
    .map((effectiveParameter) => ({
      ...effectiveParameter,
      isValue: effectiveParameter.parameter.id === valueParameterId
    }))
    .sort((left, right) => {
      const sortOrderDifference = left.sortOrder - right.sortOrder;

      if (sortOrderDifference !== 0) {
        return sortOrderDifference;
      }

      return left.parameter.name.localeCompare(right.parameter.name, "en", {
        sensitivity: "base"
      });
    });
}

export function getEffectiveValueParameterId(
  categoryChain: Array<{
    valueParameterId: string | null;
  }>
) {
  for (const category of [...categoryChain].reverse()) {
    if (category.valueParameterId) {
      return category.valueParameterId;
    }
  }

  return null;
}
