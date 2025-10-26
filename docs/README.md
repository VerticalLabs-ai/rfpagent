# Documentation Index

**Last Updated**: January 2025

This directory contains all project documentation organized by category.

---

## 📁 Documentation Structure

```
docs/
├── README.md                         # This file - documentation index
├── mastra-cloud-deployment.md        # Mastra Cloud deployment guide
├── api/                              # API documentation and OpenAPI specs
│   ├── README.md                    # API overview
│   └── openapi.yaml                 # OpenAPI 3.0 specification
├── technical/                        # Technical architecture and implementation
│   ├── models-reference.md          # AI models (GPT-5, Claude 4.5)
│   ├── agents-architecture.md       # Multi-agent system design
│   ├── logging-and-observability.md # Logging, correlation IDs, tracing
│   ├── incremental-scanning.md      # Incremental portal scanning
│   ├── mcp-server-setup.md          # Local MCP server setup
│   ├── pdf-processing.md            # PDF processing implementation
│   ├── security.md                  # Security documentation
│   ├── browserbase-migration.md     # Browserbase migration
│   ├── confidence-scoring.md        # Confidence scoring system
│   ├── ml-integration-plan.md       # ML integration
│   ├── compliance-integration-fix.md # Compliance fixes
│   ├── refactoring-plan.md          # Code refactoring plans
│   └── route-refactoring-guide.md   # Route refactoring
├── testing/                          # Testing guides and procedures
│   ├── testing-guide.md             # General testing guide
│   ├── testing-with-database.md     # Database testing guide
│   └── portal-scanning-tests.md     # Portal scanning test docs
├── deployment/                       # Deployment and infrastructure
│   ├── deployment-guide.md          # Fly.io deployment guide
│   ├── cgc-analysis-report.md       # Code Graph Context analysis
│   ├── sentry-setup.md              # Sentry error tracking setup
│   └── wasm-fix-mastra-cloud.md     # WASM deployment fix
├── guides/                           # User guides and tutorials
│   ├── development-setup.md         # Development environment setup
│   ├── environment-setup.md         # Environment configuration
│   ├── integration-guide.md         # Integration guide
│   └── video-tutorial-scripts.md    # Video tutorial scripts
├── optimization/                     # Performance and code optimization
│   ├── code-optimization-report.md  # Code optimization analysis
│   └── optimization-summary.md      # Performance optimization summary
└── archive/                          # Historical documents and reports
    └── 2025-01-24-cleanup/          # Archived outdated docs
        └── (15 archived summary/status files)
```

---

## 🚀 Quick Links

### For Developers
- [Testing Guide](testing/testing-guide.md) - How to test your changes
- [Logging & Observability](technical/logging-and-observability.md) - Structured logging and tracing
- [Models Reference](technical/models-reference.md) - AI model configuration
- [Agents Architecture](technical/agents-architecture.md) - Multi-agent system
- [API Documentation](api/README.md) - REST API reference

### For DevOps
- [Deployment Guide](deployment/deployment-guide.md) - Fly.io deployment
- [Mastra Cloud Deployment](mastra-cloud-deployment.md) - Mastra Cloud deployment
- [Security Documentation](technical/security.md) - Security best practices
- Database: See CLAUDE.md in project root

### For Product/Business
- Architecture Overview: See CLAUDE.md in project root
- AI Capabilities: [Models Reference](technical/models-reference.md)
- Integration: [Integration Guide](guides/integration-guide.md)

---

## 📝 Documentation Guidelines

### 🚨 CRITICAL RULES (STRICTLY ENFORCED)

1. **NO documentation for minor fixes or one-time issues**
   - Bug fixes, small tweaks, routine updates → NO documentation
   - Only document features, architecture, or processes

2. **CONSOLIDATE - Do NOT create duplicate docs**
   - Search existing docs FIRST before creating new
   - If related doc exists → UPDATE it, don't create new
   - Maximum 2 docs on the same topic = consolidate immediately

3. **NAMING CONVENTION: kebab-case ONLY**
   - ✅ `mastra-cloud-deployment.md`
   - ❌ `MASTRA_CONFIGURATION.md`
   - ❌ `MastraConfiguration.md`
   - Exception: Technical acronyms like `CLAUDE.md`, `README.md` in root

4. **ROOT docs/ folder: MAX 2 files**
   - Only `README.md` (this file)
   - All other docs → subdirectories

5. **NEVER create docs in project root**
   - ❌ `/Users/mgunnin/Developer/.../rfpagent/my-doc.md`
   - ✅ `/Users/mgunnin/Developer/.../rfpagent/docs/technical/my-doc.md`
   - Exception: `CLAUDE.md`, `README.md`, `package.json` (config files)

6. **Archive old docs, don't delete**
   - Outdated/completed docs → `archive/YYYY-MM-DD-cleanup/`
   - Never leave stale docs in main directories

### ✅ Before Creating New Documentation

**MANDATORY CHECKLIST:**
- [ ] Is this a feature/architecture/process? (If no → don't document)
- [ ] Did I search `/docs` for existing docs on this topic?
- [ ] Can I update an existing doc instead? (If yes → update, don't create)
- [ ] Is the filename in kebab-case? (If no → fix it)
- [ ] Is it in the correct subdirectory? (Never in root)
- [ ] Does it have "Last Updated" date at top?
- [ ] Does it cross-reference related docs?

### 📋 When to Document

**✅ DO document:**
- New features (user-facing or developer-facing)
- Architecture decisions
- API changes
- Deployment procedures
- Testing strategies
- Security considerations

**❌ DON'T document:**
- Bug fixes
- Typo corrections
- Dependency updates
- Code refactoring (unless architectural)
- One-time fixes
- Temporary workarounds

---

## 📂 Directory Purposes

### `/technical`
Technical implementation details, architecture decisions, system design, security documentation, and migration guides.

### `/testing`
Testing strategies, test execution guides, test documentation, and quality assurance procedures.

### `/deployment`
Deployment procedures, infrastructure setup, production operations, and DevOps guides.

### `/api`
API documentation, OpenAPI specifications, endpoint references, and integration examples.

### `/guides`
User-facing guides, tutorials, integration instructions, and how-to documentation.

### `/archive`
Historical documents, dated reports, completed analyses, and deprecated documentation.

---

## 🔄 Maintenance

Documentation should be updated:
- When features are added/removed
- When deployment process changes
- When dependencies are updated
- When API changes occur
- At least quarterly for general review

**Last full audit**: January 2025

---

## 📧 Questions?

For documentation questions or suggestions, open an issue in the repository.
