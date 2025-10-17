import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const users = pgTable('users', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  role: text('role').notNull().default('user'),
  lastLoginAt: timestamp('last_login_at'),
  activatedAt: timestamp('activated_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const portals = pgTable('portals', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  url: text('url').notNull(),
  type: text('type').notNull().default('general'),
  isActive: boolean('is_active').default(true).notNull(),
  monitoringEnabled: boolean('monitoring_enabled').default(true).notNull(),
  loginRequired: boolean('login_required').default(false).notNull(),
  username: text('username'),
  password: text('password'),
  lastScanned: timestamp('last_scanned'),
  status: text('status').notNull().default('active'), // active, maintenance, error
  scanFrequency: integer('scan_frequency').default(24).notNull(), // hours between scans
  maxRfpsPerScan: integer('max_rfps_per_scan').default(50).notNull(),
  selectors: jsonb('selectors'), // CSS selectors and scraping config
  filters: jsonb('filters'), // business type, value filters, etc.
  lastError: text('last_error'),
  errorCount: integer('error_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const rfps = pgTable('rfps', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description'),
  agency: text('agency').notNull(),
  category: text('category'),
  portalId: varchar('portal_id').references(() => portals.id),
  sourceUrl: text('source_url').notNull(),
  deadline: timestamp('deadline'),
  estimatedValue: decimal('estimated_value', { precision: 12, scale: 2 }),
  status: text('status').notNull().default('discovered'), // discovered, parsing, drafting, review, approved, submitted, closed
  progress: integer('progress').default(0).notNull(),
  requirements: jsonb('requirements'), // parsed requirements object
  complianceItems: jsonb('compliance_items'), // compliance checklist
  riskFlags: jsonb('risk_flags'), // high-risk items
  analysis: jsonb('analysis'),
  addedBy: text('added_by').notNull().default('automatic'), // "manual" or "automatic"
  manuallyAddedAt: timestamp('manually_added_at'), // Only set if manually added
  discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const proposals = pgTable('proposals', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rfpId: varchar('rfp_id')
    .references(() => rfps.id)
    .notNull(),
  content: jsonb('content'), // generated proposal content
  narratives: jsonb('narratives'), // AI-generated narratives
  pricingTables: jsonb('pricing_tables'), // pricing breakdown
  forms: jsonb('forms'), // filled forms
  attachments: jsonb('attachments'), // file references
  proposalData: jsonb('proposal_data'), // structured proposal metadata
  estimatedCost: decimal('estimated_cost', { precision: 12, scale: 2 }),
  estimatedMargin: decimal('estimated_margin', { precision: 5, scale: 2 }),
  receiptData: jsonb('receipt_data'), // submission confirmation details
  submittedAt: timestamp('submitted_at'),
  status: text('status').notNull().default('draft'), // draft, review, approved, submitted
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rfpId: varchar('rfp_id')
    .references(() => rfps.id)
    .notNull(),
  filename: text('filename').notNull(),
  fileType: text('file_type').notNull(),
  objectPath: text('object_path').notNull(),
  extractedText: text('extracted_text'),
  parsedData: jsonb('parsed_data'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

export const submissions = pgTable('submissions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rfpId: varchar('rfp_id')
    .references(() => rfps.id)
    .notNull(),
  proposalId: varchar('proposal_id')
    .references(() => proposals.id)
    .notNull(),
  portalId: varchar('portal_id')
    .references(() => portals.id)
    .notNull(),
  submissionData: jsonb('submission_data'), // portal-specific submission data
  receiptData: jsonb('receipt_data'), // submission confirmation
  status: text('status').notNull().default('pending'), // pending, submitted, failed, confirmed
  submittedAt: timestamp('submitted_at'),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const submissionStatusValues = [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
  'submitted',
  'confirmed',
] as const;

export const submissionStatusSchema = z.enum(submissionStatusValues);

const jsonDateTimeSchema = z.union([z.date(), z.string()]);
const jsonDateTimeNullish = jsonDateTimeSchema.nullish();

export const submissionLifecycleDataSchema = z
  .object({
    sessionId: z.string().optional(),
    pipelineId: z.string().optional(),
    portalName: z.string().optional(),
    automatedSubmission: z.boolean().optional(),
    autoGenerated: z.boolean().optional(),
    triggeredBy: z.string().optional(),
    companyProfileId: z.string().optional(),
    deadline: jsonDateTimeNullish,
    initiatedAt: jsonDateTimeNullish,
    retryInitiatedAt: jsonDateTimeNullish,
    failedAt: jsonDateTimeNullish,
    cancelledAt: jsonDateTimeNullish,
    completedAt: jsonDateTimeNullish,
    pipelineCancelled: z.boolean().optional(),
    referenceNumber: z.string().optional(),
    previousStatus: submissionStatusSchema.optional(),
    error: z.string().optional(),
    lastError: z.string().optional(),
    lastErrorAt: jsonDateTimeNullish,
    retryCount: z.number().int().nonnegative().optional(),
    nextSteps: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const submissionReceiptDataSchema = z
  .object({
    confirmationNumber: z.string().optional(),
    referenceNumber: z.string().optional(),
    submittedAt: jsonDateTimeSchema.optional(),
    portalReceiptUrl: z.string().optional(),
    attachments: z
      .array(
        z
          .object({
            name: z.string(),
            url: z.string().optional(),
            type: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();

export type SubmissionStatusValue = z.infer<typeof submissionStatusSchema>;
export type SubmissionLifecycleData = z.infer<
  typeof submissionLifecycleDataSchema
>;
export type SubmissionReceiptData = z.infer<typeof submissionReceiptDataSchema>;

export const submissionPipelinePhaseValues = [
  'queued',
  'preflight',
  'authenticating',
  'filling',
  'uploading',
  'submitting',
  'verifying',
  'completed',
  'failed',
] as const;

export type SubmissionPipelinePhase =
  (typeof submissionPipelinePhaseValues)[number];

export const submissionPhaseOrder = [
  'preflight',
  'authenticating',
  'filling',
  'uploading',
  'submitting',
  'verifying',
] as const;

export type SubmissionPhase = (typeof submissionPhaseOrder)[number];

export const submissionPipelineStatusValues = [
  'pending',
  'in_progress',
  'suspended',
  'completed',
  'failed',
] as const;

export type SubmissionPipelineStatus =
  (typeof submissionPipelineStatusValues)[number];

export const submissionPipelineResultKeys = [
  'preflight',
  'authentication',
  'formFilling',
  'documentUploads',
  'submission',
  'verification',
  'completed',
  'failed',
] as const;

export type SubmissionPipelineResultKey =
  (typeof submissionPipelineResultKeys)[number];

export type SubmissionPipelineJson = Record<string, unknown>;

export interface SubmissionPipelineMetadata extends SubmissionPipelineJson {
  portalName: string;
  rfpTitle: string;
  proposalType: string | null;
  priority: number;
  deadline?: Date | string | null;
  browserOptions: {
    headless?: boolean;
    timeout?: number;
  };
}

export interface SubmissionPhaseResult extends SubmissionPipelineJson {
  startedAt?: Date | string;
  completedAt?: Date | string;
  success?: boolean;
  summary?: string;
  errors?: string[];
  nextSteps?: string[];
}

export interface SubmissionVerificationResult extends SubmissionPhaseResult {
  reference_number?: string | null;
  receipt_data?: SubmissionReceiptData | null;
}

export interface SubmissionPipelineErrorData extends SubmissionPipelineJson {
  error: string;
  retryCount?: number;
  failedWorkItems?: SubmissionPipelineJson[];
}

export type SubmissionPipelineResults = Partial<
  Record<SubmissionPipelineResultKey, SubmissionPhaseResult>
> & {
  verification?: SubmissionVerificationResult;
};

// Submission Pipeline Tables
export const submissionPipelines = pgTable(
  'submission_pipelines',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    submissionId: varchar('submission_id')
      .references(() => submissions.id)
      .notNull(),
    sessionId: varchar('session_id').notNull(), // agent session reference
    workflowId: varchar('workflow_id'), // optional workflow reference
    currentPhase: text('current_phase').notNull().default('queued'), // queued, preflight, authenticating, filling, uploading, submitting, verifying, completed, failed
    status: text('status').notNull().default('pending'), // pending, in_progress, suspended, completed, failed
    progress: integer('progress').default(0).notNull(), // 0-100 percentage
    preflightChecks: jsonb('preflight_checks'), // results of preflight validation
    authenticationData: jsonb('authentication_data'), // portal login session data
    formData: jsonb('form_data'), // structured form data for submission
    uploadedDocuments: jsonb('uploaded_documents'), // list of uploaded documents with URLs
    submissionReceipt: jsonb('submission_receipt'), // final submission confirmation data
    errorData: jsonb('error_data'), // detailed error information if failed
    retryCount: integer('retry_count').default(0).notNull(),
    maxRetries: integer('max_retries').default(3).notNull(),
    estimatedCompletion: timestamp('estimated_completion'),
    metadata: jsonb('metadata'), // additional pipeline metadata
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  table => ({
    sessionIdx: index('submission_pipelines_session_idx').on(table.sessionId),
    statusIdx: index('submission_pipelines_status_idx').on(table.status),
    phaseIdx: index('submission_pipelines_phase_idx').on(table.currentPhase),
    completionIdx: index('submission_pipelines_completion_idx').on(
      table.estimatedCompletion
    ),
  })
);

export const submissionEvents = pgTable(
  'submission_events',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    pipelineId: varchar('pipeline_id')
      .references(() => submissionPipelines.id)
      .notNull(),
    submissionId: varchar('submission_id')
      .references(() => submissions.id)
      .notNull(),
    eventType: text('event_type').notNull(), // phase_started, phase_completed, error, retry, status_change, authentication_success, form_filled, document_uploaded, submission_executed
    phase: text('phase').notNull(), // current phase when event occurred
    level: text('level').notNull().default('info'), // info, warn, error, debug
    message: text('message').notNull(),
    details: jsonb('details'), // detailed event data
    agentId: text('agent_id'), // which agent triggered this event
    browserSessionId: text('browser_session_id'), // Stagehand session reference
    portalResponse: jsonb('portal_response'), // portal response data if applicable
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    pipelineIdx: index('submission_events_pipeline_idx').on(table.pipelineId),
    typeIdx: index('submission_events_type_idx').on(table.eventType),
    phaseIdx: index('submission_events_phase_idx').on(table.phase),
    timestampIdx: index('submission_events_timestamp_idx').on(table.timestamp),
    agentIdx: index('submission_events_agent_idx').on(table.agentId),
  })
);

export const submissionStatusHistory = pgTable(
  'submission_status_history',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    submissionId: varchar('submission_id')
      .references(() => submissions.id)
      .notNull(),
    pipelineId: varchar('pipeline_id').references(() => submissionPipelines.id),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    fromPhase: text('from_phase'),
    toPhase: text('to_phase'),
    reason: text('reason'), // reason for status change
    triggeredBy: text('triggered_by'), // agent or system that triggered the change
    additionalData: jsonb('additional_data'), // additional context for the change
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    submissionIdx: index('submission_status_history_submission_idx').on(
      table.submissionId
    ),
    statusIdx: index('submission_status_history_status_idx').on(table.toStatus),
    timestampIdx: index('submission_status_history_timestamp_idx').on(
      table.timestamp
    ),
  })
);

export const auditLogs = pgTable('audit_logs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  entityType: text('entity_type').notNull(), // rfp, proposal, submission
  entityId: varchar('entity_id').notNull(),
  action: text('action').notNull(),
  details: jsonb('details'),
  userId: varchar('user_id').references(() => users.id),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: text('type').notNull(), // discovery, compliance, approval, submission
  title: text('title').notNull(),
  message: text('message').notNull(),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: varchar('related_entity_id'),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Scan Management Tables
export const scans = pgTable('scans', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  portalId: varchar('portal_id')
    .references(() => portals.id)
    .notNull(),
  portalName: text('portal_name').notNull(),
  scanType: text('scan_type').notNull().default('Automated'), // Automated, Manual
  status: text('status').notNull().default('running'), // running, completed, failed
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  currentStep: text('current_step').notNull().default('initializing'), // initializing, authenticating, authenticated, navigating, extracting, parsing, saving, completed, failed
  currentProgress: integer('current_progress').default(0).notNull(),
  currentMessage: text('current_message'),
  discoveredRfpsCount: integer('discovered_rfps_count').default(0).notNull(),
  errorCount: integer('error_count').default(0).notNull(),
  errors: jsonb('errors'), // array of error messages
  discoveredRfps: jsonb('discovered_rfps'), // array of discovered RFP objects
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const scanEvents = pgTable('scan_events', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  scanId: varchar('scan_id')
    .references(() => scans.id)
    .notNull(),
  type: text('type').notNull(), // scan_started, step_update, log, progress, rfp_discovered, error, scan_completed, scan_failed
  level: text('level'), // info, warn, error (for log events)
  message: text('message'),
  data: jsonb('data'), // event-specific data
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Company Profile Management Tables
export const companyProfiles = pgTable('company_profiles', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyName: text('company_name').notNull(),
  dba: text('dba'),
  website: text('website'),
  primaryBusinessCategory: text('primary_business_category'),
  naicsPrimary: text('naics_primary'),
  nigpCodes: text('nigp_codes'),
  employeesCount: text('employees_count'),
  registrationState: text('registration_state'),
  county: text('county'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companyAddresses = pgTable('company_addresses', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyProfileId: varchar('company_profile_id')
    .references(() => companyProfiles.id)
    .notNull(),
  addressType: text('address_type').notNull(), // primary_mailing, physical, former
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  city: text('city').notNull(),
  state: text('state').notNull(),
  zipCode: text('zip_code').notNull(),
  country: text('country').default('US').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companyContacts = pgTable('company_contacts', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyProfileId: varchar('company_profile_id')
    .references(() => companyProfiles.id)
    .notNull(),
  contactType: text('contact_type').notNull(), // primary, owner, decision_maker
  name: text('name').notNull(),
  role: text('role'),
  email: text('email'),
  officePhone: text('office_phone'),
  mobilePhone: text('mobile_phone'),
  fax: text('fax'),
  decisionAreas: jsonb('decision_areas'), // array of areas like "financial_contracts", "bids_proposals"
  ownershipPercent: text('ownership_percent'),
  gender: text('gender'),
  ethnicity: text('ethnicity'),
  citizenship: text('citizenship'),
  hoursPerWeek: text('hours_per_week'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companyIdentifiers = pgTable('company_identifiers', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyProfileId: varchar('company_profile_id')
    .references(() => companyProfiles.id)
    .notNull(),
  identifierType: text('identifier_type').notNull(), // duns, sam_uei, ein, tax_id, vendor_id
  identifierValue: text('identifier_value').notNull(),
  issuingEntity: text('issuing_entity'), // e.g., "City of Austin", "Texas"
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companyCertifications = pgTable('company_certifications', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyProfileId: varchar('company_profile_id')
    .references(() => companyProfiles.id)
    .notNull(),
  certificationType: text('certification_type').notNull(), // hub, dbe, mbe, wbe, wbenc, small_business, woman_owned
  certificationNumber: text('certification_number'),
  certificationDate: timestamp('certification_date'),
  expirationDate: timestamp('expiration_date'),
  recertificationDate: timestamp('recertification_date'),
  status: text('status').notNull().default('active'), // active, pending, expired, submitted
  applicationNumber: text('application_number'),
  applicationStarted: timestamp('application_started'),
  submittedDate: timestamp('submitted_date'),
  issuingEntity: text('issuing_entity'),
  notes: text('notes'),
  autoRenewal: boolean('auto_renewal').default(false),
  alertDaysBefore: integer('alert_days_before').default(30),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const companyInsurance = pgTable('company_insurance', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyProfileId: varchar('company_profile_id')
    .references(() => companyProfiles.id)
    .notNull(),
  insuranceType: text('insurance_type').notNull(), // general_liability, professional, workers_comp, etc.
  policyNumber: text('policy_number'),
  carrier: text('carrier'),
  agencyName: text('agency_name'),
  agentName: text('agent_name'),
  agentContact: text('agent_contact'),
  coverageAmount: decimal('coverage_amount', { precision: 12, scale: 2 }),
  deductible: decimal('deductible', { precision: 12, scale: 2 }),
  effectiveDate: timestamp('effective_date'),
  expirationDate: timestamp('expiration_date'),
  policyDetails: jsonb('policy_details'),
  autoRenewal: boolean('auto_renewal').default(false),
  alertDaysBefore: integer('alert_days_before').default(30),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// AI Agent and Conversation Tables
export const aiConversations = pgTable('ai_conversations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  type: text('type').notNull().default('general'), // general, rfp_search, bid_crafting, research
  userId: varchar('user_id').references(() => users.id),
  status: text('status').notNull().default('active'), // active, completed, archived
  context: jsonb('context'), // conversation context and state
  metadata: jsonb('metadata'), // additional conversation metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const conversationMessages = pgTable('conversation_messages', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar('conversation_id')
    .references(() => aiConversations.id)
    .notNull(),
  role: text('role').notNull(), // user, assistant, system
  content: text('content').notNull(),
  messageType: text('message_type').notNull().default('text'), // text, rfp_results, search_results, analysis
  metadata: jsonb('metadata'), // additional message metadata like search parameters, RFP IDs, etc.
  relatedEntityType: text('related_entity_type'), // rfp, proposal, portal
  relatedEntityId: varchar('related_entity_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const researchFindings = pgTable('research_findings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  type: text('type').notNull(), // bid_analysis, market_research, competitor_analysis, pricing_research
  source: text('source').notNull(), // web_search, portal_analysis, historical_data
  sourceUrl: text('source_url'),
  content: jsonb('content').notNull(), // structured research data
  relatedRfpId: varchar('related_rfp_id').references(() => rfps.id),
  relatedProposalId: varchar('related_proposal_id').references(
    () => proposals.id
  ),
  conversationId: varchar('conversation_id').references(
    () => aiConversations.id
  ),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }), // 0.00 to 1.00
  isVerified: boolean('is_verified').default(false).notNull(),
  tags: text('tags').array(), // array of tags for categorization
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Agent Memory and Knowledge Persistence Tables
export const agentMemory = pgTable('agent_memory', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agentId: text('agent_id').notNull(), // discovery-specialist, compliance-specialist, etc.
  memoryType: text('memory_type').notNull(), // episodic, semantic, procedural, working
  contextKey: text('context_key').notNull(), // unique identifier for this memory context
  title: text('title').notNull(),
  content: jsonb('content').notNull(), // structured memory data
  importance: integer('importance').default(1).notNull(), // 1-10 importance score
  accessCount: integer('access_count').default(0).notNull(),
  lastAccessed: timestamp('last_accessed'),
  expiresAt: timestamp('expires_at'), // null = permanent memory
  tags: text('tags').array(),
  metadata: jsonb('metadata'), // additional context data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const agentKnowledgeBase = pgTable('agent_knowledge_base', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agentId: text('agent_id').notNull(),
  knowledgeType: text('knowledge_type').notNull(), // rfp_pattern, compliance_rule, market_insight, pricing_data
  domain: text('domain').notNull(), // technology, healthcare, construction, etc.
  title: text('title').notNull(),
  description: text('description'),
  content: jsonb('content').notNull(), // structured knowledge data
  confidenceScore: decimal('confidence_score', {
    precision: 3,
    scale: 2,
  }).default('0.50'),
  validationStatus: text('validation_status').default('pending').notNull(), // pending, validated, disputed, obsolete
  sourceType: text('source_type').notNull(), // experience, training, research, feedback
  sourceId: varchar('source_id'), // references source entity (RFP, conversation, etc.)
  usageCount: integer('usage_count').default(0).notNull(),
  successRate: decimal('success_rate', { precision: 3, scale: 2 }), // success rate when this knowledge is applied
  tags: text('tags').array(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const agentCoordinationLog = pgTable('agent_coordination_log', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar('session_id').notNull(), // coordination session identifier
  initiatorAgentId: text('initiator_agent_id').notNull(),
  targetAgentId: text('target_agent_id').notNull(),
  coordinationType: text('coordination_type').notNull(), // handoff, collaboration, consultation, delegation
  context: jsonb('context').notNull(), // coordination context and state
  request: jsonb('request').notNull(), // what was requested
  response: jsonb('response'), // response received
  status: text('status').default('pending').notNull(), // pending, in_progress, completed, failed
  priority: integer('priority').default(5).notNull(), // 1-10 priority
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  metadata: jsonb('metadata'),
});

export const workflowState = pgTable(
  'workflow_state',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workflowId: text('workflow_id').notNull(),
    conversationId: varchar('conversation_id').references(
      () => aiConversations.id
    ),
    currentPhase: text('current_phase').notNull(), // discovery, analysis, generation, submission, monitoring
    status: text('status').default('pending').notNull(), // pending, in_progress, suspended, completed, failed, cancelled
    previousStatus: text('previous_status'), // for state rollback capabilities
    progress: integer('progress').default(0).notNull(), // 0-100 percentage
    context: jsonb('context').notNull(), // workflow execution context
    agentAssignments: jsonb('agent_assignments'), // which agents are handling which tasks
    suspensionReason: text('suspension_reason'), // reason for suspension (human_input_required, etc.)
    suspensionData: jsonb('suspension_data'), // data needed to resume
    resumeInstructions: text('resume_instructions'), // instructions for resuming
    estimatedCompletion: timestamp('estimated_completion'),
    // Enhanced Phase State Machine fields
    phaseTransitions: jsonb('phase_transitions'), // track all phase transitions with timestamps
    phaseStartTimes: jsonb('phase_start_times'), // start time for each phase
    phaseCompletionTimes: jsonb('phase_completion_times'), // completion time for each phase
    phaseDependencies: jsonb('phase_dependencies'), // dependencies between phases
    // Advanced State Management fields
    canBePaused: boolean('can_be_paused').default(true).notNull(),
    canBeCancelled: boolean('can_be_cancelled').default(true).notNull(),
    parentWorkflowId: varchar('parent_workflow_id'), // for cascading operations
    childWorkflowIds: text('child_workflow_ids').array(), // child workflows for coordination
    priority: integer('priority').default(5).notNull(), // 1-10 priority for resource management
    resourceAllocation: jsonb('resource_allocation'), // allocated resources (agents, compute, etc.)
    retryPolicy: jsonb('retry_policy'), // workflow-level retry configuration
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    pausedAt: timestamp('paused_at'),
    resumedAt: timestamp('resumed_at'),
    completedAt: timestamp('completed_at'),
    cancelledAt: timestamp('cancelled_at'),
  },
  table => ({
    statusIdx: index('workflow_state_status_idx').on(table.status),
    phaseIdx: index('workflow_state_phase_idx').on(table.currentPhase),
    priorityIdx: index('workflow_state_priority_idx').on(table.priority),
    parentWorkflowIdx: index('workflow_state_parent_idx').on(
      table.parentWorkflowId
    ),
  })
);

export const agentPerformanceMetrics = pgTable(
  'agent_performance_metrics',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    agentId: text('agent_id').notNull(),
    metricType: text('metric_type').notNull(), // task_completion, response_time, accuracy, user_satisfaction
    metricValue: decimal('metric_value', { precision: 10, scale: 4 }).notNull(),
    context: jsonb('context'), // context for this metric (task type, domain, etc.)
    referenceEntityType: text('reference_entity_type'), // conversation, workflow, rfp
    referenceEntityId: varchar('reference_entity_id'),
    aggregationPeriod: text('aggregation_period'), // daily, weekly, monthly
    recordedAt: timestamp('recorded_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    agentIdx: index('agent_performance_metrics_agent_idx').on(table.agentId),
    metricTypeIdx: index('agent_performance_metrics_metric_type_idx').on(
      table.metricType
    ),
    recordedAtIdx: index('agent_performance_metrics_recorded_at_idx').on(
      table.recordedAt
    ),
  })
);

// Dead Letter Queue for failed work items
export const deadLetterQueue = pgTable(
  'dead_letter_queue',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    originalWorkItemId: varchar('original_work_item_id').notNull(),
    workItemData: jsonb('work_item_data').notNull(), // snapshot of failed work item
    failureReason: text('failure_reason').notNull(),
    failureCount: integer('failure_count').default(1).notNull(),
    lastFailureAt: timestamp('last_failure_at').defaultNow().notNull(),
    canBeReprocessed: boolean('can_be_reprocessed').default(true).notNull(),
    reprocessAttempts: integer('reprocess_attempts').default(0).notNull(),
    maxReprocessAttempts: integer('max_reprocess_attempts')
      .default(5)
      .notNull(),
    escalatedAt: timestamp('escalated_at'),
    resolvedAt: timestamp('resolved_at'),
    resolution: text('resolution'), // manual_fix, automatic_retry, permanent_failure
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    failureReasonIdx: index('dlq_failure_reason_idx').on(table.failureReason),
    canBeReprocessedIdx: index('dlq_can_be_reprocessed_idx').on(
      table.canBeReprocessed
    ),
    escalatedAtIdx: index('dlq_escalated_at_idx').on(table.escalatedAt),
  })
);

// Phase State Transitions for detailed tracking
export const phaseStateTransitions = pgTable(
  'phase_state_transitions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workflowId: varchar('workflow_id')
      .references(() => workflowState.id)
      .notNull(),
    workItemId: varchar('work_item_id').references(() => workItems.id),
    entityType: text('entity_type').notNull(), // workflow, work_item, submission_pipeline
    entityId: varchar('entity_id').notNull(),
    fromPhase: text('from_phase'),
    toPhase: text('to_phase').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    transitionType: text('transition_type').notNull(), // automatic, manual, retry, rollback, escalation
    triggeredBy: text('triggered_by').notNull(), // agent_id or 'system'
    reason: text('reason'), // why this transition occurred
    duration: integer('duration'), // time spent in previous phase (seconds)
    metadata: jsonb('metadata'), // additional transition data
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    workflowIdx: index('phase_transitions_workflow_idx').on(table.workflowId),
    entityIdx: index('phase_transitions_entity_idx').on(
      table.entityType,
      table.entityId
    ),
    timestampIdx: index('phase_transitions_timestamp_idx').on(table.timestamp),
    transitionTypeIdx: index('phase_transitions_type_idx').on(
      table.transitionType
    ),
  })
);

// Pipeline Orchestration for cross-pipeline coordination
export const pipelineOrchestration = pgTable(
  'pipeline_orchestration',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orchestrationId: varchar('orchestration_id').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    pipelineIds: text('pipeline_ids').array().notNull(), // workflows being coordinated
    coordinationType: text('coordination_type').notNull(), // sequential, parallel, conditional, priority_based
    status: text('status').default('pending').notNull(), // pending, running, suspended, completed, failed
    currentStage: integer('current_stage').default(0).notNull(),
    totalStages: integer('total_stages').notNull(),
    priority: integer('priority').default(5).notNull(),
    resourceConstraints: jsonb('resource_constraints'), // max agents, memory, etc.
    allocatedResources: jsonb('allocated_resources'), // currently allocated resources
    dependencies: text('dependencies').array(), // other orchestration IDs this depends on
    completionCriteria: jsonb('completion_criteria'), // conditions for completion
    failureHandling: jsonb('failure_handling'), // how to handle pipeline failures
    estimatedDuration: integer('estimated_duration'), // estimated minutes to complete
    actualDuration: integer('actual_duration'), // actual minutes taken
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    suspendedAt: timestamp('suspended_at'),
    failedAt: timestamp('failed_at'),
  },
  table => ({
    statusIdx: index('pipeline_orchestration_status_idx').on(table.status),
    priorityIdx: index('pipeline_orchestration_priority_idx').on(
      table.priority
    ),
    coordinationTypeIdx: index(
      'pipeline_orchestration_coordination_type_idx'
    ).on(table.coordinationType),
  })
);

// System Health Monitoring
export const systemHealth = pgTable(
  'system_health',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    component: text('component').notNull(), // agent_registry, workflow_engine, database, etc.
    healthStatus: text('health_status').notNull(), // healthy, degraded, unhealthy, critical
    lastCheckAt: timestamp('last_check_at').defaultNow().notNull(),
    responseTime: integer('response_time'), // milliseconds
    errorRate: decimal('error_rate', { precision: 5, scale: 4 }).default(
      '0.0000'
    ), // percentage
    throughput: decimal('throughput', { precision: 10, scale: 2 }), // operations per minute
    resourceUtilization: jsonb('resource_utilization'), // CPU, memory, etc.
    activeConnections: integer('active_connections'),
    queueSize: integer('queue_size'), // pending work items
    alertThresholds: jsonb('alert_thresholds'), // when to trigger alerts
    lastAlert: timestamp('last_alert'),
    metadata: jsonb('metadata'), // component-specific health data
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    componentIdx: index('system_health_component_idx').on(table.component),
    statusIdx: index('system_health_status_idx').on(table.healthStatus),
    lastCheckIdx: index('system_health_last_check_idx').on(table.lastCheckAt),
  })
);

// Enhanced Analytics and Metrics
export const pipelineMetrics = pgTable(
  'pipeline_metrics',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    metricType: text('metric_type').notNull(), // success_rate, avg_duration, error_rate, throughput
    entityType: text('entity_type').notNull(), // workflow, phase, agent, system
    entityId: varchar('entity_id'), // specific entity ID or null for system-wide
    timeframe: text('timeframe').notNull(), // hourly, daily, weekly, monthly
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),
    value: decimal('value', { precision: 12, scale: 4 }).notNull(),
    unit: text('unit'), // percentage, seconds, count, etc.
    breakdown: jsonb('breakdown'), // detailed breakdown by subcategory
    comparisonPeriod: jsonb('comparison_period'), // comparison with previous period
    trends: jsonb('trends'), // trending data
    metadata: jsonb('metadata'),
    calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
  },
  table => ({
    metricTypeIdx: index('pipeline_metrics_metric_type_idx').on(
      table.metricType
    ),
    entityIdx: index('pipeline_metrics_entity_idx').on(
      table.entityType,
      table.entityId
    ),
    timeframeIdx: index('pipeline_metrics_timeframe_idx').on(table.timeframe),
    startTimeIdx: index('pipeline_metrics_start_time_idx').on(table.startTime),
  })
);

// Workflow Dependencies for complex orchestration
export const workflowDependencies = pgTable(
  'workflow_dependencies',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workflowId: varchar('workflow_id')
      .references(() => workflowState.id)
      .notNull(),
    dependsOnWorkflowId: varchar('depends_on_workflow_id')
      .references(() => workflowState.id)
      .notNull(),
    dependencyType: text('dependency_type').notNull(), // hard, soft, conditional
    condition: jsonb('condition'), // conditions that must be met
    isBlocking: boolean('is_blocking').default(true).notNull(), // blocks execution if true
    status: text('status').default('pending').notNull(), // pending, satisfied, failed
    satisfiedAt: timestamp('satisfied_at'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    workflowIdx: index('workflow_dependencies_workflow_idx').on(
      table.workflowId
    ),
    dependencyIdx: index('workflow_dependencies_dependency_idx').on(
      table.dependsOnWorkflowId
    ),
    statusIdx: index('workflow_dependencies_status_idx').on(table.status),
  })
);

export const historicalBids = pgTable('historical_bids', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rfpTitle: text('rfp_title').notNull(),
  agency: text('agency').notNull(),
  category: text('category'),
  bidAmount: decimal('bid_amount', { precision: 12, scale: 2 }),
  winningBid: decimal('winning_bid', { precision: 12, scale: 2 }),
  isWinner: boolean('is_winner').notNull(),
  bidder: text('bidder'), // company name that placed the bid
  sourcePortal: text('source_portal'),
  sourceUrl: text('source_url'),
  rfpValue: decimal('rfp_value', { precision: 12, scale: 2 }),
  bidDate: timestamp('bid_date'),
  awardDate: timestamp('award_date'),
  location: text('location'),
  description: text('description'),
  metadata: jsonb('metadata'), // additional structured data about the bid
  researchFindingId: varchar('research_finding_id').references(
    () => researchFindings.id
  ),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3-Tier Agentic System Tables
export const agentRegistry = pgTable(
  'agent_registry',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    agentId: text('agent_id').notNull().unique(), // rfp-orchestrator, portal-manager, austin-specialist, etc.
    tier: text('tier').notNull(), // orchestrator, manager, specialist
    role: text('role').notNull(), // primary-orchestrator, portal-manager, proposal-manager, austin-specialist, etc.
    displayName: text('display_name').notNull(),
    description: text('description'),
    capabilities: text('capabilities').array().notNull(), // portal_scraping, proposal_generation, compliance_checking
    tools: text('tools').array(), // browser, openai, document_parser, etc.
    maxConcurrency: integer('max_concurrency').default(1).notNull(),
    status: text('status').default('active').notNull(), // active, busy, offline, error
    lastHeartbeat: timestamp('last_heartbeat'),
    version: text('version').default('1.0.0').notNull(),
    configuration: jsonb('configuration'), // agent-specific config
    parentAgentId: text('parent_agent_id'), // for hierarchy (specialists report to managers)
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    tierIdx: index('agent_registry_tier_idx').on(table.tier),
    statusIdx: index('agent_registry_status_idx').on(table.status),
    parentAgentIdx: index('agent_registry_parent_agent_idx').on(
      table.parentAgentId
    ),
    parentStatusIdx: index('agent_registry_parent_status_idx').on(
      table.parentAgentId,
      table.status
    ),
  })
);

export const workItems = pgTable(
  'work_items',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: varchar('session_id')
      .notNull()
      .references(() => agentSessions.sessionId), // links to user session
    workflowId: varchar('workflow_id').references(() => workflowState.id), // optional link to workflow
    contextRef: varchar('context_ref'), // rfpId, portalId, profileId for traceability
    taskType: text('task_type').notNull(), // portal_scan, proposal_generate, compliance_check
    inputs: jsonb('inputs').notNull(), // structured task inputs
    expectedOutputs: text('expected_outputs').array(), // what outputs are expected
    priority: integer('priority').default(5).notNull(), // 1-10 priority
    deadline: timestamp('deadline'),
    retries: integer('retries').default(0).notNull(),
    maxRetries: integer('max_retries').default(3).notNull(),
    assignedAgentId: text('assigned_agent_id').references(
      () => agentRegistry.agentId
    ), // which agent is handling this
    createdByAgentId: text('created_by_agent_id')
      .notNull()
      .references(() => agentRegistry.agentId), // which agent created this
    status: text('status').default('pending').notNull(), // pending, assigned, in_progress, completed, failed, cancelled, dlq
    result: jsonb('result'), // task result when completed
    error: text('error'), // error message if failed
    metadata: jsonb('metadata'), // additional task metadata
    // Enhanced Retry/Backoff/DLQ fields
    retryPolicy: jsonb('retry_policy').default('{}').notNull(), // task-specific retry configuration
    retryCount: integer('retry_count').default(0).notNull(), // number of retry attempts made
    nextRetryAt: timestamp('next_retry_at'), // when to retry next
    lastError: text('last_error'), // last error message for retry tracking
    dlq: boolean('dlq').default(false).notNull(), // dead letter queue flag
    backoffMultiplier: decimal('backoff_multiplier', {
      precision: 3,
      scale: 2,
    }).default('2.0'), // exponential backoff multiplier
    lastRetryAt: timestamp('last_retry_at'),
    dlqReason: text('dlq_reason'), // reason for DLQ placement
    dlqTimestamp: timestamp('dlq_timestamp'), // when moved to DLQ
    canRetry: boolean('can_retry').default(true).notNull(),
    isBlocking: boolean('is_blocking').default(false).notNull(), // blocks other items if true
    dependencies: text('dependencies').array(), // work item IDs this depends on
    dependents: text('dependents').array(), // work item IDs that depend on this
    estimatedDuration: integer('estimated_duration'), // estimated duration in minutes
    actualDuration: integer('actual_duration'), // actual duration in minutes
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    assignedAt: timestamp('assigned_at'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    failedAt: timestamp('failed_at'),
    cancelledAt: timestamp('cancelled_at'),
  },
  table => ({
    statusIdx: index('work_items_status_idx').on(table.status),
    priorityIdx: index('work_items_priority_idx').on(table.priority),
    deadlineIdx: index('work_items_deadline_idx').on(table.deadline),
    assignedAgentIdx: index('work_items_assigned_agent_idx').on(
      table.assignedAgentId
    ),
    sessionIdx: index('work_items_session_idx').on(table.sessionId),
    createdByAgentIdx: index('work_items_created_by_agent_idx').on(
      table.createdByAgentId
    ),
    agentSchedulingIdx: index('work_items_agent_scheduling_idx').on(
      table.status,
      table.assignedAgentId,
      table.priority,
      table.deadline
    ),
    globalQueueIdx: index('work_items_global_queue_idx').on(
      table.status,
      table.taskType,
      table.priority,
      table.deadline
    ),
  })
);

export const agentSessions = pgTable(
  'agent_sessions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: varchar('session_id').notNull().unique(),
    userId: varchar('user_id'), // optional user association
    conversationId: varchar('conversation_id').references(
      () => aiConversations.id
    ),
    orchestratorAgentId: text('orchestrator_agent_id')
      .notNull()
      .references(() => agentRegistry.agentId),
    sessionType: text('session_type').notNull(), // rfp_discovery, proposal_generation, compliance_review
    intent: text('intent').notNull(), // user's primary intent for this session
    context: jsonb('context').notNull(), // session context and working memory
    currentPhase: text('current_phase'), // discovery, analysis, generation, submission
    status: text('status').default('active').notNull(), // active, suspended, completed, failed
    priority: integer('priority').default(5).notNull(),
    workItemCount: integer('work_item_count').default(0).notNull(),
    completedWorkItems: integer('completed_work_items').default(0).notNull(),
    estimatedCompletion: timestamp('estimated_completion'),
    lastActivity: timestamp('last_activity').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  table => ({
    statusIdx: index('agent_sessions_status_idx').on(table.status),
    orchestratorIdx: index('agent_sessions_orchestrator_idx').on(
      table.orchestratorAgentId
    ),
    userIdx: index('agent_sessions_user_idx').on(table.userId),
    lastActivityIdx: index('agent_sessions_last_activity_idx').on(
      table.lastActivity
    ),
    statusActivityIdx: index('agent_sessions_status_activity_idx').on(
      table.status,
      table.lastActivity
    ),
  })
);

// Relations
export const portalsRelations = relations(portals, ({ many }) => ({
  rfps: many(rfps),
  submissions: many(submissions),
  scans: many(scans),
}));

export const companyProfilesRelations = relations(
  companyProfiles,
  ({ many }) => ({
    addresses: many(companyAddresses),
    contacts: many(companyContacts),
    identifiers: many(companyIdentifiers),
    certifications: many(companyCertifications),
    insurance: many(companyInsurance),
  })
);

export const companyAddressesRelations = relations(
  companyAddresses,
  ({ one }) => ({
    companyProfile: one(companyProfiles, {
      fields: [companyAddresses.companyProfileId],
      references: [companyProfiles.id],
    }),
  })
);

export const companyContactsRelations = relations(
  companyContacts,
  ({ one }) => ({
    companyProfile: one(companyProfiles, {
      fields: [companyContacts.companyProfileId],
      references: [companyProfiles.id],
    }),
  })
);

export const companyIdentifiersRelations = relations(
  companyIdentifiers,
  ({ one }) => ({
    companyProfile: one(companyProfiles, {
      fields: [companyIdentifiers.companyProfileId],
      references: [companyProfiles.id],
    }),
  })
);

export const companyCertificationsRelations = relations(
  companyCertifications,
  ({ one }) => ({
    companyProfile: one(companyProfiles, {
      fields: [companyCertifications.companyProfileId],
      references: [companyProfiles.id],
    }),
  })
);

export const companyInsuranceRelations = relations(
  companyInsurance,
  ({ one }) => ({
    companyProfile: one(companyProfiles, {
      fields: [companyInsurance.companyProfileId],
      references: [companyProfiles.id],
    }),
  })
);

export const rfpsRelations = relations(rfps, ({ one, many }) => ({
  portal: one(portals, {
    fields: [rfps.portalId],
    references: [portals.id],
  }),
  proposals: many(proposals),
  documents: many(documents),
  submissions: many(submissions),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  rfp: one(rfps, {
    fields: [proposals.rfpId],
    references: [rfps.id],
  }),
  submissions: many(submissions),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  rfp: one(rfps, {
    fields: [documents.rfpId],
    references: [rfps.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  rfp: one(rfps, {
    fields: [submissions.rfpId],
    references: [rfps.id],
  }),
  proposal: one(proposals, {
    fields: [submissions.proposalId],
    references: [proposals.id],
  }),
  portal: one(portals, {
    fields: [submissions.portalId],
    references: [portals.id],
  }),
  pipeline: one(submissionPipelines, {
    fields: [submissions.id],
    references: [submissionPipelines.submissionId],
  }),
  events: many(submissionEvents),
  statusHistory: many(submissionStatusHistory),
}));

// Submission Pipeline Relations
export const submissionPipelinesRelations = relations(
  submissionPipelines,
  ({ one, many }) => ({
    submission: one(submissions, {
      fields: [submissionPipelines.submissionId],
      references: [submissions.id],
    }),
    events: many(submissionEvents),
    statusHistory: many(submissionStatusHistory),
  })
);

export const submissionEventsRelations = relations(
  submissionEvents,
  ({ one }) => ({
    pipeline: one(submissionPipelines, {
      fields: [submissionEvents.pipelineId],
      references: [submissionPipelines.id],
    }),
    submission: one(submissions, {
      fields: [submissionEvents.submissionId],
      references: [submissions.id],
    }),
  })
);

export const submissionStatusHistoryRelations = relations(
  submissionStatusHistory,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [submissionStatusHistory.submissionId],
      references: [submissions.id],
    }),
    pipeline: one(submissionPipelines, {
      fields: [submissionStatusHistory.pipelineId],
      references: [submissionPipelines.id],
    }),
  })
);

// Scan Relations
export const scansRelations = relations(scans, ({ one, many }) => ({
  portal: one(portals, {
    fields: [scans.portalId],
    references: [portals.id],
  }),
  events: many(scanEvents),
}));

export const scanEventsRelations = relations(scanEvents, ({ one }) => ({
  scan: one(scans, {
    fields: [scanEvents.scanId],
    references: [scans.id],
  }),
}));

// AI Conversation Relations
export const aiConversationsRelations = relations(
  aiConversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [aiConversations.userId],
      references: [users.id],
    }),
    messages: many(conversationMessages),
    researchFindings: many(researchFindings),
    workflowStates: many(workflowState),
  })
);

export const conversationMessagesRelations = relations(
  conversationMessages,
  ({ one }) => ({
    conversation: one(aiConversations, {
      fields: [conversationMessages.conversationId],
      references: [aiConversations.id],
    }),
  })
);

export const researchFindingsRelations = relations(
  researchFindings,
  ({ one, many }) => ({
    rfp: one(rfps, {
      fields: [researchFindings.relatedRfpId],
      references: [rfps.id],
    }),
    proposal: one(proposals, {
      fields: [researchFindings.relatedProposalId],
      references: [proposals.id],
    }),
    conversation: one(aiConversations, {
      fields: [researchFindings.conversationId],
      references: [aiConversations.id],
    }),
    historicalBids: many(historicalBids),
  })
);

export const historicalBidsRelations = relations(historicalBids, ({ one }) => ({
  researchFinding: one(researchFindings, {
    fields: [historicalBids.researchFindingId],
    references: [researchFindings.id],
  }),
}));

// 3-Tier Agentic System Relations
export const agentRegistryRelations = relations(
  agentRegistry,
  ({ many, one }) => ({
    assignedWorkItems: many(workItems, { relationName: 'assignedAgent' }),
    createdWorkItems: many(workItems, { relationName: 'createdByAgent' }),
    orchestratedSessions: many(agentSessions),
    parentAgent: one(agentRegistry, {
      fields: [agentRegistry.parentAgentId],
      references: [agentRegistry.agentId],
      relationName: 'agentHierarchy',
    }),
    childAgents: many(agentRegistry, { relationName: 'agentHierarchy' }),
  })
);

export const workItemsRelations = relations(workItems, ({ one }) => ({
  session: one(agentSessions, {
    fields: [workItems.sessionId],
    references: [agentSessions.sessionId],
  }),
  workflow: one(workflowState, {
    fields: [workItems.workflowId],
    references: [workflowState.id],
  }),
  assignedAgent: one(agentRegistry, {
    fields: [workItems.assignedAgentId],
    references: [agentRegistry.agentId],
    relationName: 'assignedAgent',
  }),
  createdByAgent: one(agentRegistry, {
    fields: [workItems.createdByAgentId],
    references: [agentRegistry.agentId],
    relationName: 'createdByAgent',
  }),
}));

export const agentSessionsRelations = relations(
  agentSessions,
  ({ one, many }) => ({
    orchestrator: one(agentRegistry, {
      fields: [agentSessions.orchestratorAgentId],
      references: [agentRegistry.agentId],
    }),
    conversation: one(aiConversations, {
      fields: [agentSessions.conversationId],
      references: [aiConversations.id],
    }),
    workItems: many(workItems),
  })
);

// Agent Memory and Knowledge Relations
export const agentMemoryRelations = relations(agentMemory, () => ({
  // Memory can be linked to knowledge for learning
}));

export const agentKnowledgeBaseRelations = relations(
  agentKnowledgeBase,
  () => ({
    // Knowledge can reference multiple memories
  })
);

export const workflowStateRelations = relations(workflowState, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [workflowState.conversationId],
    references: [aiConversations.id],
  }),
}));

// Insert schemas for Agent Memory and Knowledge
export const insertAgentMemorySchema = createInsertSchema(agentMemory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  accessCount: true,
  lastAccessed: true,
});

export const insertAgentKnowledgeSchema = createInsertSchema(
  agentKnowledgeBase
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

export const insertAgentCoordinationLogSchema = createInsertSchema(
  agentCoordinationLog
).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertWorkflowStateSchema = createInsertSchema(workflowState).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
  }
);

export const insertAgentPerformanceMetricsSchema = createInsertSchema(
  agentPerformanceMetrics
).omit({
  id: true,
  recordedAt: true,
  createdAt: true,
});

// 3-Tier Agentic System Insert Schemas
export const insertAgentRegistrySchema = createInsertSchema(agentRegistry).omit(
  {
    id: true,
    createdAt: true,
    updatedAt: true,
    lastHeartbeat: true,
  }
);

export const insertWorkItemSchema = createInsertSchema(workItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertAgentSessionSchema = createInsertSchema(agentSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  lastActivity: true,
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
  activatedAt: true,
});

export const insertPortalSchema = createInsertSchema(portals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastScanned: true,
});

export const insertRfpSchema = createInsertSchema(rfps).omit({
  id: true,
  createdAt: true,
  discoveredAt: true,
  updatedAt: true,
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  generatedAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export const insertSubmissionSchema = createInsertSchema(submissions).omit({
  id: true,
  createdAt: true,
  submittedAt: true,
  confirmedAt: true,
});

// Submission Pipeline Insert Schemas
export const insertSubmissionPipelineSchema = createInsertSchema(
  submissionPipelines
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertSubmissionEventSchema = createInsertSchema(
  submissionEvents
).omit({
  id: true,
  timestamp: true,
  createdAt: true,
});

export const insertSubmissionStatusHistorySchema = createInsertSchema(
  submissionStatusHistory
).omit({
  id: true,
  timestamp: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Scan Insert Schemas
export const insertScanSchema = createInsertSchema(scans).omit({
  id: true,
  createdAt: true,
});

export const insertScanEventSchema = createInsertSchema(scanEvents).omit({
  id: true,
  createdAt: true,
});

// Company Profile Insert Schemas
export const insertCompanyProfileSchema = createInsertSchema(
  companyProfiles
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyAddressSchema = createInsertSchema(
  companyAddresses
).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyContactSchema = createInsertSchema(
  companyContacts
).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyIdentifierSchema = createInsertSchema(
  companyIdentifiers
).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyCertificationSchema = createInsertSchema(
  companyCertifications
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyInsuranceSchema = createInsertSchema(
  companyInsurance
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// AI Conversation Insert Schemas
export const insertAiConversationSchema = createInsertSchema(
  aiConversations
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationMessageSchema = createInsertSchema(
  conversationMessages
).omit({
  id: true,
  createdAt: true,
});

export const insertResearchFindingSchema = createInsertSchema(
  researchFindings
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHistoricalBidSchema = createInsertSchema(
  historicalBids
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Enhanced Orchestration Insert Schemas
export const insertDeadLetterQueueSchema = createInsertSchema(
  deadLetterQueue
).omit({
  id: true,
  createdAt: true,
});

export const insertPhaseStateTransitionsSchema = createInsertSchema(
  phaseStateTransitions
).omit({
  id: true,
  createdAt: true,
});

export const insertPipelineOrchestrationSchema = createInsertSchema(
  pipelineOrchestration
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemHealthSchema = createInsertSchema(systemHealth).omit({
  id: true,
  createdAt: true,
});

export const insertPipelineMetricsSchema = createInsertSchema(
  pipelineMetrics
).omit({
  id: true,
  calculatedAt: true,
});

export const insertWorkflowDependenciesSchema = createInsertSchema(
  workflowDependencies
).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Portal = typeof portals.$inferSelect;
export type PublicPortal = Omit<Portal, 'username' | 'password'>;
export type InsertPortal = z.infer<typeof insertPortalSchema>;

export type RFP = typeof rfps.$inferSelect;
export type InsertRFP = z.infer<typeof insertRfpSchema>;

export type ProposalRow = typeof proposals.$inferSelect;
export type Proposal = Omit<ProposalRow, 'receiptData'> & {
  receiptData: SubmissionReceiptData | null;
};
type InsertProposalInput = z.infer<typeof insertProposalSchema>;
export type InsertProposal = Omit<
  InsertProposalInput,
  'receiptData' | 'submittedAt'
> & {
  rfpId: string;
  receiptData?: SubmissionReceiptData | null;
  submittedAt?: Date | null;
};

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type SubmissionRow = typeof submissions.$inferSelect;
export type Submission = Omit<
  SubmissionRow,
  'status' | 'submissionData' | 'receiptData'
> & {
  status: SubmissionStatusValue;
  submissionData: SubmissionLifecycleData | null;
  receiptData: SubmissionReceiptData | null;
};

type InsertSubmissionInput = z.infer<typeof insertSubmissionSchema>;
export type InsertSubmission = Omit<
  InsertSubmissionInput,
  'submissionData' | 'receiptData'
> & {
  rfpId: string;
  proposalId: string;
  portalId: string;
  submissionData?: SubmissionLifecycleData | null;
  receiptData?: SubmissionReceiptData | null;
};

// Submission Pipeline Types
export type SubmissionPipelineRow = typeof submissionPipelines.$inferSelect;
export type SubmissionPipeline = Omit<
  SubmissionPipelineRow,
  | 'currentPhase'
  | 'status'
  | 'metadata'
  | 'preflightChecks'
  | 'authenticationData'
  | 'formData'
  | 'uploadedDocuments'
  | 'submissionReceipt'
  | 'errorData'
> & {
  currentPhase: SubmissionPipelinePhase;
  status: SubmissionPipelineStatus;
  metadata: SubmissionPipelineMetadata | null;
  preflightChecks: SubmissionPhaseResult | null;
  authenticationData: SubmissionPhaseResult | null;
  formData: SubmissionPhaseResult | null;
  uploadedDocuments: SubmissionPhaseResult | null;
  submissionReceipt: SubmissionVerificationResult | null;
  errorData: SubmissionPipelineErrorData | null;
};

type InsertSubmissionPipelineInput = z.infer<
  typeof insertSubmissionPipelineSchema
>;
export type InsertSubmissionPipeline = Omit<
  InsertSubmissionPipelineInput,
  | 'metadata'
  | 'preflightChecks'
  | 'authenticationData'
  | 'formData'
  | 'uploadedDocuments'
  | 'submissionReceipt'
  | 'errorData'
> & {
  metadata?: SubmissionPipelineMetadata | null;
  preflightChecks?: SubmissionPhaseResult | null;
  authenticationData?: SubmissionPhaseResult | null;
  formData?: SubmissionPhaseResult | null;
  uploadedDocuments?: SubmissionPhaseResult | null;
  submissionReceipt?: SubmissionVerificationResult | null;
  errorData?: SubmissionPipelineErrorData | null;
};

export type SubmissionEvent = typeof submissionEvents.$inferSelect;
export type InsertSubmissionEvent = z.infer<typeof insertSubmissionEventSchema>;

export type SubmissionStatusHistory =
  typeof submissionStatusHistory.$inferSelect;
export type InsertSubmissionStatusHistory = z.infer<
  typeof insertSubmissionStatusHistorySchema
>;

export interface SubmissionPipelineRequest {
  submissionId: string;
  sessionId: string;
  portalCredentials?: {
    username?: string;
    password?: string;
    mfaMethod?: string;
  };
  priority?: number;
  deadline?: Date;
  retryOptions?: {
    maxRetries?: number;
    retryDelay?: number;
  };
  browserOptions?: {
    headless?: boolean;
    timeout?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface SubmissionPipelineResult {
  success: boolean;
  pipelineId?: string;
  submissionId?: string;
  currentPhase?: SubmissionPipelinePhase;
  progress?: number;
  status?: SubmissionPipelineStatus;
  error?: string;
  estimatedCompletion?: Date;
  receiptData?: SubmissionVerificationResult | null;
  nextSteps?: string[];
}

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Scan Types
export type Scan = typeof scans.$inferSelect;
export type InsertScan = z.infer<typeof insertScanSchema>;

export type ScanEvent = typeof scanEvents.$inferSelect;
export type InsertScanEvent = z.infer<typeof insertScanEventSchema>;

// Company Profile Types
export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type InsertCompanyProfile = z.infer<typeof insertCompanyProfileSchema>;

export type CompanyAddress = typeof companyAddresses.$inferSelect;
export type InsertCompanyAddress = z.infer<typeof insertCompanyAddressSchema>;

export type CompanyContact = typeof companyContacts.$inferSelect;
export type InsertCompanyContact = z.infer<typeof insertCompanyContactSchema>;

export type CompanyIdentifier = typeof companyIdentifiers.$inferSelect;
export type InsertCompanyIdentifier = z.infer<
  typeof insertCompanyIdentifierSchema
>;

export type CompanyCertification = typeof companyCertifications.$inferSelect;
export type InsertCompanyCertification = z.infer<
  typeof insertCompanyCertificationSchema
>;

export type CompanyInsurance = typeof companyInsurance.$inferSelect;
export type InsertCompanyInsurance = z.infer<
  typeof insertCompanyInsuranceSchema
>;

// AI Conversation Types
export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = z.infer<
  typeof insertConversationMessageSchema
>;

export type ResearchFinding = typeof researchFindings.$inferSelect;
export type InsertResearchFinding = z.infer<typeof insertResearchFindingSchema>;

export type HistoricalBid = typeof historicalBids.$inferSelect;
export type InsertHistoricalBid = z.infer<typeof insertHistoricalBidSchema>;

// 3-Tier Agentic System Types
export type AgentRegistry = typeof agentRegistry.$inferSelect;
export type InsertAgentRegistry = z.infer<typeof insertAgentRegistrySchema>;

export type WorkItem = typeof workItems.$inferSelect;
export type InsertWorkItem = z.infer<typeof insertWorkItemSchema>;

export type AgentSession = typeof agentSessions.$inferSelect;
export type InsertAgentSession = z.infer<typeof insertAgentSessionSchema>;

// Enhanced Orchestration Types
export type DeadLetterQueue = typeof deadLetterQueue.$inferSelect;
export type InsertDeadLetterQueue = z.infer<typeof insertDeadLetterQueueSchema>;

export type PhaseStateTransition = typeof phaseStateTransitions.$inferSelect;
export type InsertPhaseStateTransition = z.infer<
  typeof insertPhaseStateTransitionsSchema
>;

export type PipelineOrchestration = typeof pipelineOrchestration.$inferSelect;
export type InsertPipelineOrchestration = z.infer<
  typeof insertPipelineOrchestrationSchema
>;

export type SystemHealth = typeof systemHealth.$inferSelect;
export type InsertSystemHealth = z.infer<typeof insertSystemHealthSchema>;

export type PipelineMetrics = typeof pipelineMetrics.$inferSelect;
export type InsertPipelineMetrics = z.infer<typeof insertPipelineMetricsSchema>;

export type WorkflowDependency = typeof workflowDependencies.$inferSelect;
export type InsertWorkflowDependency = z.infer<
  typeof insertWorkflowDependenciesSchema
>;
