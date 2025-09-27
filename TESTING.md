# Testing Guide for Proposal Generation System

This document describes how to test the proposal generation functionality without going through the full UI.

## Quick Tests

### 1. Simple Agent Connectivity Test

The fastest way to verify everything is working:

```bash
npm run test-agents
```

This tests:

- ✅ OpenAI API connectivity with gpt-5
- ✅ Mastra agent functionality (proposal-manager, content-generator, compliance-checker)
- ✅ Proposal generation workflow simulation
- ✅ Content extraction methods

**No database required** - runs in under 30 seconds.

### 2. Unit Tests (Jest)

```bash
npm test
# or for watch mode:
npm run test:watch
```

Comprehensive unit tests for the SubmissionMaterialsService with mocked dependencies.

### 3. Full Integration Tests

```bash
# Test with mock data (no database required)
npm run test-proposal

# Test with real database data
npm run test-proposal-real

# Test OpenAI fallback mechanism
npm run test-proposal-fallback
```

## Test Scripts Overview

### `test-agents-simple.ts`

- **Purpose**: Quick validation that core components work
- **Requirements**: Only needs OPENAI_API_KEY in .env
- **Runtime**: ~30 seconds
- **Use case**: Development validation, CI/CD checks

### `test-proposal-generation.ts`

- **Purpose**: Full end-to-end integration testing
- **Requirements**: Database connection + OPENAI_API_KEY
- **Runtime**: 2-5 minutes
- **Use case**: Thorough testing before deployment

### `submission-materials.test.ts`

- **Purpose**: Unit testing with mocked dependencies
- **Requirements**: Jest test framework
- **Runtime**: <10 seconds
- **Use case**: TDD development, regression testing

## Expected Output Examples

### Successful Agent Test

```
🚀 Simple Agent & Proposal Generation Tests

🔌 Testing OpenAI direct connection...
✅ OpenAI connection successful

🤖 Testing Mastra Agents...
✅ All agents imported successfully
✅ Proposal manager working
✅ Content generator working
✅ Compliance checker working

🔬 Testing proposal generation workflow simulation...
✅ Main proposal generated (8094 characters)
✅ Detailed content generated (15148 characters)
✅ Sections extracted

📊 Test Results:
✅ OpenAI Connection
✅ Mastra Agents
✅ Proposal Generation Workflow
Score: 3/3 tests passed
🎉 All core components are working!
```

### Sample Generated Content

The agents generate comprehensive proposal sections including:

**Executive Summary Example:**

```
iByte Enterprises LLC, a woman-owned business, proposes a secure,
scalable IT infrastructure services program to modernize and manage
your environment with proven cloud-native solutions...
```

**Technical Approach Example:**

```
Our approach delivers secure, low-risk cloud migration through a
phased, automated methodology: discovery/assessment, architecture
design, pilot implementation, and full deployment...
```

## Troubleshooting

### Common Issues

**1. OpenAI Connection Failed**

```bash
❌ OpenAI connection failed: 401 Unauthorized
```

- Check OPENAI_API_KEY in .env file
- Verify API key has sufficient credits
- Confirm gpt-5 model access

**2. Mastra Agents Failed**

```bash
❌ Proposal manager failed: Error: ...
```

- Check that gpt-5 model is available
- Verify network connectivity
- Check for rate limiting

**3. Database Connection Issues**

```bash
Error: DATABASE_URL must be set
```

- Only affects full integration tests
- Use `npm run test-agents` for quick testing
- Set DATABASE_URL in .env for full tests

### Debug Mode

Add debug logging to any test:

```typescript
console.log("🐛 Debug info:", JSON.stringify(data, null, 2))
```

## Integration with CI/CD

Recommended test pipeline:

```bash
# 1. Quick validation (30s)
npm run test-agents

# 2. Unit tests (10s)
npm test

# 3. Full integration (if database available)
npm run test-proposal
```

## Adding New Tests

### For New Agent Types

1. Add agent import to `test-agents-simple.ts`
2. Create test case following existing pattern
3. Add to results array

### For New Service Methods

1. Add unit test to `submission-materials.test.ts`
2. Mock dependencies as needed
3. Test both success and failure cases

### For New Workflows

1. Add integration test to `test-proposal-generation.ts`
2. Include mock data setup
3. Verify end-to-end functionality

## Performance Benchmarks

Expected performance on standard hardware:

- **Agent connectivity test**: 15-45 seconds
- **Unit tests**: 5-15 seconds
- **Full integration test**: 2-8 minutes

Longer times may indicate:

- Network latency to OpenAI API
- Rate limiting
- Database performance issues
- Large document processing

## Success Criteria

The proposal generation system is working correctly when:

✅ All agents can be imported and initialized
✅ OpenAI API responses are received successfully
✅ Generated content includes all required sections
✅ Content extraction methods work properly
✅ Fallback mechanisms engage when needed
✅ Documents are formatted correctly
✅ Database operations complete without errors
