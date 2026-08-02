-- Rename enum TicketPaymentStatus → PurchaseStatus
ALTER TYPE "TicketPaymentStatus" RENAME TO "PurchaseStatus";

-- Expand TicketPayment into Purchase shape (nullable columns first for backfill)
ALTER TABLE "TicketPayment" ADD COLUMN "buyerUserId" TEXT;
ALTER TABLE "TicketPayment" ADD COLUMN "eventId" TEXT;
ALTER TABLE "TicketPayment" ADD COLUMN "allocationId" TEXT;
ALTER TABLE "TicketPayment" ADD COLUMN "quantity" INTEGER;
ALTER TABLE "TicketPayment" ADD COLUMN "subtotalCents" INTEGER;
ALTER TABLE "TicketPayment" ADD COLUMN "stripeChargeId" TEXT;

-- Backfill from linked ticket → allocation (1:1 quantity=1)
UPDATE "TicketPayment" AS tp
SET
  "buyerUserId" = COALESCE(
    t."holderUserId",
    (SELECT u.id FROM "User" u ORDER BY u."createdAt" ASC LIMIT 1)
  ),
  "eventId" = a."eventId",
  "allocationId" = t."allocationId",
  "quantity" = 1,
  "subtotalCents" = tp."netCents"
FROM "Ticket" AS t
INNER JOIN "TicketAllocation" AS a ON a.id = t."allocationId"
WHERE tp."ticketId" = t.id;

-- Fail loudly if any row could not be backfilled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "TicketPayment"
    WHERE "buyerUserId" IS NULL
       OR "eventId" IS NULL
       OR "allocationId" IS NULL
       OR "quantity" IS NULL
       OR "subtotalCents" IS NULL
  ) THEN
    RAISE EXCEPTION 'Purchase backfill incomplete: null required columns remain';
  END IF;
END $$;

ALTER TABLE "TicketPayment" ALTER COLUMN "buyerUserId" SET NOT NULL;
ALTER TABLE "TicketPayment" ALTER COLUMN "eventId" SET NOT NULL;
ALTER TABLE "TicketPayment" ALTER COLUMN "allocationId" SET NOT NULL;
ALTER TABLE "TicketPayment" ALTER COLUMN "quantity" SET NOT NULL;
ALTER TABLE "TicketPayment" ALTER COLUMN "subtotalCents" SET NOT NULL;

-- Ticket.purchaseId + backfill from old ticketId FK
ALTER TABLE "Ticket" ADD COLUMN "purchaseId" TEXT;

UPDATE "Ticket" AS t
SET "purchaseId" = tp.id
FROM "TicketPayment" AS tp
WHERE tp."ticketId" = t.id;

-- Drop old 1:1 ticket FK / unique
ALTER TABLE "TicketPayment" DROP CONSTRAINT "TicketPayment_ticketId_fkey";
DROP INDEX IF EXISTS "TicketPayment_ticketId_key";
ALTER TABLE "TicketPayment" DROP COLUMN "ticketId";

-- Rename table
ALTER TABLE "TicketPayment" RENAME TO "Purchase";
ALTER TABLE "Purchase" RENAME CONSTRAINT "TicketPayment_pkey" TO "Purchase_pkey";
ALTER INDEX "TicketPayment_stripePaymentIntentId_key" RENAME TO "Purchase_stripePaymentIntentId_key";

-- FKs and indexes
CREATE INDEX "Purchase_eventId_idx" ON "Purchase"("eventId");
CREATE INDEX "Purchase_buyerUserId_allocationId_status_idx" ON "Purchase"("buyerUserId", "allocationId", "status");
CREATE INDEX "Ticket_purchaseId_idx" ON "Ticket"("purchaseId");

ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_buyerUserId_fkey"
  FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_allocationId_fkey"
  FOREIGN KEY ("allocationId") REFERENCES "TicketAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
