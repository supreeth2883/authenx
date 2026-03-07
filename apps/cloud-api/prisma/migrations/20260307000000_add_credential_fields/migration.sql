-- AlterTable: rename revokedReason -> revocationReason, add new fields
ALTER TABLE "Credential" RENAME COLUMN "revokedReason" TO "revocationReason";

ALTER TABLE "Credential" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "Credential" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "Credential" ADD COLUMN IF NOT EXISTS "payload" JSONB;
ALTER TABLE "Credential" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
