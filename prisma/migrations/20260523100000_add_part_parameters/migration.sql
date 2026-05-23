CREATE TYPE "ParameterType" AS ENUM ('TEXT', 'NUMBER', 'QUANTITY', 'BOOLEAN', 'CHOICE');

CREATE TABLE "Parameter" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "type" "ParameterType" NOT NULL,
    "baseUnitSymbol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parameter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParameterChoiceOption" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParameterChoiceOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CategoryParameter" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultTextValue" TEXT,
    "defaultNumberValue" DECIMAL(65,30),
    "defaultQuantityBaseValue" DECIMAL(65,30),
    "defaultBooleanValue" BOOLEAN,
    "defaultChoiceOptionId" TEXT,
    "defaultDisplayValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryParameter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartParameterValue" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DECIMAL(65,30),
    "quantityBaseValue" DECIMAL(65,30),
    "booleanValue" BOOLEAN,
    "choiceOptionId" TEXT,
    "displayValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartParameterValue_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PartCategory" ADD COLUMN "primaryParameterId" TEXT;

CREATE UNIQUE INDEX "Parameter_workspaceId_normalizedName_key" ON "Parameter"("workspaceId", "normalizedName");
CREATE INDEX "Parameter_workspaceId_name_idx" ON "Parameter"("workspaceId", "name");
CREATE INDEX "Parameter_workspaceId_type_idx" ON "Parameter"("workspaceId", "type");

CREATE UNIQUE INDEX "ParameterChoiceOption_parameterId_normalizedLabel_key" ON "ParameterChoiceOption"("parameterId", "normalizedLabel");
CREATE INDEX "ParameterChoiceOption_parameterId_sortOrder_idx" ON "ParameterChoiceOption"("parameterId", "sortOrder");
CREATE INDEX "ParameterChoiceOption_parameterId_label_idx" ON "ParameterChoiceOption"("parameterId", "label");

CREATE UNIQUE INDEX "CategoryParameter_categoryId_parameterId_key" ON "CategoryParameter"("categoryId", "parameterId");
CREATE INDEX "CategoryParameter_workspaceId_categoryId_idx" ON "CategoryParameter"("workspaceId", "categoryId");
CREATE INDEX "CategoryParameter_workspaceId_parameterId_idx" ON "CategoryParameter"("workspaceId", "parameterId");
CREATE INDEX "CategoryParameter_parameterId_idx" ON "CategoryParameter"("parameterId");

CREATE UNIQUE INDEX "PartParameterValue_partId_parameterId_key" ON "PartParameterValue"("partId", "parameterId");
CREATE INDEX "PartParameterValue_workspaceId_partId_idx" ON "PartParameterValue"("workspaceId", "partId");
CREATE INDEX "PartParameterValue_workspaceId_parameterId_idx" ON "PartParameterValue"("workspaceId", "parameterId");
CREATE INDEX "PartParameterValue_parameterId_idx" ON "PartParameterValue"("parameterId");
CREATE INDEX "PartParameterValue_choiceOptionId_idx" ON "PartParameterValue"("choiceOptionId");

CREATE INDEX "PartCategory_workspaceId_primaryParameterId_idx" ON "PartCategory"("workspaceId", "primaryParameterId");

INSERT INTO "Permission" ("key", "description")
VALUES
  ('parameters:read', 'Read part parameters in a workspace.'),
  ('parameters:write', 'Create, update, and delete part parameters in a workspace.')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionKey")
SELECT "id", 'parameters:read'
FROM "Role"
WHERE "name" IN ('reader', 'editor')
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionKey")
SELECT "id", 'parameters:write'
FROM "Role"
WHERE "name" = 'editor'
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

ALTER TABLE "Parameter" ADD CONSTRAINT "Parameter_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParameterChoiceOption" ADD CONSTRAINT "ParameterChoiceOption_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartCategory" ADD CONSTRAINT "PartCategory_primaryParameterId_fkey" FOREIGN KEY ("primaryParameterId") REFERENCES "Parameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoryParameter" ADD CONSTRAINT "CategoryParameter_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryParameter" ADD CONSTRAINT "CategoryParameter_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PartCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategoryParameter" ADD CONSTRAINT "CategoryParameter_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoryParameter" ADD CONSTRAINT "CategoryParameter_defaultChoiceOptionId_fkey" FOREIGN KEY ("defaultChoiceOptionId") REFERENCES "ParameterChoiceOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartParameterValue" ADD CONSTRAINT "PartParameterValue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartParameterValue" ADD CONSTRAINT "PartParameterValue_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartParameterValue" ADD CONSTRAINT "PartParameterValue_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartParameterValue" ADD CONSTRAINT "PartParameterValue_choiceOptionId_fkey" FOREIGN KEY ("choiceOptionId") REFERENCES "ParameterChoiceOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
