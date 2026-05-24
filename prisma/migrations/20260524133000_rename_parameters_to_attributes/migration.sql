ALTER TYPE "ParameterType" RENAME TO "AttributeType";

ALTER TABLE "Parameter" RENAME TO "Attribute";
ALTER TABLE "ParameterChoiceOption" RENAME TO "AttributeChoiceOption";
ALTER TABLE "CategoryParameter" RENAME TO "CategoryAttribute";
ALTER TABLE "PartParameterValue" RENAME TO "PartAttributeValue";

ALTER TABLE "AttributeChoiceOption" RENAME COLUMN "parameterId" TO "attributeId";
ALTER TABLE "CategoryAttribute" RENAME COLUMN "parameterId" TO "attributeId";
ALTER TABLE "PartAttributeValue" RENAME COLUMN "parameterId" TO "attributeId";
ALTER TABLE "PartCategory" RENAME COLUMN "valueParameterId" TO "valueAttributeId";

ALTER TABLE "Attribute" RENAME CONSTRAINT "Parameter_pkey" TO "Attribute_pkey";
ALTER TABLE "AttributeChoiceOption" RENAME CONSTRAINT "ParameterChoiceOption_pkey" TO "AttributeChoiceOption_pkey";
ALTER TABLE "CategoryAttribute" RENAME CONSTRAINT "CategoryParameter_pkey" TO "CategoryAttribute_pkey";
ALTER TABLE "PartAttributeValue" RENAME CONSTRAINT "PartParameterValue_pkey" TO "PartAttributeValue_pkey";

ALTER INDEX "Parameter_workspaceId_normalizedName_key" RENAME TO "Attribute_workspaceId_normalizedName_key";
ALTER INDEX "Parameter_workspaceId_name_idx" RENAME TO "Attribute_workspaceId_name_idx";
ALTER INDEX "Parameter_workspaceId_type_idx" RENAME TO "Attribute_workspaceId_type_idx";

ALTER INDEX "ParameterChoiceOption_parameterId_normalizedLabel_key" RENAME TO "AttributeChoiceOption_attributeId_normalizedLabel_key";
ALTER INDEX "ParameterChoiceOption_parameterId_sortOrder_idx" RENAME TO "AttributeChoiceOption_attributeId_sortOrder_idx";
ALTER INDEX "ParameterChoiceOption_parameterId_label_idx" RENAME TO "AttributeChoiceOption_attributeId_label_idx";

ALTER INDEX "CategoryParameter_categoryId_parameterId_key" RENAME TO "CategoryAttribute_categoryId_attributeId_key";
ALTER INDEX "CategoryParameter_workspaceId_categoryId_idx" RENAME TO "CategoryAttribute_workspaceId_categoryId_idx";
ALTER INDEX "CategoryParameter_workspaceId_parameterId_idx" RENAME TO "CategoryAttribute_workspaceId_attributeId_idx";
ALTER INDEX "CategoryParameter_parameterId_idx" RENAME TO "CategoryAttribute_attributeId_idx";

ALTER INDEX "PartParameterValue_partId_parameterId_key" RENAME TO "PartAttributeValue_partId_attributeId_key";
ALTER INDEX "PartParameterValue_workspaceId_partId_idx" RENAME TO "PartAttributeValue_workspaceId_partId_idx";
ALTER INDEX "PartParameterValue_workspaceId_parameterId_idx" RENAME TO "PartAttributeValue_workspaceId_attributeId_idx";
ALTER INDEX "PartParameterValue_parameterId_idx" RENAME TO "PartAttributeValue_attributeId_idx";
ALTER INDEX "PartParameterValue_choiceOptionId_idx" RENAME TO "PartAttributeValue_choiceOptionId_idx";

ALTER INDEX "PartCategory_workspaceId_valueParameterId_idx" RENAME TO "PartCategory_workspaceId_valueAttributeId_idx";

ALTER TABLE "Attribute" RENAME CONSTRAINT "Parameter_workspaceId_fkey" TO "Attribute_workspaceId_fkey";
ALTER TABLE "AttributeChoiceOption" RENAME CONSTRAINT "ParameterChoiceOption_parameterId_fkey" TO "AttributeChoiceOption_attributeId_fkey";
ALTER TABLE "PartCategory" RENAME CONSTRAINT "PartCategory_valueParameterId_fkey" TO "PartCategory_valueAttributeId_fkey";
ALTER TABLE "CategoryAttribute" RENAME CONSTRAINT "CategoryParameter_workspaceId_fkey" TO "CategoryAttribute_workspaceId_fkey";
ALTER TABLE "CategoryAttribute" RENAME CONSTRAINT "CategoryParameter_categoryId_fkey" TO "CategoryAttribute_categoryId_fkey";
ALTER TABLE "CategoryAttribute" RENAME CONSTRAINT "CategoryParameter_parameterId_fkey" TO "CategoryAttribute_attributeId_fkey";
ALTER TABLE "CategoryAttribute" RENAME CONSTRAINT "CategoryParameter_defaultChoiceOptionId_fkey" TO "CategoryAttribute_defaultChoiceOptionId_fkey";
ALTER TABLE "PartAttributeValue" RENAME CONSTRAINT "PartParameterValue_workspaceId_fkey" TO "PartAttributeValue_workspaceId_fkey";
ALTER TABLE "PartAttributeValue" RENAME CONSTRAINT "PartParameterValue_partId_fkey" TO "PartAttributeValue_partId_fkey";
ALTER TABLE "PartAttributeValue" RENAME CONSTRAINT "PartParameterValue_parameterId_fkey" TO "PartAttributeValue_attributeId_fkey";
ALTER TABLE "PartAttributeValue" RENAME CONSTRAINT "PartParameterValue_choiceOptionId_fkey" TO "PartAttributeValue_choiceOptionId_fkey";

INSERT INTO "Permission" ("key", "description")
VALUES
  ('attributes:read', 'Read part attributes in a workspace.'),
  ('attributes:write', 'Create, update, and delete part attributes in a workspace.')
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "RolePermission" ("roleId", "permissionKey")
SELECT "roleId", 'attributes:read'
FROM "RolePermission"
WHERE "permissionKey" = 'parameters:read'
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionKey")
SELECT "roleId", 'attributes:write'
FROM "RolePermission"
WHERE "permissionKey" = 'parameters:write'
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

DELETE FROM "RolePermission"
WHERE "permissionKey" IN ('parameters:read', 'parameters:write');

DELETE FROM "Permission"
WHERE "key" IN ('parameters:read', 'parameters:write');
