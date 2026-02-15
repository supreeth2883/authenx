-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "issuerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "cgpa" DOUBLE PRECISION NOT NULL,
    "hash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Credential_hash_key" ON "Credential"("hash");

-- CreateIndex
CREATE INDEX "Credential_issuerCode_idx" ON "Credential"("issuerCode");

-- CreateIndex
CREATE INDEX "Credential_rollNumber_idx" ON "Credential"("rollNumber");

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_issuerCode_fkey" FOREIGN KEY ("issuerCode") REFERENCES "Issuer"("issuerCode") ON DELETE RESTRICT ON UPDATE CASCADE;
