/**
 * Feature flags for gradual rollout of agent architecture enhancements
 *
 * Enable/disable features via environment variables for safe deployment:
 * - USE_AGENT_REGISTRY=true/false
 * - USE_AGENT_POOLS=true/false
 * - USE_WORKFLOW_VALIDATION=true/false
 * - USE_ENHANCED_COORDINATION=true/false
 *
 * @example
 * ```bash
 * # Enable all features
 * export USE_AGENT_REGISTRY=true
 * export USE_AGENT_POOLS=true
 * export USE_WORKFLOW_VALIDATION=true
 * export USE_ENHANCED_COORDINATION=true
 *
 * # Emergency rollback - disable all features
 * export USE_AGENT_REGISTRY=false
 * export USE_AGENT_POOLS=false
 * export USE_WORKFLOW_VALIDATION=false
 * export USE_ENHANCED_COORDINATION=false
 * ```
 */

const parseEnvBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

export const featureFlags = {
  /**
   * Phase 1: Enable Agent Registry system
   * - Centralized agent management
   * - Metadata-driven agent discovery
   * - Hierarchy queries
   */
  useAgentRegistry: parseEnvBoolean(
    process.env.USE_AGENT_REGISTRY,
    false // Disabled by default until Phase 1 testing complete
  ),

  /**
   * Phase 2: Enable Agent Pools
   * - Dynamic agent pooling
   * - Auto-scaling based on demand
   * - Load balancing strategies
   */
  useAgentPools: parseEnvBoolean(
    process.env.USE_AGENT_POOLS,
    false // Disabled by default until Phase 2 testing complete
  ),

  /**
   * Phase 3: Enable Workflow Validation
   * - Pre-flight agent validation
   * - Dependency checking
   * - Health scoring
   */
  useWorkflowValidation: parseEnvBoolean(
    process.env.USE_WORKFLOW_VALIDATION,
    false // Disabled by default until Phase 3 testing complete
  ),

  /**
   * Phase 4: Enable Enhanced Coordination
   * - Pool-aware delegation
   * - Capability-based agent selection
   * - Contract enforcement
   */
  useEnhancedCoordination: parseEnvBoolean(
    process.env.USE_ENHANCED_COORDINATION,
    false // Disabled by default until Phase 4 testing complete
  ),

  /**
   * Phase 5: Enable Sub-Agent Patterns
   * - Tier 4+ support
   * - Sub-specialist delegation
   * - Multi-level hierarchy
   */
  useSubAgentPatterns: parseEnvBoolean(
    process.env.USE_SUB_AGENT_PATTERNS,
    false // Disabled by default until Phase 5 testing complete
  ),

  /**
   * Phase 6: Enable Monitoring & Observability
   * - Agent health dashboard
   * - Workflow execution tracing
   * - Performance metrics
   */
  useMonitoring: parseEnvBoolean(
    process.env.USE_MONITORING,
    false // Disabled by default until Phase 6 testing complete
  ),

  /**
   * Development mode: Enable all features for testing
   * Set NODE_ENV=development to enable
   */
  isDevelopment: process.env.NODE_ENV === 'development',

  /**
   * Enable verbose logging for registry operations
   */
  verboseRegistryLogging: parseEnvBoolean(
    process.env.VERBOSE_REGISTRY_LOGGING,
    false
  ),
} as const;

/**
 * Check if any enhanced features are enabled
 */
export const hasAnyEnhancedFeatures = (): boolean => {
  return (
    featureFlags.useAgentRegistry ||
    featureFlags.useAgentPools ||
    featureFlags.useWorkflowValidation ||
    featureFlags.useEnhancedCoordination ||
    featureFlags.useSubAgentPatterns ||
    featureFlags.useMonitoring
  );
};

/**
 * Get a human-readable status of all feature flags
 */
export const getFeatureFlagStatus = (): Record<string, boolean> => {
  return {
    'Agent Registry': featureFlags.useAgentRegistry,
    'Agent Pools': featureFlags.useAgentPools,
    'Workflow Validation': featureFlags.useWorkflowValidation,
    'Enhanced Coordination': featureFlags.useEnhancedCoordination,
    'Sub-Agent Patterns': featureFlags.useSubAgentPatterns,
    'Monitoring': featureFlags.useMonitoring,
    'Development Mode': featureFlags.isDevelopment,
  };
};

/**
 * Log current feature flag status (useful for debugging)
 */
export const logFeatureFlags = (logger?: { info: (msg: string) => void }): void => {
  const status = getFeatureFlagStatus();
  const message = `Feature Flags: ${JSON.stringify(status, null, 2)}`;

  if (logger) {
    logger.info(message);
  } else {
    console.log(message);
  }
};
