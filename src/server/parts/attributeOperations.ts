import { z } from "zod";

import { listPageInputShape, listPageOutputSchema } from "@/server/api/listSchemas";
import { defineOperation } from "@/server/api/operations";

/**
 * Part attributes and their configuration on categories and the workspace in the API and MCP
 * (#278). Pure, so unit tests and the OpenAPI document can load it; the implementations are in
 * `attributeApi.ts`.
 */

export const attributeValueTypes = ["TEXT", "NUMBER", "QUANTITY", "BOOLEAN", "CHOICE"] as const;

export const choiceOptionSchema = z.object({
  id: z.string().describe("The choice option's id."),
  label: z.string().describe("The option's label, unique within its attribute (case is ignored)."),
  sortOrder: z.number().int().describe("Position among the attribute's options, ascending.")
});

export const attributeSchema = z.object({
  id: z.string().describe("The attribute's id."),
  name: z.string().describe("The attribute's name, unique in the workspace, e.g. \"Resistance\"."),
  description: z.string().nullable().describe("A description; null when unset."),
  type: z
    .enum(attributeValueTypes)
    .describe(
      "What values hold: TEXT, NUMBER, QUANTITY (a number with a unit, e.g. 4.7 kΩ), BOOLEAN or CHOICE (one of the options)."
    ),
  baseUnitSymbol: z
    .string()
    .nullable()
    .describe("The base unit of a QUANTITY attribute, e.g. \"Ω\" or \"F\"; null for other types."),
  choiceOptions: z
    .array(choiceOptionSchema)
    .describe("The options of a CHOICE attribute, sorted; empty for other types.")
});

const attributeIdInput = z.string().min(1).describe("The attribute's id, as list_attributes returns it.");
const categoryIdInput = z
  .string()
  .min(1)
  .describe("The category's id, as get_part_category_tree returns it.");
const optionIdInput = z
  .string()
  .min(1)
  .describe("The choice option's id, as list_attributes returns it in choiceOptions.");

const defaultValueInput = z
  .string()
  .nullable()
  .describe(
    "The default value parts get, written as in the app (e.g. \"4.7k\" or \"4.7 kΩ\" for a QUANTITY, \"yes\" for a BOOLEAN, an option's label for a CHOICE); null for no default."
  );

const attributeConfigurationEntryInput = z.object({
  attributeId: attributeIdInput,
  sortOrder: z.number().int().describe("Position among the attributes, ascending."),
  defaultValue: defaultValueInput.optional(),
  isPrimary: z
    .boolean()
    .optional()
    .describe("Whether the attribute is shown in the parts list's primary columns; false when omitted.")
});

const effectiveDefaultValueSchema = z
  .object({
    textValue: z.string().nullable().describe("The default of a TEXT attribute."),
    numberValue: z.string().nullable().describe("The default of a NUMBER attribute, as a decimal string."),
    quantityBaseValue: z
      .string()
      .nullable()
      .describe("The default of a QUANTITY attribute in its base unit, as a decimal string."),
    booleanValue: z.boolean().nullable().describe("The default of a BOOLEAN attribute."),
    choiceOptionId: z.string().nullable().describe("The default option of a CHOICE attribute."),
    displayValue: z.string().nullable().describe("The default as the app shows it, e.g. \"4.7 kΩ\".")
  })
  .nullable()
  .describe("The default value parts get; null for none.");

const sourceCategoryIdSchema = z
  .string()
  .nullable()
  .describe("The category this configuration is set on; null when it is set on the workspace (every part gets it).");

export const effectiveAttributeSchema = z.object({
  attribute: attributeSchema.describe("The attribute."),
  sourceCategoryId: sourceCategoryIdSchema,
  sortOrder: z.number().int().describe("Position among the attributes, ascending."),
  defaultValue: effectiveDefaultValueSchema,
  isValue: z
    .boolean()
    .describe("Whether this is the category's value attribute, set on it or inherited: the one that names a part's value (e.g. Resistance for resistors)."),
  isPrimary: z.boolean().describe("Whether the attribute is shown in the parts list's primary columns."),
  overrides: z
    .array(
      z.object({
        sourceCategoryId: sourceCategoryIdSchema,
        sortOrder: z.number().int().describe("Position set there."),
        defaultValue: effectiveDefaultValueSchema,
        isPrimary: z.boolean().describe("Primary flag set there.")
      })
    )
    .describe(
      "The configurations of the same attribute further up (a parent category, then the workspace) that this one overrides, nearest first; empty when it overrides none."
    )
});

const effectiveAttributesOutput = z.object({
  attributes: z
    .array(effectiveAttributeSchema)
    .describe("The effective attributes, in the order the app shows them.")
});

export const attributeListSortFields = ["name", "type", "baseUnit", "description"] as const;

export const listAttributesOperation = defineOperation({
  name: "list_attributes",
  description:
    "List the workspace's attribute dictionary (the attributes parts can carry, with a CHOICE attribute's options), one page at a time.",
  permission: "attributes:read",
  input: z.object({
    ...listPageInputShape,
    sortBy: z.enum(attributeListSortFields).optional().describe("Field to sort by; name when omitted.")
  }),
  output: listPageOutputSchema(attributeSchema)
});

export const createAttributeOperation = defineOperation({
  name: "create_attribute",
  description:
    "Create an attribute in the workspace's dictionary. A QUANTITY attribute needs a base unit symbol; a CHOICE attribute may be created with its options.",
  permission: "attributes:write",
  input: z.object({
    name: z.string().min(1).describe("The attribute's name, unique in the workspace (case and spacing are ignored)."),
    description: z.string().nullable().optional().describe("A description; omit or null for none."),
    type: attributeSchema.shape.type,
    baseUnitSymbol: z
      .string()
      .nullable()
      .optional()
      .describe("Required for a QUANTITY attribute: its base unit, e.g. \"Ω\", \"F\", \"V\". Ignored for other types."),
    choiceOptions: z
      .array(
        z.object({
          label: z.string().min(1).describe("The option's label."),
          sortOrder: z.number().int().describe("Position among the options, ascending.")
        })
      )
      .optional()
      .describe("The options of a CHOICE attribute; ignored for other types.")
  }),
  output: attributeSchema
});

export const updateAttributeOperation = defineOperation({
  name: "update_attribute",
  description:
    "Change an attribute. Fields left out keep their current value. Its type or base unit cannot change while parts or defaults hold values of it (attribute-shape-in-use). Passing choiceOptions replaces a CHOICE attribute's whole option list: options with an id are kept and updated, options without one are added, and options left out are deleted (an option a part uses cannot be: choice-option-in-use).",
  permission: "attributes:write",
  input: z.object({
    attributeId: attributeIdInput,
    name: z.string().min(1).optional().describe("The new name, unique in the workspace."),
    description: z.string().nullable().optional().describe("The new description; null clears it."),
    type: attributeSchema.shape.type.optional(),
    baseUnitSymbol: z
      .string()
      .nullable()
      .optional()
      .describe("The base unit of a QUANTITY attribute."),
    choiceOptions: z
      .array(
        z.object({
          id: z.string().optional().describe("An existing option's id; omit to add a new option."),
          label: z.string().min(1).describe("The option's label."),
          sortOrder: z.number().int().describe("Position among the options, ascending.")
        })
      )
      .optional()
      .describe("The CHOICE attribute's complete option list; omit to leave the options alone.")
  }),
  output: attributeSchema
});

export const deleteAttributeOperation = defineOperation({
  name: "delete_attribute",
  description:
    "Delete an attribute from the dictionary. An attribute that parts, categories or the workspace use cannot be deleted (attribute-in-use).",
  permission: "attributes:write",
  input: z.object({ attributeId: attributeIdInput }),
  output: z.object({ id: z.string().describe("The deleted attribute's id.") })
});

export const createChoiceOptionOperation = defineOperation({
  name: "create_attribute_choice_option",
  description: "Add an option to a CHOICE attribute.",
  permission: "attributes:write",
  input: z.object({
    attributeId: attributeIdInput.describe("The CHOICE attribute's id."),
    label: z.string().min(1).describe("The option's label, unique within the attribute."),
    sortOrder: z.number().int().describe("Position among the options, ascending.")
  }),
  output: choiceOptionSchema
});

export const updateChoiceOptionOperation = defineOperation({
  name: "update_attribute_choice_option",
  description: "Rename or reorder an option of a CHOICE attribute. Fields left out keep their current value.",
  permission: "attributes:write",
  input: z.object({
    optionId: optionIdInput,
    label: z.string().min(1).optional().describe("The new label, unique within the attribute."),
    sortOrder: z.number().int().optional().describe("The new position, ascending.")
  }),
  output: choiceOptionSchema
});

export const deleteChoiceOptionOperation = defineOperation({
  name: "delete_attribute_choice_option",
  description:
    "Delete an option of a CHOICE attribute. An option a part or a default uses cannot be deleted (choice-option-in-use).",
  permission: "attributes:write",
  input: z.object({ optionId: optionIdInput }),
  output: z.object({ id: z.string().describe("The deleted option's id.") })
});

export const getCategoryAttributesOperation = defineOperation({
  name: "get_category_attributes",
  description:
    "A category's effective attributes: the ones set on the workspace, its ancestors and itself, with the nearest configuration winning, and which one is its value attribute.",
  permission: "attributes:read",
  input: z.object({ categoryId: categoryIdInput }),
  output: effectiveAttributesOutput
});

export const attachCategoryAttributeOperation = defineOperation({
  name: "attach_category_attribute",
  description:
    "Attach an attribute to a category, or override how the category inherits it: its position, default value and primary flag. Attaching one already attached updates it.",
  permission: "attributes:write",
  input: z.object({
    categoryId: categoryIdInput,
    attributeId: attributeIdInput,
    sortOrder: z.number().int().describe("Position among the category's attributes, ascending."),
    defaultValue: defaultValueInput.optional(),
    isPrimary: z
      .boolean()
      .optional()
      .describe("Whether the attribute is shown in the parts list's primary columns; false when omitted.")
  }),
  output: effectiveAttributesOutput
});

export const detachCategoryAttributeOperation = defineOperation({
  name: "detach_category_attribute",
  description:
    "Remove an attribute set on the category itself; an inherited one stays, from where it is set. Detaching an attribute not set on the category changes nothing.",
  permission: "attributes:write",
  input: z.object({ categoryId: categoryIdInput, attributeId: attributeIdInput }),
  output: effectiveAttributesOutput
});

export const setCategoryValueAttributeOperation = defineOperation({
  name: "set_category_value_attribute",
  description:
    "Choose the category's value attribute — the one that names its parts' value and sorts them (e.g. Resistance for resistors) — or clear it, so the category inherits its parent's again. It must be one of the category's effective attributes (primary-attribute-not-effective).",
  permission: "attributes:write",
  input: z.object({
    categoryId: categoryIdInput,
    attributeId: attributeIdInput
      .nullable()
      .describe("The attribute's id, or null to clear the value attribute.")
  }),
  output: effectiveAttributesOutput
});

export const saveCategoryAttributeConfigurationOperation = defineOperation({
  name: "save_category_attribute_configuration",
  description:
    "Replace a category's own attribute configuration in one call, as the category's attribute editor saves it: every listed attribute is attached or updated, the category's own attributes not listed are detached (inherited ones stay), and the value attribute is set.",
  permission: "attributes:write",
  input: z.object({
    categoryId: categoryIdInput,
    valueAttributeId: attributeIdInput
      .nullable()
      .describe("The value attribute's id, or null for none."),
    attributes: z
      .array(attributeConfigurationEntryInput)
      .describe("The category's own attributes, complete.")
  }),
  output: effectiveAttributesOutput
});

export const getWorkspaceAttributesOperation = defineOperation({
  name: "get_workspace_attributes",
  description: "The attributes set on the workspace itself, which every part gets whatever its category.",
  permission: "attributes:read",
  input: z.object({}),
  output: effectiveAttributesOutput
});

export const saveWorkspaceAttributeConfigurationOperation = defineOperation({
  name: "save_workspace_attribute_configuration",
  description:
    "Replace the attributes set on the workspace itself in one call: every listed attribute is attached or updated, and the ones not listed are removed from the workspace (not from the dictionary).",
  permission: "attributes:write",
  input: z.object({
    attributes: z
      .array(attributeConfigurationEntryInput)
      .describe("The workspace's attributes, complete.")
  }),
  output: effectiveAttributesOutput
});
