# Dynamic Confidence Scoring for RFP Opportunities

## Overview

The RFP Discovery workflow now uses a dynamic confidence calculation system to assess the quality and reliability of extracted RFP opportunities, replacing the previous hardcoded 0.9 confidence value.

## Implementation

### Location
- **File**: `src/mastra/workflows/rfp-discovery-workflow.ts`
- **Function**: `calculateConfidence()`
- **Lines**: 13-115

### Function Signature

```typescript
export function calculateConfidence(
  opportunity: {
    title?: string;
    description?: string;
    agency?: string;
    deadline?: string;
    estimatedValue?: string;
    url?: string;
    category?: string;
  },
  extractionMetadata?: {
    confidence?: number;
    extractionQuality?: number;
  }
): number
```

## Scoring Algorithm

### Base Score
- Starts at **0.5** (50% confidence)

### Field Weights

#### Critical Fields
- **Title** (required): +0.20
  - Bonus for descriptive titles (>20 chars): +0.05
  - Missing title penalty: -0.30

#### Important Fields
- **URL** (validated): +0.15
  - Invalid URL penalty: -0.05
- **Deadline** (parseable date): +0.10
  - Future deadline bonus: +0.05
  - Invalid date penalty: -0.03

#### Supporting Fields
- **Agency**: +0.08
- **Description**: +0.05
  - Detailed description bonus (>100 chars): +0.03
- **Category**: +0.04
- **Estimated Value**: +0.04

### Extraction Metadata Integration

When extraction tool provides metadata:

1. **Tool Confidence** (20% weight):
   ```
   score = score * 0.8 + metadata.confidence * 0.2
   ```

2. **Extraction Quality** (10% weight):
   ```
   score = score * 0.9 + metadata.extractionQuality * 0.1
   ```

### Final Clamping
Result is clamped to valid range: **[0.0, 1.0]**

## Example Scores

### Complete, High-Quality Opportunity
```typescript
{
  title: "Cloud Infrastructure Modernization Services",
  description: "Detailed 200+ char description...",
  agency: "Department of Veterans Affairs",
  deadline: "2025-11-15T00:00:00.000Z", // future date
  estimatedValue: "$5,000,000 - $10,000,000",
  url: "https://sam.gov/opp/abc123",
  category: "IT Services"
}
// Result: 1.0 (100%)
```

### Minimal but Valid Opportunity
```typescript
{
  title: "RFP #2024-001",
  url: "https://portal.example.com/rfp/2024-001"
}
// Result: 0.85 (85%)
```

### Low-Quality Extraction
```typescript
{
  title: "Untitled",
  description: "N/A"
}
// With low metadata.confidence (0.4) and quality (0.3)
// Result: 0.642 (64.2%)
```

### Missing Critical Fields
```typescript
{
  description: "Test description",
  agency: "Test Agency"
  // Missing title
}
// Result: 0.33 (33%)
```

## Usage in Workflow

The function is called during opportunity extraction at line 243-248:

```typescript
const opportunities = (extractionResult.data?.opportunities || []).map(
  (opp: any) => ({
    ...opp,
    portalId: portal.id,
    confidence: calculateConfidence(opp, {
      confidence: extractionResult.confidence,
      extractionQuality: extractionResult.quality,
    }),
  })
);
```

## Testing

Comprehensive test suite with 31 test cases covering:
- Base scoring and field weighting
- URL validation
- Deadline validation (date parsing and future/past)
- Supporting field scoring
- Extraction metadata integration
- Edge cases and boundary conditions
- Realistic scenarios

**Test File**: `tests/calculateConfidence.test.ts`

**Run tests**:
```bash
NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest tests/calculateConfidence.test.ts
```

## Benefits

1. **Quality-based scoring**: Opportunities with more complete information score higher
2. **Validation**: URLs and dates are validated, not just checked for presence
3. **Extensible**: Easy to add new fields or adjust weights
4. **Metadata integration**: Leverages extraction tool confidence when available
5. **Testable**: Pure function with comprehensive test coverage
6. **Transparent**: Clear scoring algorithm that can be explained to users

## Future Enhancements

Potential improvements to consider:

1. **Machine learning**: Train a model on historical RFP quality vs. win rate
2. **Domain-specific weights**: Adjust weights based on portal type or industry
3. **Text analysis**: Use NLP to assess title/description quality
4. **Historical data**: Factor in portal reliability and past extraction success
5. **User feedback**: Allow users to rate extractions and adjust weights accordingly
