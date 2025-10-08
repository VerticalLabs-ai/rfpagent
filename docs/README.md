# Documentation Index

**Last Updated**: January 2025

This directory contains all project documentation organized by category.

---

## 📁 Documentation Structure

```
docs/
├── README.md                   # This file - documentation index
├── api/                        # API documentation and OpenAPI specs
│   ├── README.md              # API overview
│   └── openapi.yaml           # OpenAPI 3.0 specification
├── technical/                  # Technical architecture and implementation
│   ├── models-reference.md    # AI models (GPT-5, Claude 4.5)
│   ├── agents-architecture.md # Multi-agent system design
│   ├── incremental-scanning.md # Incremental portal scanning
│   ├── SECURITY.md            # Security documentation
│   ├── BROWSERBASE_MIGRATION.md # Browserbase migration
│   ├── CONFIDENCE_SCORING.md  # Confidence scoring system
│   ├── ML_INTEGRATION_PLAN.md # ML integration
│   ├── COMPLIANCE_INTEGRATION_FIX.md # Compliance fixes
│   ├── REFACTORING_PLAN.md    # Code refactoring plans
│   └── ROUTE_REFACTORING_GUIDE.md # Route refactoring
├── testing/                    # Testing guides and procedures
│   ├── testing-guide.md       # General testing guide
│   └── PORTAL_SCANNING_TESTS.md # Portal scanning test docs
├── deployment/                 # Deployment and infrastructure
│   └── deployment-guide.md    # Fly.io deployment guide
├── guides/                     # User guides and tutorials
│   ├── INTEGRATION_GUIDE.md   # Integration guide
│   └── VIDEO_TUTORIAL_SCRIPTS.md # Video tutorial scripts
└── archive/                    # Historical documents and reports
    └── (dated analyses, summaries, and reports)
```

---

## 🚀 Quick Links

### For Developers
- [Testing Guide](testing/testing-guide.md) - How to test your changes
- [Models Reference](technical/models-reference.md) - AI model configuration
- [Agents Architecture](technical/agents-architecture.md) - Multi-agent system
- [API Documentation](api/README.md) - REST API reference

### For DevOps
- [Deployment Guide](deployment/deployment-guide.md) - Fly.io deployment
- [Security Documentation](technical/SECURITY.md) - Security best practices
- Database: See CLAUDE.md in project root

### For Product/Business
- Architecture Overview: See CLAUDE.md in project root
- AI Capabilities: [Models Reference](technical/models-reference.md)
- Integration: [Integration Guide](guides/INTEGRATION_GUIDE.md)

---

## 📝 Documentation Guidelines

**Before creating new documentation:**

1. **Check if a related document exists** in this folder
2. **If exists, UPDATE the existing document** instead of creating new
3. **If new topic**, discuss folder structure first
4. **Follow naming convention**: `kebab-case.md` for new docs
5. **Include "Last Updated" date** at the top of documents
6. **Add cross-references** to related docs

**⚠️ NEVER create documentation files in the project root** - they belong in `/docs`.

**Exception**: `CLAUDE.md` and `README.md` stay in root as they are project configuration.

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
