CREATE INDEX "idx_portals_selectors_gin" ON "portals" USING gin ("selectors");--> statement-breakpoint
CREATE INDEX "idx_portals_filters_gin" ON "portals" USING gin ("filters");--> statement-breakpoint
CREATE INDEX "idx_proposals_proposal_data_gin" ON "proposals" USING gin ("proposal_data");--> statement-breakpoint
CREATE INDEX "idx_proposals_narratives_gin" ON "proposals" USING gin ("narratives");--> statement-breakpoint
CREATE INDEX "idx_rfps_requirements_gin" ON "rfps" USING gin ("requirements");--> statement-breakpoint
CREATE INDEX "idx_rfps_compliance_items_gin" ON "rfps" USING gin ("compliance_items");--> statement-breakpoint
CREATE INDEX "idx_rfps_risk_flags_gin" ON "rfps" USING gin ("risk_flags");--> statement-breakpoint
CREATE INDEX "idx_submission_pipelines_metadata_gin" ON "submission_pipelines" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "idx_submissions_submission_data_gin" ON "submissions" USING gin ("submission_data");--> statement-breakpoint
CREATE INDEX "idx_work_items_inputs_gin" ON "work_items" USING gin ("inputs");--> statement-breakpoint
CREATE INDEX "idx_work_items_metadata_gin" ON "work_items" USING gin ("metadata");--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "unique_rfp_id_per_proposal" UNIQUE("rfp_id");