import "server-only";

import { WORKSPACE_ATTRIBUTE_SOURCE_ID } from "@/lib/part-attribute-sources";
import { withDomainErrors } from "@/server/api/domainErrors";
import { implementOperation } from "@/server/api/execute";
import { prisma } from "@/server/db/prisma";
import {
  attachOrOverrideCategoryAttribute,
  createAttribute,
  createChoiceOption,
  deleteAttribute,
  deleteChoiceOption,
  detachCategoryAttribute,
  getEffectiveCategoryAttributeConfiguration,
  getEffectiveWorkspaceAttributeConfiguration,
  getWorkspaceAttributePage,
  saveCategoryAttributeConfiguration,
  saveWorkspaceAttributeConfiguration,
  setCategoryValueAttribute,
  updateAttribute,
  updateChoiceOption,
  type AttributeConfigurationEntry,
  type AttributeDefaultValueInput
} from "@/server/parts/attributeMutations";
import {
  attachCategoryAttributeOperation,
  createAttributeOperation,
  createChoiceOptionOperation,
  deleteAttributeOperation,
  deleteChoiceOptionOperation,
  detachCategoryAttributeOperation,
  getCategoryAttributesOperation,
  getWorkspaceAttributesOperation,
  listAttributesOperation,
  saveCategoryAttributeConfigurationOperation,
  saveWorkspaceAttributeConfigurationOperation,
  setCategoryValueAttributeOperation,
  updateAttributeOperation,
  updateChoiceOptionOperation
} from "@/server/parts/attributeOperations";
import type { EffectiveCategoryAttribute } from "@/server/parts/attributes";

/**
 * Part attributes in the API and MCP (#278), over the same domain functions as the attribute
 * dictionary and the category and workspace attribute editors (`attributeActions.ts`).
 */

const attributeErrors = { unique: "duplicate-attribute-name" };
const choiceOptionErrors = { unique: "duplicate-choice-option" };

/** The API's default value (the text as typed in the app, or null) as the domain takes it. */
function toDefaultValue(value: string | null | undefined): AttributeDefaultValueInput {
  return value === null || value === undefined ? null : { rawValue: value };
}

function toConfigurationEntries(
  entries: Array<{
    attributeId: string;
    sortOrder: number;
    defaultValue?: string | null;
    isPrimary?: boolean;
  }>
): AttributeConfigurationEntry[] {
  return entries.map((entry) => ({
    attributeId: entry.attributeId,
    sortOrder: entry.sortOrder,
    defaultValue: toDefaultValue(entry.defaultValue),
    isPrimary: entry.isPrimary ?? false
  }));
}

function toSourceCategoryId(sourceCategoryId: string) {
  return sourceCategoryId === WORKSPACE_ATTRIBUTE_SOURCE_ID ? null : sourceCategoryId;
}

/**
 * An effective attribute as the API describes it: the workspace source is `null`, and the chain
 * of overridden configurations is a flat list, nearest first (JSON Schema without recursion).
 */
function toEffectiveAttribute(effective: EffectiveCategoryAttribute) {
  const overrides = [];

  for (
    let inherited = effective.inheritedAttribute;
    inherited !== null;
    inherited = inherited.inheritedAttribute
  ) {
    overrides.push({
      sourceCategoryId: toSourceCategoryId(inherited.sourceCategoryId),
      sortOrder: inherited.sortOrder,
      defaultValue: inherited.defaultValue,
      isPrimary: inherited.isPrimary
    });
  }

  return {
    attribute: effective.attribute,
    sourceCategoryId: toSourceCategoryId(effective.sourceCategoryId),
    sortOrder: effective.sortOrder,
    defaultValue: effective.defaultValue,
    isValue: effective.isValue,
    isPrimary: effective.isPrimary,
    overrides
  };
}

function toEffectiveAttributes(effective: EffectiveCategoryAttribute[]) {
  return { attributes: effective.map(toEffectiveAttribute) };
}

async function readCategoryAttributes(workspaceId: string, categoryId: string) {
  return toEffectiveAttributes(
    await getEffectiveCategoryAttributeConfiguration({ workspaceId, categoryId })
  );
}

export const listAttributesImplementation = implementOperation(
  listAttributesOperation,
  (actor, input) => getWorkspaceAttributePage({ workspaceId: actor.workspace.id, ...input })
);

export const createAttributeImplementation = implementOperation(
  createAttributeOperation,
  (actor, input) =>
    withDomainErrors(
      () => createAttribute({ workspaceId: actor.workspace.id, ...input }),
      attributeErrors
    )
);

export const updateAttributeImplementation = implementOperation(
  updateAttributeOperation,
  (actor, { attributeId, ...changes }) =>
    withDomainErrors(async () => {
      const current = await prisma.attribute.findFirst({
        where: { id: attributeId, workspaceId: actor.workspace.id },
        select: { name: true, description: true, type: true, baseUnitSymbol: true }
      });

      if (!current) {
        throw new Error("attribute-not-found");
      }

      return updateAttribute({
        workspaceId: actor.workspace.id,
        attributeId,
        name: changes.name ?? current.name,
        description: changes.description === undefined ? current.description : changes.description,
        type: changes.type ?? current.type,
        baseUnitSymbol:
          changes.baseUnitSymbol === undefined ? current.baseUnitSymbol : changes.baseUnitSymbol,
        choiceOptions: changes.choiceOptions
      });
    }, attributeErrors)
);

export const deleteAttributeImplementation = implementOperation(
  deleteAttributeOperation,
  (actor, { attributeId }) =>
    withDomainErrors(async () => {
      const exists = await prisma.attribute.count({
        where: { id: attributeId, workspaceId: actor.workspace.id }
      });

      if (exists === 0) {
        throw new Error("attribute-not-found");
      }

      await deleteAttribute({ workspaceId: actor.workspace.id, attributeId });
      return { id: attributeId };
    }, { foreignKey: "attribute-in-use" })
);

export const createChoiceOptionImplementation = implementOperation(
  createChoiceOptionOperation,
  (actor, input) =>
    withDomainErrors(
      () => createChoiceOption({ workspaceId: actor.workspace.id, ...input }),
      choiceOptionErrors
    )
);

export const updateChoiceOptionImplementation = implementOperation(
  updateChoiceOptionOperation,
  (actor, { optionId, ...changes }) =>
    withDomainErrors(async () => {
      const current = await prisma.attributeChoiceOption.findFirst({
        where: { id: optionId, attribute: { workspaceId: actor.workspace.id } },
        select: { label: true, sortOrder: true }
      });

      if (!current) {
        throw new Error("choice-option-not-found");
      }

      return updateChoiceOption({
        workspaceId: actor.workspace.id,
        optionId,
        label: changes.label ?? current.label,
        sortOrder: changes.sortOrder ?? current.sortOrder
      });
    }, choiceOptionErrors)
);

export const deleteChoiceOptionImplementation = implementOperation(
  deleteChoiceOptionOperation,
  (actor, { optionId }) =>
    withDomainErrors(async () => {
      await deleteChoiceOption({ workspaceId: actor.workspace.id, optionId });
      return { id: optionId };
    }, { foreignKey: "choice-option-in-use" })
);

export const getCategoryAttributesImplementation = implementOperation(
  getCategoryAttributesOperation,
  (actor, { categoryId }) =>
    withDomainErrors(() => readCategoryAttributes(actor.workspace.id, categoryId))
);

export const attachCategoryAttributeImplementation = implementOperation(
  attachCategoryAttributeOperation,
  (actor, input) =>
    withDomainErrors(async () => {
      await attachOrOverrideCategoryAttribute({
        workspaceId: actor.workspace.id,
        categoryId: input.categoryId,
        attributeId: input.attributeId,
        sortOrder: input.sortOrder,
        defaultValue: toDefaultValue(input.defaultValue),
        isPrimary: input.isPrimary ?? false
      });

      return readCategoryAttributes(actor.workspace.id, input.categoryId);
    })
);

export const detachCategoryAttributeImplementation = implementOperation(
  detachCategoryAttributeOperation,
  (actor, { categoryId, attributeId }) =>
    withDomainErrors(async () => {
      await detachCategoryAttribute({ workspaceId: actor.workspace.id, categoryId, attributeId });
      return readCategoryAttributes(actor.workspace.id, categoryId);
    })
);

export const setCategoryValueAttributeImplementation = implementOperation(
  setCategoryValueAttributeOperation,
  (actor, { categoryId, attributeId }) =>
    withDomainErrors(async () => {
      await setCategoryValueAttribute({ workspaceId: actor.workspace.id, categoryId, attributeId });
      return readCategoryAttributes(actor.workspace.id, categoryId);
    })
);

export const saveCategoryAttributeConfigurationImplementation = implementOperation(
  saveCategoryAttributeConfigurationOperation,
  (actor, input) =>
    withDomainErrors(async () =>
      toEffectiveAttributes(
        await saveCategoryAttributeConfiguration({
          workspaceId: actor.workspace.id,
          categoryId: input.categoryId,
          valueAttributeId: input.valueAttributeId,
          attributes: toConfigurationEntries(input.attributes)
        })
      )
    )
);

export const getWorkspaceAttributesImplementation = implementOperation(
  getWorkspaceAttributesOperation,
  async (actor) =>
    toEffectiveAttributes(
      await getEffectiveWorkspaceAttributeConfiguration({ workspaceId: actor.workspace.id })
    )
);

export const saveWorkspaceAttributeConfigurationImplementation = implementOperation(
  saveWorkspaceAttributeConfigurationOperation,
  (actor, input) =>
    withDomainErrors(async () =>
      toEffectiveAttributes(
        await saveWorkspaceAttributeConfiguration({
          workspaceId: actor.workspace.id,
          attributes: toConfigurationEntries(input.attributes)
        })
      )
    )
);
