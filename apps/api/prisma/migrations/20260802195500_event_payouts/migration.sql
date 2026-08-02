-- Destructive reset required before enforcing Event.startsAt.
-- Delete dependent rows in foreign-key-safe order; no date backfill.
DELETE FROM "Ticket";
DELETE FROM "Purchase";
DELETE FROM "TicketAllocation";
DELETE FROM "Event";

ALTER TABLE "Organization"
  ADD COLUMN "stripeTransfersEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Event"
  ADD COLUMN "startsAt" TIMESTAMP(3) NOT NULL,
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "heldAt" TIMESTAMP(3),
  ADD COLUMN "heldByUserId" TEXT;

CREATE INDEX "Event_startsAt_endsAt_idx" ON "Event"("startsAt", "endsAt");
CREATE INDEX "Event_heldAt_idx" ON "Event"("heldAt");

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_heldByUserId_fkey"
  FOREIGN KEY ("heldByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "EventPayoutStatus" AS ENUM ('pending', 'released', 'failed', 'blocked');
CREATE TYPE "PayoutReleaseMode" AS ENUM ('auto', 'manual');
CREATE TYPE "PayoutExcludedReason" AS ENUM ('disputed', 'refunded', 'voided');
CREATE TYPE "PayoutAuditAction" AS ENUM ('hold', 'clear', 'release', 'retry');

ALTER TABLE "Purchase"
  ADD COLUMN "eventPayoutId" TEXT,
  ADD COLUMN "payoutExcludedReason" "PayoutExcludedReason";

CREATE INDEX "Purchase_eventPayoutId_idx" ON "Purchase"("eventPayoutId");
CREATE INDEX "Purchase_eventId_status_eventPayoutId_payoutExcludedReason_idx"
  ON "Purchase"("eventId", "status", "eventPayoutId", "payoutExcludedReason");

CREATE TABLE "EventPayout" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "batchSeq" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" "EventPayoutStatus" NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "releaseMode" "PayoutReleaseMode",
  "releasedByUserId" TEXT,
  "stripeTransferId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "postReleaseExposure" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventPayout_eventId_batchSeq_key"
  ON "EventPayout"("eventId", "batchSeq");
CREATE UNIQUE INDEX "EventPayout_stripeTransferId_key"
  ON "EventPayout"("stripeTransferId");
CREATE INDEX "EventPayout_eventId_status_idx"
  ON "EventPayout"("eventId", "status");

CREATE TABLE "EventPayoutAudit" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventPayoutId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "action" "PayoutAuditAction" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventPayoutAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventPayoutAudit_eventId_createdAt_idx"
  ON "EventPayoutAudit"("eventId", "createdAt");
CREATE INDEX "EventPayoutAudit_eventPayoutId_idx"
  ON "EventPayoutAudit"("eventPayoutId");

ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_eventPayoutId_fkey"
  FOREIGN KEY ("eventPayoutId") REFERENCES "EventPayout"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventPayout"
  ADD CONSTRAINT "EventPayout_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventPayout"
  ADD CONSTRAINT "EventPayout_releasedByUserId_fkey"
  FOREIGN KEY ("releasedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventPayoutAudit"
  ADD CONSTRAINT "EventPayoutAudit_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventPayoutAudit"
  ADD CONSTRAINT "EventPayoutAudit_eventPayoutId_fkey"
  FOREIGN KEY ("eventPayoutId") REFERENCES "EventPayout"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventPayoutAudit"
  ADD CONSTRAINT "EventPayoutAudit_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
