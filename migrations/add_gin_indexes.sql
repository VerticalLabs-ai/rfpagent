-- Add GIN indexes on JSONB columns for improved query performance
-- This addresses the audit finding for optimizing JSONB queries

-- Index on rfps.requirements for requirement searches
CREATE INDEX IF NOT EXISTS idx_rfps_requirements_gin ON rfps USING GIN (requirements);

-- Index on rfps.compliance_items for compliance filtering
CREATE INDEX IF NOT EXISTS idx_rfps_compliance_items_gin ON rfps USING GIN (compliance_items);

-- Index on rfps.risk_flags for risk analysis queries
CREATE INDEX IF NOT EXISTS idx_rfps_risk_flags_gin ON rfps USING GIN (risk_flags);

-- Index on proposals.proposal_data for proposal content searches
CREATE INDEX IF NOT EXISTS idx_proposals_proposal_data_gin ON proposals USING GIN (proposal_data);

-- Index on proposals.narratives for narrative searches
CREATE INDEX IF NOT EXISTS idx_proposals_narratives_gin ON proposals USING GIN (narratives);

-- Index on portals.selectors for portal configuration queries
CREATE INDEX IF NOT EXISTS idx_portals_selectors_gin ON portals USING GIN (selectors);

-- Index on portals.filters for portal filter queries
CREATE INDEX IF NOT EXISTS idx_portals_filters_gin ON portals USING GIN (filters);

-- Index on submissions.submission_data for submission tracking
CREATE INDEX IF NOT EXISTS idx_submissions_submission_data_gin ON submissions USING GIN (submission_data);

-- Index on submission_pipelines.metadata for pipeline queries
CREATE INDEX IF NOT EXISTS idx_submission_pipelines_metadata_gin ON submission_pipelines USING GIN (metadata);

-- Index on work_items.inputs and metadata for work item queries
CREATE INDEX IF NOT EXISTS idx_work_items_inputs_gin ON work_items USING GIN (inputs);
CREATE INDEX IF NOT EXISTS idx_work_items_metadata_gin ON work_items USING GIN (metadata);

-- Add comment explaining the indexes
COMMENT ON INDEX idx_rfps_requirements_gin IS 'GIN index for fast JSONB queries on RFP requirements';
COMMENT ON INDEX idx_proposals_proposal_data_gin IS 'GIN index for fast JSONB queries on proposal data';
COMMENT ON INDEX idx_portals_selectors_gin IS 'GIN index for fast JSONB queries on portal selectors';
