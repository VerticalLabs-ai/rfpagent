import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, jsonb, boolean, integer } from "drizzle-orm/pg-core";
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
