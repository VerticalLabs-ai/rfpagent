ALTER TABLE "rfps" ADD COLUMN "naics_code" varchar(6);--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "naics_description" text;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "psc_code" varchar(8);--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "psc_description" text;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "set_aside_type" text;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "place_of_performance" text;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "state" varchar(2);--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "contract_type" text;--> statement-breakpoint
ALTER TABLE "rfps" ADD COLUMN "solicitation_number" varchar(50);