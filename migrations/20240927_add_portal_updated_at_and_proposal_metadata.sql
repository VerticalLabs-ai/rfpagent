-- Add updated_at column to portals
ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;
UPDATE "portals" SET "updated_at" = COALESCE("updated_at", NOW());
ALTER TABLE "portals" ALTER COLUMN "updated_at" SET DEFAULT NOW();
ALTER TABLE "portals" ALTER COLUMN "updated_at" SET NOT NULL;

-- Add proposal_data and estimated_cost columns to proposals
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "proposal_data" jsonb;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "estimated_cost" numeric(12, 2);
