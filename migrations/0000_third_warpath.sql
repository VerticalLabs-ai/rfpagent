CREATE TABLE "agent_coordination_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"initiator_agent_id" text NOT NULL,
	"target_agent_id" text NOT NULL,
	"coordination_type" text NOT NULL,
	"context" jsonb NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "agent_knowledge_base" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"knowledge_type" text NOT NULL,
	"domain" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" jsonb NOT NULL,
	"confidence_score" numeric(3, 2) DEFAULT '0.50',
	"validation_status" text DEFAULT 'pending' NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"success_rate" numeric(3, 2),
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"memory_type" text NOT NULL,
	"context_key" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"importance" integer DEFAULT 1 NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed" timestamp,
	"expires_at" timestamp,
	"tags" text[],
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_performance_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"metric_type" text NOT NULL,
	"metric_value" numeric(10, 4) NOT NULL,
	"context" jsonb,
	"reference_entity_type" text,
	"reference_entity_id" varchar,
	"aggregation_period" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_registry" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"tier" text NOT NULL,
	"role" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"capabilities" text[] NOT NULL,
	"tools" text[],
	"max_concurrency" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_heartbeat" timestamp,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"configuration" jsonb,
	"parent_agent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_registry_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar,
	"conversation_id" varchar,
	"orchestrator_agent_id" text NOT NULL,
	"session_type" text NOT NULL,
	"intent" text NOT NULL,
	"context" jsonb NOT NULL,
	"current_phase" text,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"work_item_count" integer DEFAULT 0 NOT NULL,
	"completed_work_items" integer DEFAULT 0 NOT NULL,
	"estimated_completion" timestamp,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "agent_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"user_id" varchar,
	"status" text DEFAULT 'active' NOT NULL,
	"context" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"action" text NOT NULL,
	"details" jsonb,
	"user_id" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_addresses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_profile_id" varchar NOT NULL,
	"address_type" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip_code" text NOT NULL,
	"country" text DEFAULT 'US' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_certifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_profile_id" varchar NOT NULL,
	"certification_type" text NOT NULL,
	"certification_number" text,
	"certification_date" timestamp,
	"expiration_date" timestamp,
	"recertification_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"application_number" text,
	"application_started" timestamp,
	"submitted_date" timestamp,
	"issuing_entity" text,
	"notes" text,
	"auto_renewal" boolean DEFAULT false,
	"alert_days_before" integer DEFAULT 30,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_profile_id" varchar NOT NULL,
	"contact_type" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"email" text,
	"office_phone" text,
	"mobile_phone" text,
	"fax" text,
	"decision_areas" jsonb,
	"ownership_percent" text,
	"gender" text,
	"ethnicity" text,
	"citizenship" text,
	"hours_per_week" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_identifiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_profile_id" varchar NOT NULL,
	"identifier_type" text NOT NULL,
	"identifier_value" text NOT NULL,
	"issuing_entity" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_insurance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_profile_id" varchar NOT NULL,
	"insurance_type" text NOT NULL,
	"policy_number" text,
	"carrier" text,
	"agency_name" text,
	"agent_name" text,
	"agent_contact" text,
	"coverage_amount" numeric(12, 2),
	"deductible" numeric(12, 2),
	"effective_date" timestamp,
	"expiration_date" timestamp,
	"policy_details" jsonb,
	"auto_renewal" boolean DEFAULT false,
	"alert_days_before" integer DEFAULT 30,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"dba" text,
	"website" text,
	"primary_business_category" text,
	"naics_primary" text,
	"nigp_codes" text,
	"employees_count" text,
	"registration_state" text,
	"county" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"metadata" jsonb,
	"related_entity_type" text,
	"related_entity_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dead_letter_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_work_item_id" varchar NOT NULL,
	"work_item_data" jsonb NOT NULL,
	"failure_reason" text NOT NULL,
	"failure_count" integer DEFAULT 1 NOT NULL,
	"last_failure_at" timestamp DEFAULT now() NOT NULL,
	"can_be_reprocessed" boolean DEFAULT true NOT NULL,
	"reprocess_attempts" integer DEFAULT 0 NOT NULL,
	"max_reprocess_attempts" integer DEFAULT 5 NOT NULL,
	"escalated_at" timestamp,
	"resolved_at" timestamp,
	"resolution" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"file_type" text NOT NULL,
	"object_path" text NOT NULL,
	"extracted_text" text,
	"parsed_data" jsonb,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_bids" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_title" text NOT NULL,
	"agency" text NOT NULL,
	"category" text,
	"bid_amount" numeric(12, 2),
	"winning_bid" numeric(12, 2),
	"is_winner" boolean NOT NULL,
	"bidder" text,
	"source_portal" text,
	"source_url" text,
	"rfp_value" numeric(12, 2),
	"bid_date" timestamp,
	"award_date" timestamp,
	"location" text,
	"description" text,
	"metadata" jsonb,
	"research_finding_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"related_entity_type" text,
	"related_entity_id" varchar,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase_state_transitions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"work_item_id" varchar,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"from_phase" text,
	"to_phase" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"transition_type" text NOT NULL,
	"triggered_by" text NOT NULL,
	"reason" text,
	"duration" integer,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar,
	"timeframe" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"unit" text,
	"breakdown" jsonb,
	"comparison_period" jsonb,
	"trends" jsonb,
	"metadata" jsonb,
	"calculated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_orchestration" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orchestration_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"pipeline_ids" text[] NOT NULL,
	"coordination_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_stage" integer DEFAULT 0 NOT NULL,
	"total_stages" integer NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"resource_constraints" jsonb,
	"allocated_resources" jsonb,
	"dependencies" text[],
	"completion_criteria" jsonb,
	"failure_handling" jsonb,
	"estimated_duration" integer,
	"actual_duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"suspended_at" timestamp,
	"failed_at" timestamp,
	CONSTRAINT "pipeline_orchestration_orchestration_id_unique" UNIQUE("orchestration_id")
);
--> statement-breakpoint
CREATE TABLE "portals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"monitoring_enabled" boolean DEFAULT true NOT NULL,
	"login_required" boolean DEFAULT false NOT NULL,
	"username" text,
	"password" text,
	"last_scanned" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"scan_frequency" integer DEFAULT 24 NOT NULL,
	"max_rfps_per_scan" integer DEFAULT 50 NOT NULL,
	"selectors" jsonb,
	"filters" jsonb,
	"last_error" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_id" varchar NOT NULL,
	"content" jsonb,
	"narratives" jsonb,
	"pricing_tables" jsonb,
	"forms" jsonb,
	"attachments" jsonb,
	"proposal_data" jsonb,
	"estimated_cost" numeric(12, 2),
	"estimated_margin" numeric(5, 2),
	"receipt_data" jsonb,
	"submitted_at" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_findings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"content" jsonb NOT NULL,
	"related_rfp_id" varchar,
	"related_proposal_id" varchar,
	"conversation_id" varchar,
	"confidence_score" numeric(3, 2),
	"is_verified" boolean DEFAULT false NOT NULL,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"agency" text NOT NULL,
	"category" text,
	"portal_id" varchar,
	"source_url" text NOT NULL,
	"deadline" timestamp,
	"estimated_value" numeric(12, 2),
	"status" text DEFAULT 'discovered' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"requirements" jsonb,
	"compliance_items" jsonb,
	"risk_flags" jsonb,
	"analysis" jsonb,
	"added_by" text DEFAULT 'automatic' NOT NULL,
	"manually_added_at" timestamp,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" varchar NOT NULL,
	"type" text NOT NULL,
	"level" text,
	"message" text,
	"data" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_id" varchar NOT NULL,
	"portal_name" text NOT NULL,
	"scan_type" text DEFAULT 'Automated' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"current_step" text DEFAULT 'initializing' NOT NULL,
	"current_progress" integer DEFAULT 0 NOT NULL,
	"current_message" text,
	"discovered_rfps_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"errors" jsonb,
	"discovered_rfps" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" varchar NOT NULL,
	"submission_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"phase" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"agent_id" text,
	"browser_session_id" text,
	"portal_response" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_pipelines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"workflow_id" varchar,
	"current_phase" text DEFAULT 'queued' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"preflight_checks" jsonb,
	"authentication_data" jsonb,
	"form_data" jsonb,
	"uploaded_documents" jsonb,
	"submission_receipt" jsonb,
	"error_data" jsonb,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"estimated_completion" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "submission_status_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"pipeline_id" varchar,
	"from_status" text,
	"to_status" text NOT NULL,
	"from_phase" text,
	"to_phase" text,
	"reason" text,
	"triggered_by" text,
	"additional_data" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfp_id" varchar NOT NULL,
	"proposal_id" varchar NOT NULL,
	"portal_id" varchar NOT NULL,
	"submission_data" jsonb,
	"receipt_data" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_health" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component" text NOT NULL,
	"health_status" text NOT NULL,
	"last_check_at" timestamp DEFAULT now() NOT NULL,
	"response_time" integer,
	"error_rate" numeric(5, 4) DEFAULT '0.0000',
	"throughput" numeric(10, 2),
	"resource_utilization" jsonb,
	"active_connections" integer,
	"queue_size" integer,
	"alert_thresholds" jsonb,
	"last_alert" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" text DEFAULT 'user' NOT NULL,
	"last_login_at" timestamp,
	"activated_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"workflow_id" varchar,
	"context_ref" varchar,
	"task_type" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"expected_outputs" text[],
	"priority" integer DEFAULT 5 NOT NULL,
	"deadline" timestamp,
	"retries" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"assigned_agent_id" text,
	"created_by_agent_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"metadata" jsonb,
	"retry_policy" jsonb DEFAULT '{}' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"last_error" text,
	"dlq" boolean DEFAULT false NOT NULL,
	"backoff_multiplier" numeric(3, 2) DEFAULT '2.0',
	"last_retry_at" timestamp,
	"dlq_reason" text,
	"dlq_timestamp" timestamp,
	"can_retry" boolean DEFAULT true NOT NULL,
	"is_blocking" boolean DEFAULT false NOT NULL,
	"dependencies" text[],
	"dependents" text[],
	"estimated_duration" integer,
	"actual_duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"assigned_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workflow_dependencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" varchar NOT NULL,
	"depends_on_workflow_id" varchar NOT NULL,
	"dependency_type" text NOT NULL,
	"condition" jsonb,
	"is_blocking" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"satisfied_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" text NOT NULL,
	"conversation_id" varchar,
	"current_phase" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"previous_status" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"context" jsonb NOT NULL,
	"agent_assignments" jsonb,
	"suspension_reason" text,
	"suspension_data" jsonb,
	"resume_instructions" text,
	"estimated_completion" timestamp,
	"phase_transitions" jsonb,
	"phase_start_times" jsonb,
	"phase_completion_times" jsonb,
	"phase_dependencies" jsonb,
	"can_be_paused" boolean DEFAULT true NOT NULL,
	"can_be_cancelled" boolean DEFAULT true NOT NULL,
	"parent_workflow_id" varchar,
	"child_workflow_ids" text[],
	"priority" integer DEFAULT 5 NOT NULL,
	"resource_allocation" jsonb,
	"retry_policy" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"paused_at" timestamp,
	"resumed_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_orchestrator_agent_id_agent_registry_agent_id_fk" FOREIGN KEY ("orchestrator_agent_id") REFERENCES "public"."agent_registry"("agent_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_addresses" ADD CONSTRAINT "company_addresses_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_certifications" ADD CONSTRAINT "company_certifications_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_identifiers" ADD CONSTRAINT "company_identifiers_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_insurance" ADD CONSTRAINT "company_insurance_company_profile_id_company_profiles_id_fk" FOREIGN KEY ("company_profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_rfp_id_rfps_id_fk" FOREIGN KEY ("rfp_id") REFERENCES "public"."rfps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_bids" ADD CONSTRAINT "historical_bids_research_finding_id_research_findings_id_fk" FOREIGN KEY ("research_finding_id") REFERENCES "public"."research_findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_state_transitions" ADD CONSTRAINT "phase_state_transitions_workflow_id_workflow_state_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow_state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_state_transitions" ADD CONSTRAINT "phase_state_transitions_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_rfp_id_rfps_id_fk" FOREIGN KEY ("rfp_id") REFERENCES "public"."rfps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_findings" ADD CONSTRAINT "research_findings_related_rfp_id_rfps_id_fk" FOREIGN KEY ("related_rfp_id") REFERENCES "public"."rfps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_findings" ADD CONSTRAINT "research_findings_related_proposal_id_proposals_id_fk" FOREIGN KEY ("related_proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_findings" ADD CONSTRAINT "research_findings_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfps" ADD CONSTRAINT "rfps_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_pipeline_id_submission_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."submission_pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_pipelines" ADD CONSTRAINT "submission_pipelines_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_status_history" ADD CONSTRAINT "submission_status_history_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_status_history" ADD CONSTRAINT "submission_status_history_pipeline_id_submission_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."submission_pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_rfp_id_rfps_id_fk" FOREIGN KEY ("rfp_id") REFERENCES "public"."rfps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_session_id_agent_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_workflow_id_workflow_state_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow_state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assigned_agent_id_agent_registry_agent_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."agent_registry"("agent_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_created_by_agent_id_agent_registry_agent_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agent_registry"("agent_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_dependencies" ADD CONSTRAINT "workflow_dependencies_workflow_id_workflow_state_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow_state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_dependencies" ADD CONSTRAINT "workflow_dependencies_depends_on_workflow_id_workflow_state_id_fk" FOREIGN KEY ("depends_on_workflow_id") REFERENCES "public"."workflow_state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_state" ADD CONSTRAINT "workflow_state_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_performance_metrics_agent_idx" ON "agent_performance_metrics" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_performance_metrics_metric_type_idx" ON "agent_performance_metrics" USING btree ("metric_type");--> statement-breakpoint
CREATE INDEX "agent_performance_metrics_recorded_at_idx" ON "agent_performance_metrics" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "agent_registry_tier_idx" ON "agent_registry" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "agent_registry_status_idx" ON "agent_registry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_registry_parent_agent_idx" ON "agent_registry" USING btree ("parent_agent_id");--> statement-breakpoint
CREATE INDEX "agent_registry_parent_status_idx" ON "agent_registry" USING btree ("parent_agent_id","status");--> statement-breakpoint
CREATE INDEX "agent_sessions_status_idx" ON "agent_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_sessions_orchestrator_idx" ON "agent_sessions" USING btree ("orchestrator_agent_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_user_idx" ON "agent_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_last_activity_idx" ON "agent_sessions" USING btree ("last_activity");--> statement-breakpoint
CREATE INDEX "agent_sessions_status_activity_idx" ON "agent_sessions" USING btree ("status","last_activity");--> statement-breakpoint
CREATE INDEX "dlq_failure_reason_idx" ON "dead_letter_queue" USING btree ("failure_reason");--> statement-breakpoint
CREATE INDEX "dlq_can_be_reprocessed_idx" ON "dead_letter_queue" USING btree ("can_be_reprocessed");--> statement-breakpoint
CREATE INDEX "dlq_escalated_at_idx" ON "dead_letter_queue" USING btree ("escalated_at");--> statement-breakpoint
CREATE INDEX "phase_transitions_workflow_idx" ON "phase_state_transitions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "phase_transitions_entity_idx" ON "phase_state_transitions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "phase_transitions_timestamp_idx" ON "phase_state_transitions" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "phase_transitions_type_idx" ON "phase_state_transitions" USING btree ("transition_type");--> statement-breakpoint
CREATE INDEX "pipeline_metrics_metric_type_idx" ON "pipeline_metrics" USING btree ("metric_type");--> statement-breakpoint
CREATE INDEX "pipeline_metrics_entity_idx" ON "pipeline_metrics" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "pipeline_metrics_timeframe_idx" ON "pipeline_metrics" USING btree ("timeframe");--> statement-breakpoint
CREATE INDEX "pipeline_metrics_start_time_idx" ON "pipeline_metrics" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "pipeline_orchestration_status_idx" ON "pipeline_orchestration" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pipeline_orchestration_priority_idx" ON "pipeline_orchestration" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "pipeline_orchestration_coordination_type_idx" ON "pipeline_orchestration" USING btree ("coordination_type");--> statement-breakpoint
CREATE INDEX "submission_events_pipeline_idx" ON "submission_events" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "submission_events_type_idx" ON "submission_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "submission_events_phase_idx" ON "submission_events" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "submission_events_timestamp_idx" ON "submission_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "submission_events_agent_idx" ON "submission_events" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "submission_pipelines_session_idx" ON "submission_pipelines" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "submission_pipelines_status_idx" ON "submission_pipelines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submission_pipelines_phase_idx" ON "submission_pipelines" USING btree ("current_phase");--> statement-breakpoint
CREATE INDEX "submission_pipelines_completion_idx" ON "submission_pipelines" USING btree ("estimated_completion");--> statement-breakpoint
CREATE INDEX "submission_status_history_submission_idx" ON "submission_status_history" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_status_history_status_idx" ON "submission_status_history" USING btree ("to_status");--> statement-breakpoint
CREATE INDEX "submission_status_history_timestamp_idx" ON "submission_status_history" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "system_health_component_idx" ON "system_health" USING btree ("component");--> statement-breakpoint
CREATE INDEX "system_health_status_idx" ON "system_health" USING btree ("health_status");--> statement-breakpoint
CREATE INDEX "system_health_last_check_idx" ON "system_health" USING btree ("last_check_at");--> statement-breakpoint
CREATE INDEX "work_items_status_idx" ON "work_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "work_items_priority_idx" ON "work_items" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "work_items_deadline_idx" ON "work_items" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "work_items_assigned_agent_idx" ON "work_items" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "work_items_session_idx" ON "work_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "work_items_created_by_agent_idx" ON "work_items" USING btree ("created_by_agent_id");--> statement-breakpoint
CREATE INDEX "work_items_agent_scheduling_idx" ON "work_items" USING btree ("status","assigned_agent_id","priority","deadline");--> statement-breakpoint
CREATE INDEX "work_items_global_queue_idx" ON "work_items" USING btree ("status","task_type","priority","deadline");--> statement-breakpoint
CREATE INDEX "workflow_dependencies_workflow_idx" ON "workflow_dependencies" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_dependencies_dependency_idx" ON "workflow_dependencies" USING btree ("depends_on_workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_dependencies_status_idx" ON "workflow_dependencies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_state_status_idx" ON "workflow_state" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_state_phase_idx" ON "workflow_state" USING btree ("current_phase");--> statement-breakpoint
CREATE INDEX "workflow_state_priority_idx" ON "workflow_state" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "workflow_state_parent_idx" ON "workflow_state" USING btree ("parent_workflow_id");