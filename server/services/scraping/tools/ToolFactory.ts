import { createTool, type ToolExecutionContext } from '@mastra/core/tools';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import {
  stagehandActTool,
  stagehandExtractTool,
  stagehandAuthTool,
} from '../../../../src/mastra/tools';

const opportunitySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  agency: z.string().optional(),
  deadline: z.string().optional(),
  estimatedValue: z.string().optional(),
  url: z.string().optional(),
  category: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});

type Opportunity = z.infer<typeof opportunitySchema>;

const stagehandExtractionDataSchema = z.object({
  opportunities: z.array(opportunitySchema),
});

const authExecutionResultSchema = z.object({
  success: z.boolean().optional(),
  sessionId: z.string().optional(),
  message: z.string().optional(),
  cookies: z.string().optional(),
  authToken: z.string().optional(),
});

const navigationExecutionResultSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  currentUrl: z.string().optional(),
  actionedAt: z.string().optional(),
});

function withRuntimeContext<TSchema extends z.ZodSchema | undefined>(
  schema: TSchema,
  data: TSchema extends z.ZodSchema ? z.infer<TSchema> : Record<string, never>
): ToolExecutionContext<TSchema> {
  const parsedContext = schema
    ? (schema.parse(data) as z.infer<Exclude<TSchema, undefined>>)
    : (data as Record<string, never>);

  return {
    context: parsedContext as TSchema extends z.ZodSchema
      ? z.infer<TSchema>
      : Record<string, never>,
    runtimeContext: new RuntimeContext(),
  } as ToolExecutionContext<TSchema>;
}

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
        content: z.string().describe('HTML content retrieved by the crawler'),
        portalType: z.string().describe('Type of portal being scraped'),
        searchFilter: z.string().optional().describe('Optional search filter to bias extraction'),
      }),
      outputSchema: z.object({
        opportunities: z.array(opportunitySchema),
        totalFound: z.number(),
        extractedAt: z.string(),
      }),
      execute: async ({ context }) => {
        const { portalType, searchFilter } = context;

        const instruction = searchFilter
          ? `Extract RFP opportunities related to "${searchFilter}" including titles, deadlines, agencies, descriptions, and links.`
          : `Extract all RFP opportunities, procurement notices, and solicitations relevant to the ${portalType} portal.`;

        const { execute, inputSchema } = stagehandExtractTool;
        if (typeof execute !== 'function' || !inputSchema) {
          throw new Error('Stagehand extraction tool is not initialized');
        }

        const extraction = await execute(
          withRuntimeContext(inputSchema, {
            instruction,
            schema: stagehandExtractionDataSchema.shape,
          })
        );

        const parsedData = stagehandExtractionDataSchema.safeParse(
          (extraction as { data?: unknown }).data
        );

        const opportunities: Opportunity[] = parsedData.success
          ? parsedData.data.opportunities
          : [];

        const extractedAt =
          (extraction as { extractedAt?: string }).extractedAt ??
          new Date().toISOString();

        return {
          opportunities,
          totalFound: opportunities.length,
          extractedAt,
        };
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
      execute: async ({ context }) => {
        const { loginUrl, username, password, portalType, sessionId } = context;

        try {
          const { execute, inputSchema } = stagehandAuthTool;
          if (typeof execute !== 'function' || !inputSchema) {
            throw new Error('Stagehand authentication tool is not initialized');
          }

          const result = await execute(
            withRuntimeContext(inputSchema, {
              loginUrl,
              username,
              password,
              targetUrl: loginUrl,
              sessionId: sessionId ?? 'default',
              portalType,
            })
          );

          const parsed = authExecutionResultSchema.parse(result);

          return {
            success: parsed.success ?? true,
            sessionId: parsed.sessionId ?? sessionId,
            message: parsed.message,
            cookies: parsed.cookies,
            authToken: parsed.authToken,
          };
        } catch (error) {
          return {
            success: false,
            sessionId,
            message:
              error instanceof Error
                ? error.message
                : 'Portal authentication failed',
            cookies: undefined,
            authToken: undefined,
          };
        }
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
      execute: async ({ context }) => {
        const { action, target, sessionId } = context;

        try {
          const { execute, inputSchema } = stagehandActTool;
          if (typeof execute !== 'function' || !inputSchema) {
            throw new Error('Stagehand navigation tool is not initialized');
          }

          const result = await execute(
            withRuntimeContext(inputSchema, {
              action,
              url: target,
              sessionId: sessionId ?? 'default',
            })
          );

          const parsed = navigationExecutionResultSchema.parse(result);

          return {
            success: parsed.success ?? true,
            result: {
              currentUrl: parsed.currentUrl,
              actionedAt: parsed.actionedAt,
            },
            message: parsed.message,
          };
        } catch (error) {
          return {
            success: false,
            result: undefined,
            message:
              error instanceof Error
                ? error.message
                : 'Portal navigation failed',
          };
        }
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
      execute: async ({ context }) => {
        const { url, filename } = context;
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
      execute: async ({ context }) => {
        const { content, portalType, minOpportunities = 1 } = context;
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
          const hasDeadlines = content.some(item => {
            if (item && typeof item === 'object') {
              const candidate = item as { deadline?: unknown };
              return typeof candidate.deadline === 'string' && candidate.deadline.length > 0;
            }
            return false;
          });
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
