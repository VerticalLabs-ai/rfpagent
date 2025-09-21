// Export all Browserbase/Stagehand tools
export { pageNavigateTool } from './page-navigate-tool';
export { pageObserveTool } from './page-observe-tool';
export { pageActTool } from './page-act-tool';
export { pageExtractTool } from './page-extract-tool';
export { pageAuthTool } from './page-auth-tool';

// Export session manager
export { sessionManager } from './session-manager';

// Re-export with legacy names for backward compatibility
export { pageActTool as stagehandActTool } from './page-act-tool';
export { pageObserveTool as stagehandObserveTool } from './page-observe-tool';
export { pageExtractTool as stagehandExtractTool } from './page-extract-tool';
export { pageAuthTool as stagehandAuthTool } from './page-auth-tool';