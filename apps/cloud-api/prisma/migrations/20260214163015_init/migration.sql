-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('ISSUER', 'EMPLOYER');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "VerifyOutcome" AS ENUM ('ISSUANCE_VERIFIED', 'LIVE_VERIFIED', 'NOT_FOUND', 'OFFLINE', 'MISMATCH', 'ERROR');

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "orgType" "OrgType" NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issuer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "issuerCode" TEXT NOT NULL,
    "publicKeyEd25519" TEXT NOT NULL,
    "connectorBaseUrl" TEXT NOT NULL,
    "connectorApiKeyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "issuerCode" TEXT NOT NULL,
    "credentialType" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "issuerSignature" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "issuerCode" TEXT NOT NULL,
    "employerOrgId" TEXT NOT NULL,
    "credentialType" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "outcome" "VerifyOutcome" NOT NULL,
    "reasonCode" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Issuer_orgId_key" ON "Issuer"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Issuer_issuerCode_key" ON "Issuer"("issuerCode");

-- CreateIndex
CREATE INDEX "Token_issuerCode_cid_idx" ON "Token"("issuerCode", "cid");

-- CreateIndex
CREATE UNIQUE INDEX "Token_issuerCode_credentialType_cid_key" ON "Token"("issuerCode", "credentialType", "cid");

-- AddForeignKey
ALTER TABLE "Issuer" ADD CONSTRAINT "Issuer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_issuerCode_fkey" FOREIGN KEY ("issuerCode") REFERENCES "Issuer"("issuerCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_employerOrgId_fkey" FOREIGN KEY ("employerOrgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
