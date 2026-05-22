CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationRole" (
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationRole_pkey" PRIMARY KEY ("organizationId","role")
);

ALTER TABLE "Part" ADD COLUMN "manufacturerId" TEXT;

INSERT INTO "Organization" ("id", "workspaceId", "name", "normalizedName", "createdAt", "updatedAt")
SELECT
  'org_' || md5("workspaceId" || ':' || lower(regexp_replace(trim("manufacturerName"), '\s+', ' ', 'g'))),
  "workspaceId",
  min(regexp_replace(trim("manufacturerName"), '\s+', ' ', 'g')),
  lower(regexp_replace(trim("manufacturerName"), '\s+', ' ', 'g')),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Part"
GROUP BY "workspaceId", lower(regexp_replace(trim("manufacturerName"), '\s+', ' ', 'g'));

INSERT INTO "OrganizationRole" ("organizationId", "role")
SELECT "id", 'manufacturer'
FROM "Organization";

UPDATE "Part"
SET "manufacturerId" = "Organization"."id"
FROM "Organization"
WHERE "Part"."workspaceId" = "Organization"."workspaceId"
  AND lower(regexp_replace(trim("Part"."manufacturerName"), '\s+', ' ', 'g')) = "Organization"."normalizedName";

ALTER TABLE "Part" ALTER COLUMN "manufacturerId" SET NOT NULL;
ALTER TABLE "Part" DROP COLUMN "manufacturerName";

CREATE UNIQUE INDEX "Organization_workspaceId_normalizedName_key" ON "Organization"("workspaceId", "normalizedName");
CREATE INDEX "Organization_workspaceId_name_idx" ON "Organization"("workspaceId", "name");
CREATE INDEX "OrganizationRole_role_idx" ON "OrganizationRole"("role");
CREATE INDEX "Part_workspaceId_manufacturerId_idx" ON "Part"("workspaceId", "manufacturerId");

ALTER TABLE "Part" ADD CONSTRAINT "Part_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationRole" ADD CONSTRAINT "OrganizationRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
