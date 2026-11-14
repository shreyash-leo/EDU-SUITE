-- Additive migration: preserve contracts, legacy allocations and all configurations.
ALTER TABLE "Subscription" ADD COLUMN "classroomLimit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "userLimit" INTEGER NOT NULL DEFAULT 1;
UPDATE "Subscription" s SET "classroomLimit" = COALESCE((
  SELECT SUM(e."classroomLimit") FROM "Entitlement" e WHERE e."subscriptionId" = s.id
), 0);
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_classroomLimit_check" CHECK ("classroomLimit" >= 0);
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userLimit_check" CHECK ("userLimit" >= 1);
CREATE INDEX "Subscription_organizationId_status_startsAt_endsAt_idx" ON "Subscription"("organizationId",status,"startsAt","endsAt");
CREATE INDEX "AcademicYear_institutionId_startsAt_idx" ON "AcademicYear"("institutionId","startsAt");
-- Existing overlapping active contracts are deliberately NOT rewritten or deleted.
-- They require Super Admin review: new writes/publications fail closed until resolved.

ALTER TABLE "Schedule" ADD COLUMN "dayType" TEXT NOT NULL DEFAULT 'full';
