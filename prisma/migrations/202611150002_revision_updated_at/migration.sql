-- Add a save timestamp for accurate client directories; preserve every snapshot.
ALTER TABLE "Revision" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Revision" SET "updatedAt" = COALESCE("publishedAt", "createdAt");
