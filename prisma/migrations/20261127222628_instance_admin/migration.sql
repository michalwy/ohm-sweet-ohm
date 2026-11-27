-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isInstanceAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InstanceSettings" (
    "id" TEXT NOT NULL DEFAULT 'instance',
    "registrationOpen" BOOLEAN,
    "registrationUpdatedAt" TIMESTAMP(3),
    "registrationUpdatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceSettings_pkey" PRIMARY KEY ("id")
);
