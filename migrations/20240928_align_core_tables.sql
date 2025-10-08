-- Align users table with repository expectations
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activated_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean;

UPDATE "users"
SET
  email = COALESCE(email, CONCAT(username, '@example.com')),
  role = COALESCE(role, 'user'),
  is_active = COALESCE(is_active, true);

ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT IF NOT EXISTS "users_email_unique" UNIQUE ("email");
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
ALTER TABLE "users" ALTER COLUMN "is_active" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "is_active" SET DEFAULT true;

-- Align portals table with monitoring + type metadata
ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "type" text;
ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "is_active" boolean;
ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "monitoring_enabled" boolean;

UPDATE "portals"
SET
  type = COALESCE(type, 'general'),
  is_active = COALESCE(is_active, true),
  monitoring_enabled = COALESCE(monitoring_enabled, true);

ALTER TABLE "portals" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "portals" ALTER COLUMN "type" SET DEFAULT 'general';
ALTER TABLE "portals" ALTER COLUMN "is_active" SET NOT NULL;
ALTER TABLE "portals" ALTER COLUMN "is_active" SET DEFAULT true;
ALTER TABLE "portals" ALTER COLUMN "monitoring_enabled" SET NOT NULL;
ALTER TABLE "portals" ALTER COLUMN "monitoring_enabled" SET DEFAULT true;

-- Align RFP table with repository expectations
ALTER TABLE "rfps" ADD COLUMN IF NOT EXISTS "category" text;
ALTER TABLE "rfps" ADD COLUMN IF NOT EXISTS "analysis" jsonb;
ALTER TABLE "rfps" ADD COLUMN IF NOT EXISTS "created_at" timestamp;

UPDATE "rfps"
SET
  created_at = COALESCE(created_at, discovered_at);

ALTER TABLE "rfps" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "rfps" ALTER COLUMN "created_at" SET DEFAULT NOW();
