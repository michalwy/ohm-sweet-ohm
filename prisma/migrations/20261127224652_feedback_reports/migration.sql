-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('problem', 'idea', 'question');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'triaged');

-- CreateTable
CREATE TABLE "FeedbackReport" (
    "id" TEXT NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
    "issueUrl" TEXT,
    "userId" TEXT,
    "workspaceId" TEXT,
    "path" TEXT,
    "appVersion" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackReport_status_createdAt_idx" ON "FeedbackReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReport_userId_idx" ON "FeedbackReport"("userId");

-- CreateIndex
CREATE INDEX "FeedbackReport_workspaceId_idx" ON "FeedbackReport"("workspaceId");

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
