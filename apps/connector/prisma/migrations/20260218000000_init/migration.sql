-- CreateTable
CREATE TABLE "erp_students" (
    "id" TEXT NOT NULL,
    "issuerCode" TEXT NOT NULL DEFAULT 'CVR',
    "rollNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "degree" TEXT NOT NULL DEFAULT 'B.Tech',
    "branch" TEXT NOT NULL DEFAULT 'Computer Science',
    "graduationYear" INTEGER NOT NULL DEFAULT 2025,
    "cgpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_students_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erp_students_issuerCode_rollNumber_key" ON "erp_students"("issuerCode", "rollNumber");

-- CreateIndex
CREATE INDEX "erp_students_issuerCode_idx" ON "erp_students"("issuerCode");

-- CreateIndex
CREATE INDEX "erp_students_rollNumber_idx" ON "erp_students"("rollNumber");
