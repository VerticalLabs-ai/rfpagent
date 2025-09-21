// Export all Browserbase/Stagehand tools
export { pageNavigateTool } from './page-navigate-tool';
export { pageObserveTool } from './page-observe-tool';
export { pageActTool } from './page-act-tool';
export { pageExtractTool } from './page-extract-tool';
export { pageAuthTool } from './page-auth-tool';

// Export session manager
export { sessionManager } from './session-manager';

// Re-export legacy tools for backward compatibility
export {
  pageActTool as stagehandActTool,
  pageObserveTool as stagehandObserveTool, 
  pageExtractTool as stagehandExtractTool,
  pageAuthTool as stagehandAuthTool
} from './index';