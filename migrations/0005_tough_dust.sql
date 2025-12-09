ALTER TABLE "documents" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "source_size" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "downloaded_size" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "download_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "download_error" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "verification_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "downloaded_at" timestamp;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;