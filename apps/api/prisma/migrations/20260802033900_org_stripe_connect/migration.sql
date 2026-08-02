-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeAccountUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeRequirementsDue" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeAccountId_key" ON "Organization"("stripeAccountId");
