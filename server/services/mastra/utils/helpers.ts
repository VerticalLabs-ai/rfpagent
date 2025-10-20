/**
 * Helper utilities for Mastra Scraping Service
 */

import { z } from 'zod';

// Re-export schemas that helpers need
const OpportunitySchema = z.object({
  title: z.string(),
  description: z.string(),
  agency: z.string().optional(),
  deadline: z.string().optional(),
  estimatedValue: z.string().optional(),
  url: z.string().url().optional(),
  link: z.string().url().optional(),
  category: z.string().optional(),
  confidence: z.number().min(0).max(1).optional().default(0.5),
});

const AgentResponseSchema = z
  .object({
    opportunities: z.array(OpportunitySchema).optional(),
    results: z.array(OpportunitySchema).optional(),
    status: z.string().optional(),
    error: z.string().optional(),
  })
  .or(OpportunitySchema);

/**
 * Detect file type from filename extension
 */
export function detectFileType(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop();
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'doc';
    case 'xls':
    case 'xlsx':
      return 'excel';
    case 'ppt':
    case 'pptx':
      return 'powerpoint';
    case 'txt':
      return 'txt';
    case 'rtf':
      return 'rtf';
    default:
      return 'unknown';
  }
}

/**
 * Parse agent response and extract opportunities
 */
export function parseAgentResponse(
  response: string,
  extractJsonBlocks: (text: string) => string[]
): any[] {
  try {
    console.log('🤖 Parsing AI agent response...');
    console.log(`📝 Agent response length: ${response.length} characters`);

    // First, try to extract JSON blocks from the response
    const jsonBlocks = extractJsonBlocks(response);
    console.log(`🔍 Found ${jsonBlocks.length} JSON blocks in response`);

    for (const jsonBlock of jsonBlocks) {
      try {
        const parsedData = JSON.parse(jsonBlock);

        // Validate against our schema
        const validationResult = AgentResponseSchema.safeParse(parsedData);

        if (validationResult.success) {
          const data = validationResult.data;

          // Handle different response formats
          if ('opportunities' in data && Array.isArray(data.opportunities)) {
            return data.opportunities;
          }
          if ('results' in data && Array.isArray(data.results)) {
            return data.results;
          }
          // Single opportunity object
          if ('title' in data) {
            return [data];
          }
        } else {
          console.warn(
            'JSON validation failed:',
            validationResult.error.issues
          );
        }
      } catch (parseError) {
        console.warn('Failed to parse JSON block:', parseError);
        continue;
      }
    }

    console.warn('No valid JSON opportunities found in agent response');
    console.log(
      `🚨 Agent response (first 1000 chars):`,
      response.substring(0, 1000)
    );
    return [];
  } catch (error) {
    console.error('Error parsing agent response:', error);
    return [];
  }
}

/**
 * Extract RFP ID from opportunity
 */
export function extractRFPId(opportunity: any): string | null {
  // Try various field names that might contain RFP ID
  return (
    opportunity.rfpId ||
    opportunity.rfpNumber ||
    opportunity.opportunityId ||
    opportunity.referenceNumber ||
    opportunity.id ||
    null
  );
}

/**
 * Extract solicitation ID from opportunity
 */
export function extractSolicitationId(opportunity: any): string | null {
  // Try various field names for solicitation ID
  return (
    opportunity.solicitationId ||
    opportunity.solicitationNumber ||
    opportunity.noticeId ||
    extractRFPId(opportunity)
  );
}

/**
 * Redact sensitive information from cookie strings
 */
export function redactSensitiveCookies(cookies: string | null): string {
  if (!cookies) return '(no cookies)';
  return cookies.replace(/([^;=]+)=([^;]+)/g, (_, key, value) => {
    if (
      key.toLowerCase().includes('session') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('auth')
    ) {
      return `${key}=[REDACTED]`;
    }
    return `${key}=${value.substring(0, 20)}...`;
  });
}
