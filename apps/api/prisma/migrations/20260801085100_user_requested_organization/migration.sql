-- AlterTable
ALTER TABLE "User" ADD COLUMN "requestedOrganizationId" TEXT;

-- CreateIndex
CREATE INDEX "User_requestedOrganizationId_idx" ON "User"("requestedOrganizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_requestedOrganizationId_fkey" FOREIGN KEY ("requestedOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
