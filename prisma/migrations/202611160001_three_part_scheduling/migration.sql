-- Existing revisions keep their original resolver. New behavior is opted into on a draft.
ALTER TABLE "Revision" ADD COLUMN "resolverVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_resolverVersion_check" CHECK ("resolverVersion" IN (1, 2));
ALTER TABLE "CalendarEvent" ADD COLUMN "scheduling" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Schedule" ADD COLUMN "templateOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Classroom" ADD COLUMN "capacity" INTEGER;
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_capacity_check" CHECK ("capacity" IS NULL OR "capacity" BETWEEN 1 AND 10000);
