-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ISSUED', 'REVOKED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CREDENTIAL_REVOKED';

-- AlterTable
ALTER TABLE "Credential" ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedReason" TEXT,
ADD COLUMN     "status" "CredentialStatus" NOT NULL DEFAULT 'ISSUED';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Credential_status_idx" ON "Credential"("status");
