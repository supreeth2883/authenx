-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREDENTIAL_ISSUED', 'CREDENTIAL_VERIFIED');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "action" "AuditAction" NOT NULL,
    "credentialId" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "actor" TEXT,
    "result" BOOLEAN NOT NULL,
    "detail" TEXT,
    "ipAddress" TEXT,
    "previousHash" TEXT NOT NULL,
    "currentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_sequence_key" ON "AuditLog"("sequence");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_credentialId_idx" ON "AuditLog"("credentialId");

-- CreateIndex
CREATE INDEX "AuditLog_organization_idx" ON "AuditLog"("organization");

-- CreateIndex
CREATE INDEX "AuditLog_sequence_idx" ON "AuditLog"("sequence");
