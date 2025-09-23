import type { Portal } from "@shared/schema";

// Core types for the scraping service architecture
export interface ScrapingContext {
  url: string;
  portalType: string;
  sessionId?: string;
  searchFilter?: string;
  loginRequired?: boolean;
  credentials?: {
    username: string;
    password: string;
  };
}

export interface AuthContext {
  portalUrl: string;
  username: string;
  password: string;
  sessionId: string;
  portalType?: string;
  authContext?: string;
}

export interface AuthResult {
  success: boolean;
  sessionId: string;
  error?: string;
  cookies?: string;
  authToken?: string;
}

export interface ExtractedContent {
  content: string;
  opportunities: RFPOpportunity[];
  error?: string;
}

export interface RFPOpportunity {
  title: string;
  description: string;
  agency?: string;
  deadline?: string;
  estimatedValue?: string;
  url?: string;
  link?: string;
  category?: string;
  confidence?: number;
}

export interface RFPData {
  opportunities: RFPOpportunity[];
  portalContext: string;
  extractedAt: Date;
}

export interface BrowserSession {
  id: string;
  portalType: string;
  cookies?: string;
  authToken?: string;
  isAuthenticated: boolean;
  createdAt: Date;
  lastUsed: Date;
}

export interface AgentConfig {
  name: string;
  instructions: string;
  portalType: string;
  tools: string[];
}

export interface Credentials {
  username: string;
  password: string;
}

export interface PortalConfiguration {
  type: string;
  selectors: {
    loginForm?: string;
    usernameField?: string;
    passwordField?: string;
    opportunityList?: string;
    opportunityItem?: string;
  };
  authRequired: boolean;
  baseUrl: string;
}

// Strategy interfaces
export interface AuthenticationStrategy {
  authenticate(context: AuthContext): Promise<AuthResult>;
  validateCredentials(credentials: Credentials): boolean;
  getPortalType(): string;
}

export interface ContentExtractor {
  extract(content: string, url: string, portalContext: string): Promise<RFPOpportunity[]>;
  getPortalType(): string;
  validateContent(content: string): boolean;
}

// Service result types
export interface ScrapingResult {
  success: boolean;
  opportunities: RFPOpportunity[];
  documentsCount?: number;
  error?: string;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  portalType?: string;
  error?: string;
}

// Error types
export class ScrapingError extends Error {
  constructor(
    message: string,
    public code: string,
    public portalType?: string,
    public sessionId?: string
  ) {
    super(message);
    this.name = 'ScrapingError';
  }
}

export class AuthenticationError extends ScrapingError {
  constructor(message: string, portalType?: string) {
    super(message, 'AUTH_ERROR', portalType);
    this.name = 'AuthenticationError';
  }
}

export class ExtractionError extends ScrapingError {
  constructor(message: string, portalType?: string) {
    super(message, 'EXTRACTION_ERROR', portalType);
    this.name = 'ExtractionError';
  }
}

// Content processing types
export interface ContentProcessingResult {
  success: boolean;
  opportunities: RFPOpportunity[];
  extractorsUsed: string[];
  analysis: ContentAnalysis;
  processingTime: number;
  avgConfidence?: number;
  errors?: string[];
  error?: string;
}

export interface ContentAnalysis {
  contentType: 'html' | 'json' | 'text' | 'unknown';
  size: number;
  hasHTML: boolean;
  hasJSON: boolean;
  hasRFPKeywords: boolean;
  portalSpecificIndicators: {
    indicators: string[];
    score: number;
  };
  confidence: number;
  recommendedExtractors: string[];
}