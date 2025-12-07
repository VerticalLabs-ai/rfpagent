CREATE TABLE "company_agent_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_profile_id" varchar NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"custom_prompt" text,
	"priority" integer DEFAULT 5 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_company_agent" UNIQUE("company_profile_id","agent_id")
);
--> statement-breakpoint
ALTER TABLE "company_agent_settings" ADD CONSTRAINT "company_agent_settings_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_company_agent_settings_company" ON "company_agent_settings" USING btree ("company_profile_id");--> statement-breakpoint
CREATE INDEX "idx_company_agent_settings_agent" ON "company_agent_settings" USING btree ("agent_id");