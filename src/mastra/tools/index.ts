// Export all Browserbase/Stagehand tools
export { pageActTool } from './page-act-tool';
export { pageAuthTool } from './page-auth-tool';
export { pageExtractTool } from './page-extract-tool';
export { pageNavigateTool } from './page-navigate-tool';
export { pageObserveTool } from './page-observe-tool';

// Export session manager and shared memory
export { sessionManager } from './session-manager';
export { memoryProvider, sharedMemory } from './shared-memory-provider';

// Re-export with legacy names for backward compatibility
export { pageActTool as stagehandActTool } from './page-act-tool';
export { pageAuthTool as stagehandAuthTool } from './page-auth-tool';
export { pageExtractTool as stagehandExtractTool } from './page-extract-tool';
export { pageObserveTool as stagehandObserveTool } from './page-observe-tool';
