CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionKey")
);

CREATE TABLE "WorkspaceMemberRole" (
    "workspaceMemberId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMemberRole_pkey" PRIMARY KEY ("workspaceMemberId","roleId")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

CREATE UNIQUE INDEX "Role_workspaceId_name_key" ON "Role"("workspaceId", "name");

CREATE INDEX "Role_workspaceId_idx" ON "Role"("workspaceId");

CREATE INDEX "RolePermission_permissionKey_idx" ON "RolePermission"("permissionKey");

CREATE INDEX "WorkspaceMemberRole_roleId_idx" ON "WorkspaceMemberRole"("roleId");

INSERT INTO "Workspace" ("id", "name", "slug", "updatedAt")
VALUES ('default-workspace', 'Default workspace', 'default', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Permission" ("key", "description")
VALUES
  ('admin', 'Administrative access to every workspace permission.'),
  ('parts:read', 'Read parts in a workspace.'),
  ('parts:write', 'Create and update parts in a workspace.'),
  ('roles:read', 'Read roles and permissions in a workspace.'),
  ('roles:write', 'Create, update, and delete roles in a workspace.'),
  ('members:read', 'Read workspace members.'),
  ('members:write', 'Manage workspace members and role assignments.'),
  ('workspace:read', 'Read workspace settings.'),
  ('workspace:write', 'Update workspace settings.')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Role" ("id", "workspaceId", "name", "isSystem", "updatedAt")
VALUES
  ('default-workspace-admin-role', 'default-workspace', 'admin', true, CURRENT_TIMESTAMP),
  ('default-workspace-reader-role', 'default-workspace', 'reader', true, CURRENT_TIMESTAMP),
  ('default-workspace-editor-role', 'default-workspace', 'editor', true, CURRENT_TIMESTAMP)
ON CONFLICT ("workspaceId", "name") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionKey")
VALUES
  ('default-workspace-admin-role', 'admin'),
  ('default-workspace-reader-role', 'parts:read'),
  ('default-workspace-reader-role', 'roles:read'),
  ('default-workspace-reader-role', 'members:read'),
  ('default-workspace-reader-role', 'workspace:read'),
  ('default-workspace-editor-role', 'parts:read'),
  ('default-workspace-editor-role', 'parts:write'),
  ('default-workspace-editor-role', 'roles:read'),
  ('default-workspace-editor-role', 'roles:write'),
  ('default-workspace-editor-role', 'members:read'),
  ('default-workspace-editor-role', 'members:write'),
  ('default-workspace-editor-role', 'workspace:read'),
  ('default-workspace-editor-role', 'workspace:write')
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

DROP INDEX "Part_catalogNumber_idx";
DROP INDEX "Part_manufacturerName_idx";

ALTER TABLE "Part" ADD COLUMN "workspaceId" TEXT;

UPDATE "Part"
SET "workspaceId" = 'default-workspace'
WHERE "workspaceId" IS NULL;

ALTER TABLE "Part" ALTER COLUMN "workspaceId" SET NOT NULL;

CREATE INDEX "Part_workspaceId_catalogNumber_idx" ON "Part"("workspaceId", "catalogNumber");

CREATE INDEX "Part_workspaceId_manufacturerName_idx" ON "Part"("workspaceId", "manufacturerName");

ALTER TABLE "Part" ADD CONSTRAINT "Part_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Role" ADD CONSTRAINT "Role_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMemberRole" ADD CONSTRAINT "WorkspaceMemberRole_workspaceMemberId_fkey" FOREIGN KEY ("workspaceMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMemberRole" ADD CONSTRAINT "WorkspaceMemberRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
