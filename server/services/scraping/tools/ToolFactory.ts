import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  stagehandActTool,
  stagehandExtractTool,
  stagehandAuthTool,
} from '../../../../src/mastra/tools';

/**
 * Factory for creating standardized tools for the scraping service
 */
export class ToolFactory {
  /**
   * Create extraction tool with standard schema
   */
  static createExtractionTool() {
    return createTool({
      id: 'rfp-extraction-tool',
      description: 'Extract RFP opportunities from web content',
      inputSchema: z.object({
        content: z.string().describe('HTML content to extract from'),
        portalType: z.string().describe('Type of portal being scraped'),
        searchFilter: z.string().optional().describe('Optional search filter'),
      }),
      outputSchema: z.object({
        opportunities: z.array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            agency: z.string().optional(),
            deadline: z.string().optional(),
            estimatedValue: z.string().optional(),
            url: z.string().optional(),
            category: z.string().optional(),
            confidence: z.number().min(0).max(1).default(0.5),
          })
        ),
        totalFound: z.number(),
        extractedAt: z.string(),
      }),
      execute: async ({ content, portalType, searchFilter }) => {
        // Delegate to the existing stagehand extraction tool
        return await stagehandExtractTool.execute({
          context: {
            instruction: searchFilter
              ? `find and extract RFP opportunities related to "${searchFilter}" including titles, deadlines, agencies, descriptions, and links`
              : 'extract all RFP opportunities, procurement notices, and solicitations with their complete details',
            schema: {
              opportunities: z.array(
                z.object({
                  title: z.string().describe('RFP title or opportunity name'),
                  description: z
                    .string()
                    .optional()
                    .describe('Description or summary'),
                  agency: z.string().optional().describe('Issuing agency'),
                  deadline: z
                    .string()
                    .optional()
                    .describe('Submission deadline'),
                  estimatedValue: z
                    .string()
                    .optional()
                    .describe('Contract value'),
                  url: z
                    .string()
                    .optional()
                    .describe('Direct URL to opportunity'),
                  category: z.string().optional().describe('Category or type'),
                  confidence: z.number().min(0).max(1).default(0.5),
                })
              ),
            },
          },
        });
      },
    });
  }

  /**
   * Create authentication tool with standardized interface
   */
  static createAuthenticationTool() {
    return createTool({
      id: 'portal-authentication-tool',
      description: 'Authenticate with portal login systems',
      inputSchema: z.object({
        loginUrl: z.string().url(),
        username: z.string(),
        password: z.string(),
        portalType: z.string(),
        sessionId: z.string().optional(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        sessionId: z.string().optional(),
        message: z.string().optional(),
        cookies: z.string().optional(),
        authToken: z.string().optional(),
      }),
      execute: async ({
        loginUrl,
        username,
        password,
        portalType,
        sessionId,
      }) => {
        return await stagehandAuthTool.execute({
          context: {
            loginUrl,
            username,
            password,
            targetUrl: loginUrl,
            sessionId: sessionId || 'default',
            portalType,
          },
        });
      },
    });
  }

  /**
   * Create navigation tool for portal interactions
   */
  static createNavigationTool() {
    return createTool({
      id: 'portal-navigation-tool',
      description: 'Navigate portal pages and interact with elements',
      inputSchema: z.object({
        action: z.string().describe('Action to perform'),
        target: z.string().optional().describe('Target element or URL'),
        sessionId: z.string().optional(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        result: z.any().optional(),
        message: z.string().optional(),
      }),
      execute: async ({ action, target, sessionId }) => {
        return await stagehandActTool.execute({
          context: {
            action,
            target,
            sessionId: sessionId || 'default',
          },
        });
      },
    });
  }

  /**
   * Create document download tool
   */
  static createDocumentDownloadTool() {
    return createTool({
      id: 'document-download-tool',
      description: 'Download documents from portal URLs',
      inputSchema: z.object({
        url: z.string().url(),
        filename: z.string().optional(),
        sessionId: z.string().optional(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        filePath: z.string().optional(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        error: z.string().optional(),
      }),
      execute: async ({ url, filename, sessionId }) => {
        try {
          // This would integrate with the actual download service
          // For now, return a placeholder implementation
          console.log(`📥 Downloading document from ${url}`);

          return {
            success: true,
            filePath: filename || `document_${Date.now()}.pdf`,
            fileSize: 0,
            mimeType: 'application/pdf',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Download failed',
          };
        }
      },
    });
  }

  /**
   * Create content validation tool
   */
  static createContentValidationTool() {
    return createTool({
      id: 'content-validation-tool',
      description: 'Validate extracted content quality and completeness',
      inputSchema: z.object({
        content: z.any().describe('Content to validate'),
        portalType: z.string().describe('Portal type for validation rules'),
        minOpportunities: z.number().optional().default(1),
      }),
      outputSchema: z.object({
        isValid: z.boolean(),
        score: z.number().min(0).max(1),
        issues: z.array(z.string()),
        suggestions: z.array(z.string()),
      }),
      execute: async ({ content, portalType, minOpportunities }) => {
        const issues: string[] = [];
        const suggestions: string[] = [];
        let score = 1.0;

        // Basic validation logic
        if (!content || (Array.isArray(content) && content.length === 0)) {
          issues.push('No content found');
          score -= 0.5;
        }

        if (Array.isArray(content) && content.length < minOpportunities) {
          issues.push(
            `Found ${content.length} opportunities, expected at least ${minOpportunities}`
          );
          score -= 0.2;
        }

        // Portal-specific validation
        if (portalType === 'bonfire_hub' && Array.isArray(content)) {
          const hasDeadlines = content.some((opp: any) => opp.deadline);
          if (!hasDeadlines) {
            suggestions.push(
              'Consider extracting deadline information for Bonfire opportunities'
            );
            score -= 0.1;
          }
        }

        return {
          isValid: score > 0.5,
          score: Math.max(0, score),
          issues,
          suggestions,
        };
      },
    });
  }

  /**
   * Get all available tools
   */
  static getAllTools() {
    return {
      extraction: this.createExtractionTool(),
      authentication: this.createAuthenticationTool(),
      navigation: this.createNavigationTool(),
      documentDownload: this.createDocumentDownloadTool(),
      contentValidation: this.createContentValidationTool(),
    };
  }
}
