CREATE TABLE "PartCategory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "isAssignable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartCategoryClosure" (
    "workspaceId" TEXT NOT NULL,
    "ancestorId" TEXT NOT NULL,
    "descendantId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "PartCategoryClosure_pkey" PRIMARY KEY ("ancestorId","descendantId")
);

ALTER TABLE "Part" ADD COLUMN "primaryCategoryId" TEXT;
ALTER TABLE "Part" ADD COLUMN "secondaryCategoryId" TEXT;

CREATE INDEX "Part_workspaceId_primaryCategoryId_idx" ON "Part"("workspaceId", "primaryCategoryId");
CREATE INDEX "Part_workspaceId_secondaryCategoryId_idx" ON "Part"("workspaceId", "secondaryCategoryId");
CREATE INDEX "PartCategory_workspaceId_idx" ON "PartCategory"("workspaceId");
CREATE INDEX "PartCategory_workspaceId_parentId_idx" ON "PartCategory"("workspaceId", "parentId");
CREATE INDEX "PartCategory_workspaceId_name_idx" ON "PartCategory"("workspaceId", "name");
CREATE INDEX "PartCategoryClosure_workspaceId_ancestorId_idx" ON "PartCategoryClosure"("workspaceId", "ancestorId");
CREATE INDEX "PartCategoryClosure_workspaceId_descendantId_idx" ON "PartCategoryClosure"("workspaceId", "descendantId");

INSERT INTO "Permission" ("key", "description")
VALUES
  ('part-categories:read', 'Read part categories in a workspace.'),
  ('part-categories:write', 'Create, update, and delete part categories in a workspace.')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionKey")
SELECT "id", 'part-categories:read'
FROM "Role"
WHERE "name" IN ('reader', 'editor')
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionKey")
SELECT "id", 'part-categories:write'
FROM "Role"
WHERE "name" = 'editor'
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

ALTER TABLE "Part" ADD CONSTRAINT "Part_primaryCategoryId_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "PartCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Part" ADD CONSTRAINT "Part_secondaryCategoryId_fkey" FOREIGN KEY ("secondaryCategoryId") REFERENCES "PartCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartCategory" ADD CONSTRAINT "PartCategory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartCategory" ADD CONSTRAINT "PartCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PartCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartCategoryClosure" ADD CONSTRAINT "PartCategoryClosure_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartCategoryClosure" ADD CONSTRAINT "PartCategoryClosure_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "PartCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartCategoryClosure" ADD CONSTRAINT "PartCategoryClosure_descendantId_fkey" FOREIGN KEY ("descendantId") REFERENCES "PartCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
