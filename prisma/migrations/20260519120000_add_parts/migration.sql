CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "catalogNumber" TEXT NOT NULL,
    "manufacturerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Part_catalogNumber_idx" ON "Part"("catalogNumber");

CREATE INDEX "Part_manufacturerName_idx" ON "Part"("manufacturerName");
