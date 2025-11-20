# Scripts Directory - Utility and Automation Scripts

**Last Updated**: November 2025

## Overview

The `scripts/` directory contains utility scripts for development, testing, deployment, and maintenance tasks. These scripts automate common operations and provide tools for developers and DevOps engineers.

## Directory Structure

```
scripts/
├── changelog/                  # Changelog generation tools
│   └── generate-entry.ts       # Generate changelog entries from git history
├── deployment/                 # Deployment scripts
│   ├── deploy.sh               # Deployment automation
│   └── rollback.sh             # Rollback automation
├── git/                        # Git hooks and utilities
│   └── commit.ts               # Interactive commit wizard
├── maintenance/                # Maintenance and operational scripts
│   ├── batch-process-compliance.ts # Bulk compliance processing
│   ├── check-austin-urls.ts    # URL validation utility
│   ├── db-backup.sh            # Database backup script
│   ├── monitor-pools.ts        # Agent pool monitoring
│   ├── run-migrations.ts       # Database migration runner
│   ├── seed-safla-demo-data.ts # Data seeding script
│   └── verify-linting-fixes.ts # Linting verification
├── security/                   # Security-related scripts
│   └── secrets-setup.sh        # Secrets management
├── tests/                      # Integration and manual test scripts
│   ├── test-agents-simple.ts   # Test AI agent functionality
│   ├── test-proposal-*.ts      # Proposal generation tests
│   └── ...                     # Other test scripts
├── utils/                      # General utilities
│   └── start-mcp-server.ts     # Standalone MCP server starter
└── CLAUDE.md                   # This file
```

## Scripts Reference

### Maintenance Scripts

#### run-migrations.ts
**Location**: `scripts/maintenance/run-migrations.ts`
**Command**: `npm run db:migrate`
Runs Drizzle ORM migrations against the database.

#### batch-process-compliance.ts
**Location**: `scripts/maintenance/batch-process-compliance.ts`
**Command**: `npm run batch-compliance`
Bulk process compliance checking for multiple proposals.

### Testing Scripts

#### test-agents-simple.ts
**Location**: `scripts/tests/test-agents-simple.ts`
**Command**: `npm run test-agents`
Tests the 3-tier AI agent system.

#### test-proposal-generation.ts
**Location**: `scripts/tests/test-proposal-generation.ts`
**Command**: `npm run test-proposal`
End-to-end test of proposal generation pipeline.

### Git Utilities

#### commit.ts
**Location**: `scripts/git/commit.ts`
**Command**: `npm run commit`
Interactive wizard for creating standardized commits with rich metadata.

## Creating New Scripts

1.  **Choose the right category**:
    *   `tests/`: For testing scripts
    *   `maintenance/`: For database or operational tasks
    *   `utils/`: For general utilities
2.  **Use the template**:
    ```typescript
    import dotenv from 'dotenv';
    dotenv.config();
    
    async function main() {
      // Your logic here
    }
    
    if (import.meta.url === `file://${process.argv[1]}`) {
      main().catch(console.error);
    }
    ```
3.  **Add to package.json**:
    ```json
    "scripts": {
      "script-name": "tsx scripts/category/script-name.ts"
    }
    ```
