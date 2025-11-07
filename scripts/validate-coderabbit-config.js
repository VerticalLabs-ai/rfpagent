#!/usr/bin/env node

/**
 * CodeRabbit Configuration Validator
 *
 * Validates .coderabbit.yaml configuration file for:
 * - YAML syntax errors
 * - Schema compliance
 * - Path instruction coverage
 * - Tool enablement
 *
 * Usage: node scripts/validate-coderabbit-config.js
 */

import { readFileSync } from 'fs';
import { parse as parseYAML } from 'yaml';
import { resolve } from 'path';

const CONFIG_PATH = resolve(process.cwd(), '.coderabbit.yaml');

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, prefix, message) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

function success(message) {
  log(colors.green, '✓', message);
}

function error(message) {
  log(colors.red, '✗', message);
}

function warning(message) {
  log(colors.yellow, '⚠', message);
}

function info(message) {
  log(colors.blue, 'ℹ', message);
}

function section(message) {
  console.log(`\n${colors.cyan}${message}${colors.reset}`);
  console.log('─'.repeat(message.length));
}

async function validateConfig() {
  try {
    section('CodeRabbit Configuration Validator');

    // 1. File exists
    info(`Reading configuration from: ${CONFIG_PATH}`);
    const configContent = readFileSync(CONFIG_PATH, 'utf-8');
    success('Configuration file found');

    // 2. Parse YAML
    let config;
    try {
      config = parseYAML(configContent);
      success('YAML syntax is valid');
    } catch (err) {
      error(`YAML parsing failed: ${err.message}`);
      process.exit(1);
    }

    // 3. Validate schema structure
    section('Schema Validation');

    if (!config.reviews) {
      error('Missing required "reviews" section');
      process.exit(1);
    }
    success('Reviews section present');

    if (!config.reviews.profile) {
      warning('No review profile specified (will use default)');
    } else {
      success(`Review profile: ${config.reviews.profile}`);
    }

    if (!config.reviews.auto_review) {
      warning('Auto-review not configured');
    } else {
      success(`Auto-review: ${config.reviews.auto_review.enabled ? 'enabled' : 'disabled'}`);
    }

    // 4. Validate path filters
    section('Path Filters');

    if (!config.reviews.path_filters || config.reviews.path_filters.length === 0) {
      warning('No path filters configured');
    } else {
      const excludeCount = config.reviews.path_filters.filter(f => f.startsWith('!')).length;
      success(`${config.reviews.path_filters.length} path filters configured`);
      info(`  ${excludeCount} exclusion patterns`);
    }

    // 5. Validate path instructions
    section('Path-Specific Instructions');

    if (!config.reviews.path_instructions || config.reviews.path_instructions.length === 0) {
      error('No path-specific instructions configured');
      process.exit(1);
    }

    const pathInstructions = config.reviews.path_instructions;
    success(`${pathInstructions.length} path-specific instruction sets`);

    // Check for RFP Agent specific paths
    const requiredPaths = [
      'src/mastra/agents/**/*.ts',
      'src/mastra/workflows/**/*.ts',
      'src/mastra/tools/**',
      'server/**/*.ts',
      'client/src/components/**/*.tsx',
      'shared/**/*.ts',
    ];

    console.log('\nRequired Path Coverage:');
    requiredPaths.forEach(requiredPath => {
      const hasPath = pathInstructions.some(pi =>
        pi.path && (
          pi.path === requiredPath ||
          requiredPath.includes(pi.path.replace('/**/*', ''))
        )
      );

      if (hasPath) {
        success(`  ${requiredPath}`);
      } else {
        warning(`  ${requiredPath} (not explicitly configured)`);
      }
    });

    // 6. Validate tools configuration
    section('Code Quality Tools');

    // Tools can be at root level or under reviews
    const tools = config.tools || config.reviews?.tools || {};

    if (!tools || Object.keys(tools).length === 0) {
      warning('No tools configured');
    } else {
      const enabledTools = Object.entries(tools)
        .filter(([_, tool]) => tool && tool.enabled)
        .map(([name]) => name);

      if (enabledTools.length === 0) {
        warning('No tools enabled');
      } else {
        success(`${enabledTools.length} tools enabled:`);
        enabledTools.forEach(tool => info(`  - ${tool}`));
      }

      // Check for recommended tools
      const recommendedTools = ['eslint', 'gitleaks', 'semgrep'];
      const missingRecommended = recommendedTools.filter(
        tool => !enabledTools.includes(tool)
      );

      if (missingRecommended.length > 0) {
        warning(`Recommended tools not enabled: ${missingRecommended.join(', ')}`);
      }
    }

    // 7. Validate code generation settings
    section('Code Generation Settings');

    if (!config.code_generation) {
      warning('No code generation settings configured');
    } else {
      if (config.code_generation.docstrings) {
        success('Docstring generation configured');
        const docstringPaths = config.code_generation.docstrings.path_instructions || [];
        info(`  ${docstringPaths.length} path-specific docstring rules`);
      }

      if (config.code_generation.unit_tests) {
        success('Unit test generation configured');
        const testPaths = config.code_generation.unit_tests.path_instructions || [];
        info(`  ${testPaths.length} path-specific test generation rules`);
      }
    }

    // 8. Validate knowledge base
    section('Knowledge Base');

    if (!config.knowledge_base) {
      warning('No knowledge base configured');
    } else {
      if (config.knowledge_base.code_guidelines) {
        success('Code guidelines enabled');
        const patterns = config.knowledge_base.code_guidelines.filePatterns || [];
        info(`  ${patterns.length} file patterns for guidelines`);
      }

      if (config.knowledge_base.learnings) {
        success(`Learnings scope: ${config.knowledge_base.learnings.scope || 'not set'}`);
      }
    }

    // 9. Summary
    section('Validation Summary');

    const stats = {
      pathInstructions: pathInstructions.length,
      pathFilters: config.reviews.path_filters?.length || 0,
      enabledTools: Object.values(tools).filter(t => t && t.enabled).length,
      docstringPaths: config.code_generation?.docstrings?.path_instructions?.length || 0,
      testPaths: config.code_generation?.unit_tests?.path_instructions?.length || 0,
    };

    console.log();
    Object.entries(stats).forEach(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').toLowerCase();
      info(`  ${label}: ${value}`);
    });

    console.log();
    success('Configuration validation passed! ✓');
    console.log();

    return 0;

  } catch (err) {
    console.error();
    error(`Validation failed: ${err.message}`);
    console.error(err.stack);
    return 1;
  }
}

// Run validation
validateConfig()
  .then(code => process.exit(code))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
