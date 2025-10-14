# Memory Merge Optimization

**Last Updated**: October 2025

## Overview

Enhanced the `mergeSimilarMemories` method in `persistentMemoryEngine.ts` to prevent unbounded O(n²) loops and improve performance through configurable safety guards and intelligent candidate sampling.

## Problem Statement

The original implementation had an unbounded `while` loop with O(n²) pairwise comparisons that could:
- Run indefinitely on large memory sets
- Cause performance degradation
- Lack observability during long-running operations
- Use hardcoded similarity threshold (0.85)

## Implementation

### 1. Configurable Parameters

Added class-level configuration properties:

```typescript
// Memory merging configuration
private memorySimilarityThreshold: number = 0.85; // Configurable similarity threshold
private mergeMaxIterations: number = 1000; // Maximum iterations guard
private mergeTimeoutMs: number = 60000; // 60 seconds timeout
private mergeProgressLogInterval: number = 50; // Log every N merges
private mergeMaxCandidatesPerPrimary: number = 100; // Limit comparisons per primary
```

**Benefits**:
- Threshold now configurable via class property instead of hardcoded
- Can be adjusted per environment or use case
- Clear defaults with inline documentation

### 2. Method Signature Enhancement

```typescript
private async mergeSimilarMemories(
  targetCount: number,
  similarityThreshold: number = this.memorySimilarityThreshold
): Promise<number>
```

**Changes**:
- Added optional `similarityThreshold` parameter (defaults to class config)
- Allows per-call customization if needed
- Maintains backward compatibility

### 3. Operational Safety Guards

#### Iteration Limit Guard
```typescript
if (iterations >= this.mergeMaxIterations) {
  console.warn(
    `⚠️ Merge stopped: reached max iterations (${this.mergeMaxIterations}). Merged ${mergedCount}/${targetCount}`
  );
  break;
}
```

#### Timeout Guard
```typescript
const elapsed = Date.now() - startTime;
if (elapsed >= this.mergeTimeoutMs) {
  console.warn(
    `⚠️ Merge stopped: timeout (${elapsed}ms). Merged ${mergedCount}/${targetCount}`
  );
  break;
}
```

**Benefits**:
- Prevents runaway loops
- Provides clear diagnostics when limits are hit
- Ensures system remains responsive

### 4. Performance Optimization - Candidate Prefiltering

#### Stratified Sampling
```typescript
// Prefiltering: sample candidates if we have too many
const candidateIds =
  ids.length > this.mergeMaxCandidatesPerPrimary * 2
    ? this.sampleCandidates(ids, this.mergeMaxCandidatesPerPrimary * 2)
    : ids;
```

#### Sample Candidates Method
```typescript
private sampleCandidates(ids: string[], sampleSize: number): string[] {
  if (ids.length <= sampleSize) return ids;

  // Stratified sampling: take every nth element to maintain diversity
  const step = ids.length / sampleSize;
  const sampled: string[] = [];

  for (let i = 0; i < sampleSize; i++) {
    const index = Math.floor(i * step);
    sampled.push(ids[index]);
  }

  return sampled;
}
```

**Benefits**:
- Reduces O(n²) comparisons from potentially 250,000 to ~5,000 for 500 memories
- Maintains diversity through stratified sampling
- Only applies when candidate count exceeds threshold

#### Limited Comparisons Per Primary
```typescript
const maxJ = Math.min(
  candidateIds.length,
  i + 1 + this.mergeMaxCandidatesPerPrimary
);

for (let j = i + 1; j < maxJ; j++) {
  // ... comparison logic
}
```

**Benefits**:
- Caps comparisons per primary memory to prevent excessive computation
- Ensures consistent performance regardless of memory count

### 5. Progress Logging

```typescript
if (mergedCount > 0 && mergedCount % this.mergeProgressLogInterval === 0) {
  const elapsed = Date.now() - startTime;
  console.log(
    `📊 Merge progress: ${mergedCount}/${targetCount} merged, iteration ${iterations}, elapsed ${elapsed}ms`
  );
}
```

**Benefits**:
- Provides visibility into long-running operations
- Helps diagnose performance issues
- Enables monitoring and alerting

### 6. Summary Logging

```typescript
const totalElapsed = Date.now() - startTime;
console.log(
  `✅ Memory merge complete: ${mergedCount}/${targetCount} merged in ${iterations} iterations, ${totalElapsed}ms`
);
```

## Performance Improvements

### Comparison Count Reduction

**Before**:
- 500 memories: 124,750 comparisons (500 × 499 / 2)
- Unbounded iterations

**After**:
- 500 memories with sampling: ~4,950 comparisons (100 × 99 / 2)
- **96% reduction** in comparisons
- Maximum 1000 iterations guaranteed
- Maximum 60 second runtime guaranteed

### Time Complexity

| Scenario | Before | After |
|----------|--------|-------|
| Best case | O(n) | O(n) |
| Average case | O(n² × m) | O(s² × min(m, k)) |
| Worst case | O(n² × m) [unbounded] | O(s² × k) [bounded] |

Where:
- n = total memories
- m = merge iterations (unbounded before)
- s = sample size (max 200)
- k = max iterations (1000)

## Configuration Guidelines

### Default Values (Production)
```typescript
memorySimilarityThreshold: 0.85  // High precision
mergeMaxIterations: 1000          // Reasonable upper bound
mergeTimeoutMs: 60000            // 1 minute
mergeProgressLogInterval: 50      // Log every 50 merges
mergeMaxCandidatesPerPrimary: 100 // Balance quality vs performance
```

### High-Volume Scenarios
```typescript
memorySimilarityThreshold: 0.80   // Slightly lower for more merges
mergeMaxIterations: 500           // Lower bound
mergeTimeoutMs: 30000            // 30 seconds
mergeMaxCandidatesPerPrimary: 50  // Faster processing
```

### High-Precision Scenarios
```typescript
memorySimilarityThreshold: 0.90   // Very strict matching
mergeMaxIterations: 2000          // Allow more iterations
mergeTimeoutMs: 120000           // 2 minutes
mergeMaxCandidatesPerPrimary: 200 // More thorough comparison
```

## Testing

Test file location: `tests/memory-merge-enhancements.test.ts`

Covers:
- Configuration parameter validation
- Candidate sampling behavior
- Operational guard enforcement
- Performance optimization verification
- Integration scenarios

## Monitoring Recommendations

### Key Metrics to Track
1. **Merge completion rate**: `mergedCount / targetCount`
2. **Average merge duration**: Monitor `totalElapsed` from logs
3. **Guard triggers**: Count of timeout/iteration warnings
4. **Sample effectiveness**: Track merge quality with/without sampling

### Alert Thresholds
- Timeout warnings > 5% of runs: Reduce `mergeTimeoutMs` or increase resources
- Iteration limit hits > 10% of runs: Investigate similarity threshold or dataset characteristics
- Average duration > 30s: Consider more aggressive sampling

## Future Enhancements

1. **Adaptive Sampling**: Dynamically adjust sample size based on memory similarity distribution
2. **Clustering Pre-filter**: Use lightweight clustering (k-means) before similarity checks
3. **Parallel Processing**: Process independent merge candidates in parallel
4. **Similarity Index**: Pre-compute similarity matrix for frequently accessed memories
5. **Metrics Export**: Expose merge performance metrics via monitoring endpoint

## Related Documentation

- [Agent Architecture](./agents-architecture.md)
- [Memory Consolidation](./memory-consolidation.md)
- [Performance Optimization](../deployment/performance-tuning.md)

## References

- Original issue: Memory merge unbounded loop risk
- PR: Memory merge safety and performance enhancements
- Related: `server/services/learning/persistentMemoryEngine.ts:935-1223`
