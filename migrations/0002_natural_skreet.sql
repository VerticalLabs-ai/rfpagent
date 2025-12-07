ALTER TABLE "rfps" ADD COLUMN "generation_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "generation_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "max_generation_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "last_generation_error" text;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "generation_timeout_minutes" integer DEFAULT 45 NOT NULL;