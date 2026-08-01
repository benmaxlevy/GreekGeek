-- CreateEnum
CREATE TYPE "TicketSaleStatus" AS ENUM ('draft', 'on_sale', 'closed');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('unpaid', 'paid', 'void');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "ticketingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ticketCapacity" INTEGER,
ADD COLUMN     "ticketSaleStatus" "TicketSaleStatus",
ADD COLUMN     "ticketSalesOpenAt" TIMESTAMP(3),
ADD COLUMN     "ticketSalesCloseAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TicketAllocation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "organizationId" TEXT,
    "quantity" INTEGER NOT NULL,
    "priceCents" INTEGER,
    "status" "AllocationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'unpaid',
    "credentialToken" TEXT NOT NULL,
    "holderUserId" TEXT,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketAllocation_eventId_idx" ON "TicketAllocation"("eventId");

-- CreateIndex
CREATE INDEX "TicketAllocation_organizationId_idx" ON "TicketAllocation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketAllocation_eventId_organizationId_key" ON "TicketAllocation"("eventId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketAllocation_eventId_public_key" ON "TicketAllocation"("eventId") WHERE "organizationId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_credentialToken_key" ON "Ticket"("credentialToken");

-- CreateIndex
CREATE INDEX "Ticket_allocationId_idx" ON "Ticket"("allocationId");

-- CreateIndex
CREATE INDEX "Ticket_holderUserId_idx" ON "Ticket"("holderUserId");

-- AddForeignKey
ALTER TABLE "TicketAllocation" ADD CONSTRAINT "TicketAllocation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAllocation" ADD CONSTRAINT "TicketAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "TicketAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
