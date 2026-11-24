import { z } from "zod";

import { CURRENCIES } from "@/app/currencies";
import { listPageInputShape, listPageOutputSchema } from "@/server/api/listSchemas";
import { defineOperation } from "@/server/api/operations";

/**
 * Organizations — manufacturers and suppliers — in the API and MCP (#279). Pure, so unit tests and
 * the OpenAPI document can load it; the implementations are in `organizationApi.ts`, and the server
 * actions in `organizationActions.ts` validate their input through the same schemas.
 */

export const ORGANIZATION_ROLE_MANUFACTURER = "manufacturer";
export const ORGANIZATION_ROLE_SUPPLIER = "supplier";

export const ORGANIZATION_ROLES = [
  ORGANIZATION_ROLE_MANUFACTURER,
  ORGANIZATION_ROLE_SUPPLIER
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

/** The currencies the organization form offers (`src/app/currencies.ts`). */
const ORGANIZATION_CURRENCIES = CURRENCIES.map((currency) => currency.code) as [
  (typeof CURRENCIES)[number]["code"],
  ...(typeof CURRENCIES)[number]["code"][]
];

/** A tax rate in percent: 0 up to (not including) 100, as the workspace's own default allows. */
const TAX_RATE_PATTERN = /^\d{1,2}(\.\d+)?$/;

const organizationRolesSchema = z
  .array(z.enum(ORGANIZATION_ROLES))
  .min(1)
  .describe("The organization's roles: at least one of \"manufacturer\" and \"supplier\".");

const currencySchema = z
  .enum(ORGANIZATION_CURRENCIES)
  .nullable()
  .describe(
    "ISO 4217 code of the currency the organization sells in, used as the default for its purchase orders; null for none."
  );

const priceEntryModeSchema = z
  .enum(["net", "gross"])
  .nullable()
  .describe(
    "Whether prices on the organization's purchase orders are entered \"net\" or \"gross\" by default; null to use the workspace's default."
  );

const taxRateSchema = z
  .string()
  .regex(TAX_RATE_PATTERN)
  .nullable()
  .describe(
    "Default tax rate in percent for the organization's purchase orders, a decimal string from 0 to below 100 (e.g. \"23\" or \"8.5\"); null to use the workspace's default."
  );

const organizationIdSchema = z.string().min(1).describe("The organization's id.");

export const organizationSchema = z.object({
  id: z.string().describe("The organization's id."),
  name: z.string().describe("The organization's name, unique in the workspace (case-insensitive)."),
  roles: z
    .array(z.string())
    .describe("The organization's roles: \"manufacturer\", \"supplier\", or both."),
  currency: z
    .string()
    .nullable()
    .describe("ISO 4217 code of the currency the organization sells in; null when unset."),
  defaultPriceEntryMode: z
    .string()
    .nullable()
    .describe("\"net\" or \"gross\": how its purchase-order prices are entered; null when unset."),
  defaultTaxRate: z
    .string()
    .nullable()
    .describe("Default tax rate in percent, as a decimal string; null when unset."),
  createdAt: z.iso.datetime().describe("When the organization was created (ISO 8601, UTC).")
});

export const listOrganizationsOperation = defineOperation({
  name: "list_organizations",
  description:
    "List the workspace's organizations (manufacturers and suppliers) by name, one page at a time, optionally filtered by a name search and a role.",
  permission: "organizations:read",
  input: z.object({
    ...listPageInputShape,
    searchQuery: z
      .string()
      .nullish()
      .describe("Only organizations whose name contains this text, ignoring case."),
    roleFilter: z
      .enum(ORGANIZATION_ROLES)
      .nullish()
      .describe("Only organizations with this role.")
  }),
  output: listPageOutputSchema(organizationSchema)
});

export const getOrganizationOperation = defineOperation({
  name: "get_organization",
  description: "One organization of the workspace, by id.",
  permission: "organizations:read",
  input: z.object({ id: organizationIdSchema }),
  output: organizationSchema
});

export const createOrganizationOperation = defineOperation({
  name: "create_organization",
  description:
    "Create an organization — a manufacturer, a supplier, or both. The name must be unique in the workspace, ignoring case and repeated spaces.",
  permission: "organizations:write",
  input: z.object({
    name: z
      .string()
      .describe("The organization's name; surrounding and repeated spaces are collapsed."),
    roles: organizationRolesSchema,
    currency: currencySchema.optional(),
    defaultPriceEntryMode: priceEntryModeSchema.optional(),
    defaultTaxRate: taxRateSchema.optional()
  }),
  output: organizationSchema
});

export const updateOrganizationOperation = defineOperation({
  name: "update_organization",
  description:
    "Change an organization. Only the fields sent change; send null to clear currency, defaultPriceEntryMode or defaultTaxRate. roles replaces the whole set.",
  permission: "organizations:write",
  input: z.object({
    id: organizationIdSchema,
    name: z
      .string()
      .optional()
      .describe("The new name; unique in the workspace. Unchanged when omitted."),
    roles: organizationRolesSchema.optional(),
    currency: currencySchema.optional(),
    defaultPriceEntryMode: priceEntryModeSchema.optional(),
    defaultTaxRate: taxRateSchema.optional()
  }),
  output: organizationSchema
});

export const deleteOrganizationOperation = defineOperation({
  name: "delete_organization",
  description:
    "Delete an organization. Refused while any part names it as manufacturer (referenced-by-parts) or any purchase order names it as supplier (referenced-by-purchase-orders).",
  permission: "organizations:write",
  input: z.object({ id: organizationIdSchema }),
  output: z.object({ id: z.string().describe("The deleted organization's id.") })
});
