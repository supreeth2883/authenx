-- AlterTable
ALTER TABLE "Credential" ADD COLUMN     "keyVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "IssuerKey" (
    "id" TEXT NOT NULL,
    "issuerCode" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "IssuerKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssuerKey_issuerCode_active_idx" ON "IssuerKey"("issuerCode", "active");

-- CreateIndex
CREATE UNIQUE INDEX "IssuerKey_issuerCode_keyVersion_key" ON "IssuerKey"("issuerCode", "keyVersion");

-- CreateIndex
CREATE INDEX "Credential_issuerCode_keyVersion_idx" ON "Credential"("issuerCode", "keyVersion");

-- AddForeignKey
ALTER TABLE "IssuerKey" ADD CONSTRAINT "IssuerKey_issuerCode_fkey" FOREIGN KEY ("issuerCode") REFERENCES "Issuer"("issuerCode") ON DELETE RESTRICT ON UPDATE CASCADE;
