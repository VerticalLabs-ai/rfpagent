export function extractSaflaStrategyDetails(
  inputs: Record<string, any> | null | undefined
): {
  strategy: Record<string, any> | null;
  metadata: Record<string, any> | null;
} {
  if (!inputs || typeof inputs !== 'object') {
    return { strategy: null, metadata: null };
}

  const { saflaStrategy, saflaStrategyMetadata } = inputs as {
    saflaStrategy?: Record<string, any>;
    saflaStrategyMetadata?: Record<string, any>;
  };

  return {
    strategy:
      saflaStrategy && typeof saflaStrategy === 'object'
        ? saflaStrategy
        : null,
    metadata:
      saflaStrategyMetadata && typeof saflaStrategyMetadata === 'object'
        ? saflaStrategyMetadata
        : null,
  };
}

