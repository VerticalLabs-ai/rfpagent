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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rfps = pgTable("rfps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  agency: text("agency").notNull(),
  portalId: varchar("portal_id").references(() => portals.id).notNull(),
  sourceUrl: text("source_url").notNull(),
  deadline: timestamp("deadline"),
  estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("discovered"), // discovered, parsing, drafting, review, approved, submitted, closed
  progress: integer("progress").default(0).notNull(),
  requirements: jsonb("requirements"), // parsed requirements object
  complianceItems: jsonb("compliance_items"), // compliance checklist
  riskFlags: jsonb("risk_flags"), // high-risk items
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

// Relations
export const portalsRelations = relations(portals, ({ many }) => ({
  rfps: many(rfps),
  submissions: many(submissions),
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
