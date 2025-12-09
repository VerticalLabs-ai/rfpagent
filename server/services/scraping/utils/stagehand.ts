import { RuntimeContext } from '@mastra/core/runtime-context';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { z } from 'zod';

type StagehandTool<TSchema extends z.ZodTypeAny> = {
  inputSchema?: TSchema;
  execute?: (context: ToolExecutionContext<TSchema>) => Promise<unknown>;
};

export const StagehandAuthResultSchema = z
  .object({
    success: z.boolean().optional(),
    sessionId: z.string().optional(),
    message: z.string().optional(),
    cookies: z.string().optional(),
    authToken: z.string().optional(),
    currentUrl: z.string().optional(),
  })
  .passthrough();

export const StagehandOpportunitySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    agency: z.string().optional(),
    deadline: z.string().optional(),
    estimatedValue: z.string().optional(),
    url: z.string().optional(),
    link: z.string().optional(),
    category: z.string().optional(),
    confidence: z.number().optional(),
  })
  .passthrough();

export const StagehandExtractionResultSchema = z
  .object({
    data: z
      .union([
        z.object({
          opportunities: z.array(StagehandOpportunitySchema).optional(),
          fullContent: z.string().optional(),
          pageTitle: z.string().optional(),
        }),
        z.string(), // Allow string for raw text extraction
      ])
      .optional(),
    opportunities: z.array(StagehandOpportunitySchema).optional(),
    status: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
    currentUrl: z.string().optional(),
    pageTitle: z.string().optional(),
  })
  .passthrough();

export const StagehandActionResultSchema = z
  .object({
    success: z.boolean().optional(),
    message: z.string().optional(),
    currentUrl: z.string().optional(),
    actionedAt: z.string().optional(),
  })
  .passthrough();

function buildContext<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  payload: z.infer<TSchema>
): ToolExecutionContext<TSchema> {
  const parsedContext = schema.parse(payload);
  return {
    context: parsedContext,
    runtimeContext: new RuntimeContext(),
  } as ToolExecutionContext<TSchema>;
}

/**
 * Default timeout for Stagehand tool execution (2 minutes)
 */
const DEFAULT_STAGEHAND_TIMEOUT = 120000;

/**
 * Execute a Stagehand tool with timeout protection
 */
export async function executeStagehandTool<
  TSchema extends z.ZodTypeAny,
  TResult,
>(
  tool: StagehandTool<TSchema>,
  params: z.infer<TSchema>,
  resultSchema?: z.ZodType<TResult>,
  timeoutMs: number = DEFAULT_STAGEHAND_TIMEOUT
): Promise<TResult> {
  const { inputSchema, execute } = tool;
  if (!inputSchema || typeof execute !== 'function') {
    throw new Error('Stagehand tool is not initialized');
  }

  const context = buildContext(inputSchema, params);

  // Execute with timeout protection
  const rawResult = await Promise.race([
    execute(context),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`Stagehand tool timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);

  return resultSchema ? resultSchema.parse(rawResult) : (rawResult as TResult);
}
