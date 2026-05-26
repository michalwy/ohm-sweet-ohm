CREATE TABLE "WorkspaceDigiKeyIntegration" (
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientSecret" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspaceDigiKeyIntegration_pkey" PRIMARY KEY ("workspaceId"),
  CONSTRAINT "WorkspaceDigiKeyIntegration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
