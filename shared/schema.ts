import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, jsonb, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const portals = pgTable("portals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  loginRequired: boolean("login_required").default(false).notNull(),
  username: text("username"),
  password: text("password"),
  lastScanned: timestamp("last_scanned"),
  status: text("status").notNull().default("active"), // active, maintenance, error
  scanFrequency: integer("scan_frequency").default(24).notNull(), // hours between scans
  maxRfpsPerScan: integer("max_rfps_per_scan").default(50).notNull(),
  selectors: jsonb("selectors"), // CSS selectors and scraping config
  filters: jsonb("filters"), // business type, value filters, etc.
  lastError: text("last_error"),
  errorCount: integer("error_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rfps = pgTable("rfps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  agency: text("agency").notNull(),
  portalId: varchar("portal_id").references(() => portals.id),
  sourceUrl: text("source_url").notNull(),
  deadline: timestamp("deadline"),
  estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("discovered"), // discovered, parsing, drafting, review, approved, submitted, closed
  progress: integer("progress").default(0).notNull(),
  requirements: jsonb("requirements"), // parsed requirements object
  complianceItems: jsonb("compliance_items"), // compliance checklist
  riskFlags: jsonb("risk_flags"), // high-risk items
  addedBy: text("added_by").notNull().default("automatic"), // "manual" or "automatic"
  manuallyAddedAt: timestamp("manually_added_at"), // Only set if manually added
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rfpId: varchar("rfp_id").references(() => rfps.id).notNull(),
  content: jsonb("content"), // generated proposal content
  narratives: jsonb("narratives"), // AI-generated narratives
  pricingTables: jsonb("pricing_tables"), // pricing breakdown
  forms: jsonb("forms"), // filled forms
  attachments: jsonb("attachments"), // file references
  estimatedMargin: decimal("estimated_margin", { precision: 5, scale: 2 }),
  status: text("status").notNull().default("draft"), // draft, review, approved, submitted
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rfpId: varchar("rfp_id").references(() => rfps.id).notNull(),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  objectPath: text("object_path").notNull(),
  extractedText: text("extracted_text"),
  parsedData: jsonb("parsed_data"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rfpId: varchar("rfp_id").references(() => rfps.id).notNull(),
  proposalId: varchar("proposal_id").references(() => proposals.id).notNull(),
  portalId: varchar("portal_id").references(() => portals.id).notNull(),
  submissionData: jsonb("submission_data"), // portal-specific submission data
  receiptData: jsonb("receipt_data"), // submission confirmation
  status: text("status").notNull().default("pending"), // pending, submitted, failed, confirmed
  submittedAt: timestamp("submitted_at"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // rfp, proposal, submission
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(),
  details: jsonb("details"),
  userId: varchar("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // discovery, compliance, approval, submission
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: varchar("related_entity_id"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Scan Management Tables
export const scans = pgTable("scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalId: varchar("portal_id").references(() => portals.id).notNull(),
  portalName: text("portal_name").notNull(),
  status: text("status").notNull().default("running"), // running, completed, failed
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  currentStep: text("current_step").notNull().default("initializing"), // initializing, authenticating, authenticated, navigating, extracting, parsing, saving, completed, failed
  currentProgress: integer("current_progress").default(0).notNull(),
  currentMessage: text("current_message"),
  discoveredRfpsCount: integer("discovered_rfps_count").default(0).notNull(),
  errorCount: integer("error_count").default(0).notNull(),
  errors: jsonb("errors"), // array of error messages
  discoveredRfps: jsonb("discovered_rfps"), // array of discovered RFP objects
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scanEvents = pgTable("scan_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scanId: varchar("scan_id").references(() => scans.id).notNull(),
  type: text("type").notNull(), // scan_started, step_update, log, progress, rfp_discovered, error, scan_completed, scan_failed
  level: text("level"), // info, warn, error (for log events)
  message: text("message"),
  data: jsonb("data"), // event-specific data
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Company Profile Management Tables
export const companyProfiles = pgTable("company_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  dba: text("dba"),
  website: text("website"),
  primaryBusinessCategory: text("primary_business_category"),
  naicsPrimary: text("naics_primary"),
  nigpCodes: text("nigp_codes"),
  employeesCount: text("employees_count"),
  registrationState: text("registration_state"),
  county: text("county"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companyAddresses = pgTable("company_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyProfileId: varchar("company_profile_id").references(() => companyProfiles.id).notNull(),
  addressType: text("address_type").notNull(), // primary_mailing, physical, former
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  country: text("country").default("US").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companyContacts = pgTable("company_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyProfileId: varchar("company_profile_id").references(() => companyProfiles.id).notNull(),
  contactType: text("contact_type").notNull(), // primary, owner, decision_maker
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  officePhone: text("office_phone"),
  mobilePhone: text("mobile_phone"),
  fax: text("fax"),
  decisionAreas: jsonb("decision_areas"), // array of areas like "financial_contracts", "bids_proposals"
  ownershipPercent: text("ownership_percent"),
  gender: text("gender"),
  ethnicity: text("ethnicity"),
  citizenship: text("citizenship"),
  hoursPerWeek: text("hours_per_week"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companyIdentifiers = pgTable("company_identifiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyProfileId: varchar("company_profile_id").references(() => companyProfiles.id).notNull(),
  identifierType: text("identifier_type").notNull(), // duns, sam_uei, ein, tax_id, vendor_id
  identifierValue: text("identifier_value").notNull(),
  issuingEntity: text("issuing_entity"), // e.g., "City of Austin", "Texas"
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companyCertifications = pgTable("company_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyProfileId: varchar("company_profile_id").references(() => companyProfiles.id).notNull(),
  certificationType: text("certification_type").notNull(), // hub, dbe, mbe, wbe, wbenc, small_business, woman_owned
  certificationNumber: text("certification_number"),
  certificationDate: timestamp("certification_date"),
  expirationDate: timestamp("expiration_date"),
  recertificationDate: timestamp("recertification_date"),
  status: text("status").notNull().default("active"), // active, pending, expired, submitted
  applicationNumber: text("application_number"),
  applicationStarted: timestamp("application_started"),
  submittedDate: timestamp("submitted_date"),
  issuingEntity: text("issuing_entity"),
  notes: text("notes"),
  autoRenewal: boolean("auto_renewal").default(false),
  alertDaysBefore: integer("alert_days_before").default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companyInsurance = pgTable("company_insurance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyProfileId: varchar("company_profile_id").references(() => companyProfiles.id).notNull(),
  insuranceType: text("insurance_type").notNull(), // general_liability, professional, workers_comp, etc.
  policyNumber: text("policy_number"),
  carrier: text("carrier"),
  agencyName: text("agency_name"),
  agentName: text("agent_name"),
  agentContact: text("agent_contact"),
  coverageAmount: decimal("coverage_amount", { precision: 12, scale: 2 }),
  deductible: decimal("deductible", { precision: 12, scale: 2 }),
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  policyDetails: jsonb("policy_details"),
  autoRenewal: boolean("auto_renewal").default(false),
  alertDaysBefore: integer("alert_days_before").default(30),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Agent and Conversation Tables
export const aiConversations = pgTable("ai_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull().default("general"), // general, rfp_search, bid_crafting, research
  userId: varchar("user_id").references(() => users.id),
  status: text("status").notNull().default("active"), // active, completed, archived
  context: jsonb("context"), // conversation context and state
  metadata: jsonb("metadata"), // additional conversation metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => aiConversations.id).notNull(),
  role: text("role").notNull(), // user, assistant, system
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"), // text, rfp_results, search_results, analysis
  metadata: jsonb("metadata"), // additional message metadata like search parameters, RFP IDs, etc.
  relatedEntityType: text("related_entity_type"), // rfp, proposal, portal
  relatedEntityId: varchar("related_entity_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const researchFindings = pgTable("research_findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull(), // bid_analysis, market_research, competitor_analysis, pricing_research
  source: text("source").notNull(), // web_search, portal_analysis, historical_data
  sourceUrl: text("source_url"),
  content: jsonb("content").notNull(), // structured research data
  relatedRfpId: varchar("related_rfp_id").references(() => rfps.id),
  relatedProposalId: varchar("related_proposal_id").references(() => proposals.id),
  conversationId: varchar("conversation_id").references(() => aiConversations.id),
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }), // 0.00 to 1.00
  isVerified: boolean("is_verified").default(false).notNull(),
  tags: text("tags").array(), // array of tags for categorization
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Agent Memory and Knowledge Persistence Tables
export const agentMemory = pgTable("agent_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: text("agent_id").notNull(), // discovery-specialist, compliance-specialist, etc.
  memoryType: text("memory_type").notNull(), // episodic, semantic, procedural, working
  contextKey: text("context_key").notNull(), // unique identifier for this memory context
  title: text("title").notNull(),
  content: jsonb("content").notNull(), // structured memory data
  importance: integer("importance").default(1).notNull(), // 1-10 importance score
  accessCount: integer("access_count").default(0).notNull(),
  lastAccessed: timestamp("last_accessed"),
  expiresAt: timestamp("expires_at"), // null = permanent memory
  tags: text("tags").array(),
  metadata: jsonb("metadata"), // additional context data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentKnowledgeBase = pgTable("agent_knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: text("agent_id").notNull(),
  knowledgeType: text("knowledge_type").notNull(), // rfp_pattern, compliance_rule, market_insight, pricing_data
  domain: text("domain").notNull(), // technology, healthcare, construction, etc.
  title: text("title").notNull(),
  description: text("description"),
  content: jsonb("content").notNull(), // structured knowledge data
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }).default('0.50'),
  validationStatus: text("validation_status").default("pending").notNull(), // pending, validated, disputed, obsolete
  sourceType: text("source_type").notNull(), // experience, training, research, feedback
  sourceId: varchar("source_id"), // references source entity (RFP, conversation, etc.)
  usageCount: integer("usage_count").default(0).notNull(),
  successRate: decimal("success_rate", { precision: 3, scale: 2 }), // success rate when this knowledge is applied
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentCoordinationLog = pgTable("agent_coordination_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(), // coordination session identifier
  initiatorAgentId: text("initiator_agent_id").notNull(),
  targetAgentId: text("target_agent_id").notNull(),
  coordinationType: text("coordination_type").notNull(), // handoff, collaboration, consultation, delegation
  context: jsonb("context").notNull(), // coordination context and state
  request: jsonb("request").notNull(), // what was requested
  response: jsonb("response"), // response received
  status: text("status").default("pending").notNull(), // pending, in_progress, completed, failed
  priority: integer("priority").default(5).notNull(), // 1-10 priority
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata"),
});

export const workflowState = pgTable("workflow_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: text("workflow_id").notNull(),
  conversationId: varchar("conversation_id").references(() => aiConversations.id),
  currentPhase: text("current_phase").notNull(), // discovery, analysis, generation, submission, monitoring
  status: text("status").default("active").notNull(), // active, suspended, completed, failed
  progress: integer("progress").default(0).notNull(), // 0-100 percentage
  context: jsonb("context").notNull(), // workflow execution context
  agentAssignments: jsonb("agent_assignments"), // which agents are handling which tasks
  suspensionReason: text("suspension_reason"), // reason for suspension (human_input_required, etc.)
  suspensionData: jsonb("suspension_data"), // data needed to resume
  resumeInstructions: text("resume_instructions"), // instructions for resuming
  estimatedCompletion: timestamp("estimated_completion"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentPerformanceMetrics = pgTable("agent_performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: text("agent_id").notNull(),
  metricType: text("metric_type").notNull(), // task_completion, response_time, accuracy, user_satisfaction
  metricValue: decimal("metric_value", { precision: 10, scale: 4 }).notNull(),
  context: jsonb("context"), // context for this metric (task type, domain, etc.)
  referenceEntityType: text("reference_entity_type"), // conversation, workflow, rfp
  referenceEntityId: varchar("reference_entity_id"),
  aggregationPeriod: text("aggregation_period"), // daily, weekly, monthly
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const historicalBids = pgTable("historical_bids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rfpTitle: text("rfp_title").notNull(),
  agency: text("agency").notNull(),
  category: text("category"),
  bidAmount: decimal("bid_amount", { precision: 12, scale: 2 }),
  winningBid: decimal("winning_bid", { precision: 12, scale: 2 }),
  isWinner: boolean("is_winner").notNull(),
  bidder: text("bidder"), // company name that placed the bid
  sourcePortal: text("source_portal"),
  sourceUrl: text("source_url"),
  rfpValue: decimal("rfp_value", { precision: 12, scale: 2 }),
  bidDate: timestamp("bid_date"),
  awardDate: timestamp("award_date"),
  location: text("location"),
  description: text("description"),
  metadata: jsonb("metadata"), // additional structured data about the bid
  researchFindingId: varchar("research_finding_id").references(() => researchFindings.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 3-Tier Agentic System Tables
export const agentRegistry = pgTable("agent_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: text("agent_id").notNull().unique(), // rfp-orchestrator, portal-manager, austin-specialist, etc.
  tier: text("tier").notNull(), // orchestrator, manager, specialist
  role: text("role").notNull(), // primary-orchestrator, portal-manager, proposal-manager, austin-specialist, etc.
  displayName: text("display_name").notNull(),
  description: text("description"),
  capabilities: text("capabilities").array().notNull(), // portal_scraping, proposal_generation, compliance_checking
  tools: text("tools").array(), // browser, openai, document_parser, etc.
  maxConcurrency: integer("max_concurrency").default(1).notNull(),
  status: text("status").default("active").notNull(), // active, busy, offline, error
  lastHeartbeat: timestamp("last_heartbeat"),
  version: text("version").default("1.0.0").notNull(),
  configuration: jsonb("configuration"), // agent-specific config
  parentAgentId: text("parent_agent_id"), // for hierarchy (specialists report to managers)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tierIdx: index("agent_registry_tier_idx").on(table.tier),
  statusIdx: index("agent_registry_status_idx").on(table.status),
  parentAgentIdx: index("agent_registry_parent_agent_idx").on(table.parentAgentId),
  parentStatusIdx: index("agent_registry_parent_status_idx").on(table.parentAgentId, table.status),
}));

export const workItems = pgTable("work_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => agentSessions.sessionId), // links to user session
  workflowId: varchar("workflow_id").references(() => workflowState.id), // optional link to workflow
  contextRef: varchar("context_ref"), // rfpId, portalId, profileId for traceability
  taskType: text("task_type").notNull(), // portal_scan, proposal_generate, compliance_check
  inputs: jsonb("inputs").notNull(), // structured task inputs
  expectedOutputs: text("expected_outputs").array(), // what outputs are expected
  priority: integer("priority").default(5).notNull(), // 1-10 priority
  deadline: timestamp("deadline"),
  retries: integer("retries").default(0).notNull(),
  maxRetries: integer("max_retries").default(3).notNull(),
  assignedAgentId: text("assigned_agent_id").references(() => agentRegistry.agentId), // which agent is handling this
  createdByAgentId: text("created_by_agent_id").notNull().references(() => agentRegistry.agentId), // which agent created this
  status: text("status").default("pending").notNull(), // pending, assigned, in_progress, completed, failed
  result: jsonb("result"), // task result when completed
  error: text("error"), // error message if failed
  metadata: jsonb("metadata"), // additional task metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("work_items_status_idx").on(table.status),
  priorityIdx: index("work_items_priority_idx").on(table.priority),
  deadlineIdx: index("work_items_deadline_idx").on(table.deadline),
  assignedAgentIdx: index("work_items_assigned_agent_idx").on(table.assignedAgentId),
  sessionIdx: index("work_items_session_idx").on(table.sessionId),
  createdByAgentIdx: index("work_items_created_by_agent_idx").on(table.createdByAgentId),
  agentSchedulingIdx: index("work_items_agent_scheduling_idx").on(table.status, table.assignedAgentId, table.priority, table.deadline),
  globalQueueIdx: index("work_items_global_queue_idx").on(table.status, table.taskType, table.priority, table.deadline),
}));

export const agentSessions = pgTable("agent_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(),
  userId: varchar("user_id"), // optional user association
  conversationId: varchar("conversation_id").references(() => aiConversations.id),
  orchestratorAgentId: text("orchestrator_agent_id").notNull().references(() => agentRegistry.agentId),
  sessionType: text("session_type").notNull(), // rfp_discovery, proposal_generation, compliance_review
  intent: text("intent").notNull(), // user's primary intent for this session
  context: jsonb("context").notNull(), // session context and working memory
  currentPhase: text("current_phase"), // discovery, analysis, generation, submission
  status: text("status").default("active").notNull(), // active, suspended, completed, failed
  priority: integer("priority").default(5).notNull(),
  workItemCount: integer("work_item_count").default(0).notNull(),
  completedWorkItems: integer("completed_work_items").default(0).notNull(),
  estimatedCompletion: timestamp("estimated_completion"),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("agent_sessions_status_idx").on(table.status),
  orchestratorIdx: index("agent_sessions_orchestrator_idx").on(table.orchestratorAgentId),
  userIdx: index("agent_sessions_user_idx").on(table.userId),
  lastActivityIdx: index("agent_sessions_last_activity_idx").on(table.lastActivity),
  statusActivityIdx: index("agent_sessions_status_activity_idx").on(table.status, table.lastActivity),
}));

// Relations
export const portalsRelations = relations(portals, ({ many }) => ({
  rfps: many(rfps),
  submissions: many(submissions),
  scans: many(scans),
}));

export const companyProfilesRelations = relations(companyProfiles, ({ many }) => ({
  addresses: many(companyAddresses),
  contacts: many(companyContacts),
  identifiers: many(companyIdentifiers),
  certifications: many(companyCertifications),
  insurance: many(companyInsurance),
}));

export const companyAddressesRelations = relations(companyAddresses, ({ one }) => ({
  companyProfile: one(companyProfiles, {
    fields: [companyAddresses.companyProfileId],
    references: [companyProfiles.id],
  }),
}));

export const companyContactsRelations = relations(companyContacts, ({ one }) => ({
  companyProfile: one(companyProfiles, {
    fields: [companyContacts.companyProfileId],
    references: [companyProfiles.id],
  }),
}));

export const companyIdentifiersRelations = relations(companyIdentifiers, ({ one }) => ({
  companyProfile: one(companyProfiles, {
    fields: [companyIdentifiers.companyProfileId],
    references: [companyProfiles.id],
  }),
}));

export const companyCertificationsRelations = relations(companyCertifications, ({ one }) => ({
  companyProfile: one(companyProfiles, {
    fields: [companyCertifications.companyProfileId],
    references: [companyProfiles.id],
  }),
}));

export const companyInsuranceRelations = relations(companyInsurance, ({ one }) => ({
  companyProfile: one(companyProfiles, {
    fields: [companyInsurance.companyProfileId],
    references: [companyProfiles.id],
  }),
}));

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

export const submissionsRelations = relations(submissions, ({ one }) => ({
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
}));

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
export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [aiConversations.userId],
    references: [users.id],
  }),
  messages: many(conversationMessages),
  researchFindings: many(researchFindings),
  workflowStates: many(workflowState),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [conversationMessages.conversationId],
    references: [aiConversations.id],
  }),
}));

export const researchFindingsRelations = relations(researchFindings, ({ one, many }) => ({
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
}));

export const historicalBidsRelations = relations(historicalBids, ({ one }) => ({
  researchFinding: one(researchFindings, {
    fields: [historicalBids.researchFindingId],
    references: [researchFindings.id],
  }),
}));

// 3-Tier Agentic System Relations
export const agentRegistryRelations = relations(agentRegistry, ({ many, one }) => ({
  assignedWorkItems: many(workItems, { relationName: "assignedAgent" }),
  createdWorkItems: many(workItems, { relationName: "createdByAgent" }),
  orchestratedSessions: many(agentSessions),
  parentAgent: one(agentRegistry, {
    fields: [agentRegistry.parentAgentId],
    references: [agentRegistry.agentId],
    relationName: "agentHierarchy",
  }),
  childAgents: many(agentRegistry, { relationName: "agentHierarchy" }),
}));

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
    relationName: "assignedAgent",
  }),
  createdByAgent: one(agentRegistry, {
    fields: [workItems.createdByAgentId],
    references: [agentRegistry.agentId],
    relationName: "createdByAgent",
  }),
}));

export const agentSessionsRelations = relations(agentSessions, ({ one, many }) => ({
  orchestrator: one(agentRegistry, {
    fields: [agentSessions.orchestratorAgentId],
    references: [agentRegistry.agentId],
  }),
  conversation: one(aiConversations, {
    fields: [agentSessions.conversationId],
    references: [aiConversations.id],
  }),
  workItems: many(workItems),
}));

// Agent Memory and Knowledge Relations
export const agentMemoryRelations = relations(agentMemory, ({ many }) => ({
  // Memory can be linked to knowledge for learning
}));

export const agentKnowledgeBaseRelations = relations(agentKnowledgeBase, ({ many }) => ({
  // Knowledge can reference multiple memories
}));

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

export const insertAgentKnowledgeSchema = createInsertSchema(agentKnowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

export const insertAgentCoordinationLogSchema = createInsertSchema(agentCoordinationLog).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertWorkflowStateSchema = createInsertSchema(workflowState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentPerformanceMetricsSchema = createInsertSchema(agentPerformanceMetrics).omit({
  id: true,
  recordedAt: true,
  createdAt: true,
});

// 3-Tier Agentic System Insert Schemas
export const insertAgentRegistrySchema = createInsertSchema(agentRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastHeartbeat: true,
});

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
});

export const insertPortalSchema = createInsertSchema(portals).omit({
  id: true,
  createdAt: true,
  lastScanned: true,
});

export const insertRfpSchema = createInsertSchema(rfps).omit({
  id: true,
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
export const insertCompanyProfileSchema = createInsertSchema(companyProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyAddressSchema = createInsertSchema(companyAddresses).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyContactSchema = createInsertSchema(companyContacts).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyIdentifierSchema = createInsertSchema(companyIdentifiers).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyCertificationSchema = createInsertSchema(companyCertifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyInsuranceSchema = createInsertSchema(companyInsurance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// AI Conversation Insert Schemas
export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationMessageSchema = createInsertSchema(conversationMessages).omit({
  id: true,
  createdAt: true,
});

export const insertResearchFindingSchema = createInsertSchema(researchFindings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHistoricalBidSchema = createInsertSchema(historicalBids).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Portal = typeof portals.$inferSelect;
export type InsertPortal = z.infer<typeof insertPortalSchema>;

export type RFP = typeof rfps.$inferSelect;
export type InsertRFP = z.infer<typeof insertRfpSchema>;

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = z.infer<typeof insertProposalSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;

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
export type InsertCompanyIdentifier = z.infer<typeof insertCompanyIdentifierSchema>;

export type CompanyCertification = typeof companyCertifications.$inferSelect;
export type InsertCompanyCertification = z.infer<typeof insertCompanyCertificationSchema>;

export type CompanyInsurance = typeof companyInsurance.$inferSelect;
export type InsertCompanyInsurance = z.infer<typeof insertCompanyInsuranceSchema>;

// AI Conversation Types
export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;

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
