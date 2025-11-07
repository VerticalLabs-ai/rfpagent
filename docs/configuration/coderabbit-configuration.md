# CodeRabbit Configuration Guide

**Last Updated**: 2025-11-06
**Configuration File**: `/.coderabbit.yaml`

## Overview

This document explains the CodeRabbit AI code review configuration for the RFP Agent platform. CodeRabbit provides automated, intelligent code reviews for pull requests with a focus on security, performance, and maintainability.

## Quick Reference

- **Configuration Schema**: https://coderabbit.ai/integrations/schema.v2.json
- **Documentation**: https://docs.coderabbit.ai/
- **Review Profile**: `assertive` (balanced feedback with emphasis on critical issues)
- **Auto-review**: Enabled for all non-draft PRs

## Configuration Highlights

### Review Settings

```yaml
reviews:
  profile: assertive                    # Assertive but supportive feedback
  auto_review:
    enabled: true                       # Automatic reviews on PRs
    drafts: false                       # Skip draft PRs
    auto_incremental_review: true       # Review only changed lines
```

### Path Filters (Excluded from Review)

The following paths are excluded from code review:

- **Documentation**: `**/*.md`, `**/CLAUDE*.md`, `**/docs/**/*.md`
- **Build artifacts**: `**/dist/**`, `**/build/**`, `**/node_modules/**`, `**/.mastra/**`
- **Lock files**: `**/pnpm-lock.yaml`, `**/package-lock.json`, `**/yarn.lock`
- **Generated files**: `**/migrations/**/*.sql`, `**/*.generated.*`, `**/drizzle/**`
- **Binary files**: Images, PDFs, fonts, WASM files
- **Config artifacts**: `.env*` files, `mcp.json`, `.tsbuildinfo`

## Path-Specific Review Instructions

### 1. Mastra AI Agents (`src/mastra/agents/**/*.ts`)

**Critical Review Areas:**

- **Architecture Compliance**
  - 3-tier hierarchy: Primary Orchestrator → Managers → Specialists
  - Proper Mastra.ai framework patterns
  - Tool registration and typing
  - System prompt clarity

- **Tool Integration**
  - Tools defined in `src/mastra/tools/`
  - Zod schema validation
  - Structured error handling
  - Consistent output formats

- **AI Safety**
  - Prompt injection vulnerability checks
  - NO hardcoded credentials
  - Output validation
  - Model selection appropriateness

- **Testing Requirements**
  - Target: **85%+ coverage**
  - Mock LLM calls
  - Test error conditions

### 2. Workflows (`src/mastra/workflows/**/*.ts`)

**Critical Review Areas:**

- **Workflow Design**
  - TypeScript typed steps
  - Error handling per step
  - Timeout configuration
  - State management

- **Agent Integration**
  - Proper agent coordination
  - Zod input/output schemas
  - Step dependencies

- **Observability**
  - Logging with Winston
  - SSE/WebSocket progress reporting
  - Performance metrics
  - Correlation IDs

- **Testing Requirements**
  - Target: **85%+ coverage**
  - E2E workflow tests
  - Step isolation tests
  - Error scenarios

### 3. Agent Tools (`src/mastra/tools/**/*.ts`)

**Critical Review Areas:**

- **Tool Design**
  - Single responsibility
  - Zod schema validation
  - NO 'any' types
  - Clear JSDoc

- **Browser Automation (Stagehand/Browserbase)**
  - Session management (create, reuse, cleanup)
  - Timeout handling (default 30s)
  - Resource cleanup on error
  - Rate limit handling (429 with backoff)
  - Retry logic (3 retries max)

- **Security**
  - Input sanitization (XSS, SQL injection prevention)
  - NO credential leaking
  - 1Password SDK for secrets
  - URL validation (portal whitelist)

- **Testing Requirements**
  - Target: **90%+ coverage**
  - Mock browser/APIs
  - Test timeouts and failures

### 4. Backend API (`server/**/*.ts`)

**Critical Review Areas:**

- **Route Design**
  - RESTful conventions
  - Proper status codes (200, 201, 400, 401, 403, 404, 500)
  - Consistent response format: `{ success, data, error }`
  - API versioning: `/api/v1/...`

- **Security**
  - Zod input validation
  - JWT authentication
  - Rate limiting (express-rate-limit)
  - SQL injection prevention (Drizzle ORM)
  - XSS prevention
  - CORS configuration

- **Database**
  - Drizzle ORM exclusively
  - Transaction handling
  - Efficient queries (avoid N+1)
  - Connection pooling

- **Performance**
  - Response time < 500ms
  - Async/await patterns
  - Caching (Redis)
  - Pagination
  - Gzip compression

- **Testing Requirements**
  - Target: **85%+ coverage**
  - Mock database calls
  - Test authentication
  - Test rate limiting

### 5. Database Schema (`shared/schema/**/*.ts`)

**Critical Review Areas:**

- **Schema Design**
  - Table naming: `plural_lowercase_snake_case`
  - JSONB for flexible data
  - Foreign key constraints
  - Indexes on query columns
  - JSONB GIN indexes

- **Drizzle Patterns**
  - Use `drizzle-zod` for validation
  - Proper relations
  - Type-safe queries

- **Migrations**
  - MUST have migration for each change
  - Test up AND down
  - NO data loss
  - Use transactions

- **Data Integrity**
  - NOT NULL for required fields
  - DEFAULT values
  - CHECK constraints
  - UNIQUE constraints

### 6. React Components (`client/src/components/**/*.tsx`)

**Critical Review Areas:**

- **Component Design**
  - Functional components + hooks
  - TypeScript prop typing
  - No prop drilling (React Query, context)
  - Composition over inheritance

- **State Management**
  - React Query for server state
  - React hooks for local state
  - Loading/error states
  - Optimistic updates

- **Performance**
  - React.memo for expensive renders
  - useMemo/useCallback
  - Lazy loading (React.lazy)
  - Virtualization

- **Accessibility**
  - Semantic HTML
  - ARIA labels
  - Keyboard navigation
  - Screen reader testing

- **Testing Requirements**
  - Target: **80%+ coverage**
  - React Testing Library
  - Test interactions
  - Test a11y

### 7. React Hooks (`client/src/hooks/**/*.ts`)

**Critical Review Areas:**

- **Hook Design**
  - Name starts with "use"
  - Single responsibility
  - Proper return types
  - Reusable

- **React Query**
  - Cache key design (query key factory)
  - Error/loading states
  - Invalidation strategies

- **Dependencies**
  - Correct dependency arrays
  - Stable references (useCallback)
  - Proper cleanup

- **Testing Requirements**
  - Target: **85%+ coverage**
  - Test in isolation (renderHook)
  - Mock APIs (msw)
  - Test cleanup

### 8. Shared Utilities (`shared/**/*.ts`)

**Critical Review Areas:**

- **Type Safety**
  - NO implicit 'any'
  - Generic constraints
  - Export types
  - Zod schemas

- **Reusability**
  - Pure functions
  - No side effects
  - Clear signatures
  - Comprehensive JSDoc

- **Testing Requirements**
  - Target: **90%+ coverage**
  - Test edge cases
  - Fast, isolated tests

## Code Generation Settings

### JSDoc Generation

CodeRabbit can generate comprehensive JSDoc comments for:

- **Agents**: Purpose, role in 3-tier system, tools, examples
- **Workflows**: Business process, inputs/outputs, steps, error handling
- **Tools**: Capabilities, parameters, Zod schemas, security considerations
- **API Endpoints**: Purpose, parameters, response formats, authentication
- **Components**: Purpose, props, accessibility, state management
- **Utilities**: Purpose, parameters, error conditions, performance

### Unit Test Generation

CodeRabbit can generate unit tests with:

- **Agents**: Initialization, tool registration, mocked LLM, 85%+ coverage
- **Workflows**: Step isolation, error recovery, mocked agents, 85%+ coverage
- **Tools**: Input validation, error scenarios, mocked services, 90%+ coverage
- **Backend**: API endpoints, auth, input validation, 85%+ coverage
- **Components**: Props, interactions, loading/error states, 80%+ coverage
- **Utilities**: Variations, null/undefined handling, 90%+ coverage

## Tools Configuration

### Enabled Code Quality Tools

- **ESLint**: JavaScript/TypeScript linting
- **Gitleaks**: Secret scanning
- **Semgrep**: Security pattern detection
- **Markdownlint**: Markdown formatting
- **YAMLlint**: YAML validation
- **Actionlint**: GitHub Actions validation
- **LanguageTool**: Documentation grammar/spelling (en-US)

## Knowledge Base Integration

CodeRabbit references these documentation files for context:

- `**/CLAUDE.md` - Project-specific guidelines
- `**/docs/README.md` - Main documentation index
- `**/docs/api/README.md` - API documentation
- `**/docs/technical/agents-architecture.md` - Agent system design
- `**/docs/architecture/**/*.md` - Architecture decisions
- `**/docs/guides/**/*.md` - Development guides

## Tone & Priority

CodeRabbit reviews focus on:

1. **Security vulnerabilities** (especially AI agent tools and browser automation)
2. **AI safety** (prompt injection, credential leaking)
3. **Performance & scalability** (response times, token usage)
4. **Error handling & observability** (logging, metrics, tracing)
5. **Test coverage** (critical paths, error scenarios)
6. **Type safety** (TypeScript, Zod validation)

Reviews are **assertive about critical issues** but **supportive for minor improvements**.

## Best Practices

### For Pull Request Authors

1. **Run tests locally** before opening PR (`npm run test`, `npm run type-check`)
2. **Address critical issues first** (security, performance, breaking changes)
3. **Respond to CodeRabbit feedback** with code changes or clarifying questions
4. **Request human review** for architectural decisions and complex logic
5. **Keep PRs focused** (single feature/fix per PR for better reviews)

### For Reviewers

1. **Review CodeRabbit comments** before adding your own (avoid duplicates)
2. **Focus on CodeRabbit's critical issues** (red flags)
3. **Validate CodeRabbit's suggestions** (AI can make mistakes)
4. **Provide context** for accepting/rejecting CodeRabbit recommendations
5. **Teach CodeRabbit** by giving feedback on its review quality

## Customization

### Adding New Path Instructions

To add custom review instructions for a new directory:

```yaml
path_instructions:
  - path: 'new/directory/**/*.ts'
    instructions: |
      **Custom Review Standards:**

      1. **Requirement 1:**
         - Detail...

      2. **Requirement 2:**
         - Detail...
```

### Excluding Additional Paths

To exclude more files from review:

```yaml
path_filters:
  - '!**/new-excluded-path/**'
  - '!**/*.new-extension'
```

### Adjusting Review Profile

Available profiles:

- `chill`: Minimal feedback, only critical issues
- `assertive`: Balanced (current setting)
- `pythonic`: Python-specific patterns

## Troubleshooting

### CodeRabbit Not Reviewing PRs

1. Check PR title doesn't contain `wip`, `draft`, or `do not review`
2. Verify PR is not marked as draft
3. Check `.coderabbit.yaml` syntax with YAML linter
4. Review GitHub App permissions

### Too Many/Few Comments

Adjust review profile:

```yaml
reviews:
  profile: chill  # For fewer comments
  profile: assertive  # Current balanced setting
```

### CodeRabbit Misses Critical Issues

1. Add specific path instructions for the file type
2. Report issue via CodeRabbit feedback in PR
3. CodeRabbit learns from your feedback

## References

- **CodeRabbit Documentation**: https://docs.coderabbit.ai/
- **Configuration Schema**: https://coderabbit.ai/integrations/schema.v2.json
- **RFP Agent Architecture**: [docs/technical/agents-architecture.md](../technical/agents-architecture.md)
- **API Documentation**: [docs/api/README.md](../api/README.md)
- **Development Guides**: [docs/guides/](../guides/)

---

**Maintained by**: Engineering Team
**Last Review**: 2025-11-06
**Next Review**: Quarterly or after major architecture changes
