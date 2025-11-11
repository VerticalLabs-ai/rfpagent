import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface FileRecord {
  path: string;
  type: 'code' | 'doc';
  subsystem: string;
  slug?: string;
}

interface AuditSummary {
  generatedAt: string;
  totals: {
    allFiles: number;
    codeFiles: number;
    docFiles: number;
  };
  subsystemBreakdown: Record<string, number>;
  duplicateDocs: Array<{ slug: string; files: string[] }>;
  legacyDocDirectories: string[];
}

interface CleanupManifest {
  generatedAt: string;
  duplicates: Array<{ slug: string; files: string[] }>;
  merges: Array<{ target: string; sources: string[]; rationale: string }>;
  archiveCandidates: string[];
  keepers: string[];
}

const DOC_REQUIRED_FIELDS = ['title', 'description', 'lastUpdated', 'category'];
const LEGACY_DOC_DIRECTORIES = [
  'docs/analysis',
  'docs/architecture',
  'docs/configuration',
  'docs/design',
  'docs/fixes',
  'docs/guides',
  'docs/optimization',
  'docs/research',
  'docs/reviews',
  'docs/technical',
  'docs/testing',
  'docs/training',
  'docs/troubleshooting'
];

function runGitLsFiles(): string[] {
  const raw = execSync('git ls-files', { cwd: repoRoot, encoding: 'utf-8' });
  return raw.split('\n').filter(Boolean);
}

function classifyFile(filePath: string): FileRecord | null {
  const extension = path.extname(filePath);
  const isDoc = ['.md', '.mdx'].includes(extension);
  const isCode = ['.ts', '.tsx'].includes(extension);
  if (!isDoc && !isCode) {
    return null;
  }

  const subsystem = detectSubsystem(filePath, isDoc);
  const record: FileRecord = {
    path: filePath,
    type: isDoc ? 'doc' : 'code',
    subsystem
  };

  if (isDoc) {
    const slug = normaliseSlug(filePath);
    record.slug = slug;
  }

  return record;
}

function detectSubsystem(filePath: string, isDoc: boolean): string {
  if (filePath.startsWith('server/')) return 'server';
  if (filePath.startsWith('client/')) return 'client';
  if (filePath.startsWith('shared/')) return 'shared';
  if (filePath.startsWith('src/mastra/')) return 'mastra';
  if (filePath.startsWith('tests/')) return 'tests';
  if (filePath.startsWith('scripts/')) return 'scripts';
  if (filePath.startsWith('docs/src/content/docs')) return 'starlight';
  if (filePath.startsWith('docs/')) return isDoc ? 'legacy-docs' : 'docs-support';
  return 'other';
}

function normaliseSlug(filePath: string): string {
  const base = path.basename(filePath).replace(/\.(md|mdx)$/i, '');
  return base.replace(/\d+/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

function buildAuditSummary(records: FileRecord[]): AuditSummary {
  const summary: AuditSummary = {
    generatedAt: new Date().toISOString(),
    totals: {
      allFiles: records.length,
      codeFiles: records.filter((r) => r.type === 'code').length,
      docFiles: records.filter((r) => r.type === 'doc').length
    },
    subsystemBreakdown: {},
    duplicateDocs: [],
    legacyDocDirectories: LEGACY_DOC_DIRECTORIES.filter((dir) => fs.existsSync(path.join(repoRoot, dir)))
  };

  for (const record of records) {
    summary.subsystemBreakdown[record.subsystem] = (summary.subsystemBreakdown[record.subsystem] ?? 0) + 1;
  }

  const slugMap = new Map<string, string[]>();
  for (const record of records.filter((r) => r.type === 'doc')) {
    if (!record.slug) continue;
    const arr = slugMap.get(record.slug) ?? [];
    arr.push(record.path);
    slugMap.set(record.slug, arr);
  }

  for (const [slug, files] of slugMap.entries()) {
    if (files.length > 1) {
      summary.duplicateDocs.push({ slug, files: files.sort() });
    }
  }

  return summary;
}

function writeAuditReport(summary: AuditSummary): void {
  const reportPath = path.join(repoRoot, 'docs/governance/repo-audit-report.md');
  const lines: string[] = [];
  lines.push('---');
  lines.push('title: Repository Audit Report');
  lines.push('description: Automatically generated summary of documentation coverage and duplicate candidates.');
  lines.push(`lastUpdated: ${summary.generatedAt.slice(0, 10)}`);
  lines.push('category: governance');
  lines.push('---\n');
  lines.push(`_Generated_: ${summary.generatedAt}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- Total tracked files: **${summary.totals.allFiles}**`);
  lines.push(`- Code files: **${summary.totals.codeFiles}**`);
  lines.push(`- Documentation files: **${summary.totals.docFiles}**`);
  lines.push('');
  lines.push('## Subsystem breakdown');
  lines.push('');
  lines.push('| Subsystem | Files |');
  lines.push('| --- | --- |');
  for (const [subsystem, count] of Object.entries(summary.subsystemBreakdown).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`| ${subsystem} | ${count} |`);
  }
  lines.push('');
  lines.push('## Duplicate documentation candidates');
  lines.push('');
  if (summary.duplicateDocs.length === 0) {
    lines.push('No duplicate slugs detected.');
  } else {
    for (const dup of summary.duplicateDocs) {
      lines.push(`- **${dup.slug}** → ${dup.files.join(', ')}`);
    }
  }
  lines.push('');
  lines.push('## Legacy directories');
  lines.push('');
  for (const dir of summary.legacyDocDirectories) {
    lines.push(`- ${dir}`);
  }
  lines.push('');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
}

function buildCleanupManifest(summary: AuditSummary): CleanupManifest {
  const manifest: CleanupManifest = {
    generatedAt: summary.generatedAt,
    duplicates: summary.duplicateDocs,
    merges: [
      {
        target: 'docs/src/content/docs/operations/dev-environment.mdx',
        sources: [
          'docs/guides/development-setup.md',
          'docs/guides/environment-setup.md'
        ],
        rationale: 'Consolidate environment setup instructions into a single operations guide.'
      },
      {
        target: 'docs/src/content/docs/quality/performance-optimization.mdx',
        sources: [
          'docs/optimization/code-optimization-report.md',
          'docs/analysis/performance-review.md'
        ],
        rationale: 'Replace redundant optimisation summaries with a curated performance overview.'
      },
      {
        target: 'docs/src/content/docs/workflows/agent-orchestration.mdx',
        sources: [
          'docs/technical/agents-architecture.md',
          'docs/technical/route-refactoring-guide.md'
        ],
        rationale: 'Merge overlapping workflow documentation into the canonical agent orchestration page.'
      }
    ],
    archiveCandidates: [],
    keepers: [
      'docs/src/content/docs/index.mdx',
      'docs/src/content/docs/governance/overview.mdx',
      'docs/src/content/docs/governance/changelog-discipline.mdx'
    ]
  };

  for (const dir of summary.legacyDocDirectories) {
    const absolute = path.join(repoRoot, dir);
    if (!fs.existsSync(absolute)) continue;
    const entries = fs.readdirSync(absolute);
    for (const entry of entries) {
      const candidate = path.join(dir, entry);
      if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
        manifest.archiveCandidates.push(candidate);
      }
    }
  }

  return manifest;
}

function writeCleanupManifest(manifest: CleanupManifest): void {
  const manifestPath = path.join(repoRoot, 'docs/governance/cleanup-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

function enforceDocs(records: FileRecord[]): void {
  const docRecords = records.filter((r) => r.type === 'doc' && r.path.startsWith('docs/src/content/docs'));
  const violations: string[] = [];

  for (const record of docRecords) {
    const absolute = path.join(repoRoot, record.path);
    const content = fs.readFileSync(absolute, 'utf-8');
    const data = extractFrontMatter(content);

    for (const field of DOC_REQUIRED_FIELDS) {
      if (!data[field]) {
        violations.push(`${record.path} is missing required front matter field \`${field}\`.`);
      }
    }

    const baseName = path.basename(record.path);
    if (!/^([a-z0-9]+(-[a-z0-9]+)*)\.(md|mdx)$/.test(baseName)) {
      violations.push(`${record.path} is not kebab-case.`);
    }
  }

  if (violations.length > 0) {
    violations.forEach((message) => console.error(message));
    throw new Error('Documentation governance checks failed.');
  }
}

function extractFrontMatter(source: string): Record<string, unknown> {
  if (!source.startsWith('---')) {
    return {};
  }

  const end = source.indexOf('\n---', 3);
  if (end === -1) {
    return {};
  }

  const block = source.slice(3, end).trim();
  const lines = block.split(/\r?\n/);
  const data: Record<string, unknown> = {};
  for (const line of lines) {
    const [rawKey, ...rawValueParts] = line.split(':');
    if (!rawKey || rawValueParts.length === 0) continue;
    const key = rawKey.trim();
    const value = rawValueParts.join(':').trim().replace(/^['"]|['"]$/g, '');
    data[key] = value;
  }
  return data;
}

function updateChangelog(args: Record<string, string | boolean>): void {
  const requestedBase = (args['--base'] as string) ?? 'origin/main';
  const releaseName = (args['--release'] as string) ?? 'Unreleased';
  const dryRun = Boolean(args['--dry-run']);

  const baseRef = resolveBaseRef(requestedBase);
  const diffCommand = baseRef === 'HEAD'
    ? 'git diff --name-only HEAD'
    : baseRef.endsWith('^')
      ? `git diff --name-only ${baseRef}..HEAD`
      : `git diff --name-only ${baseRef}...HEAD`;
  const diffRaw = execSync(diffCommand, {
    cwd: repoRoot,
    encoding: 'utf-8'
  });
  const changedFiles = diffRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (changedFiles.length === 0) {
    console.log('No changed files detected between base and HEAD. Skipping changelog update.');
    return;
  }

  const categories: Record<string, string[]> = {
    Documentation: [],
    Code: [],
    Infrastructure: [],
    Operations: []
  };

  for (const file of changedFiles) {
    if (file.startsWith('docs/')) {
      categories.Documentation.push(file);
    } else if (file.startsWith('k8s/') || file.startsWith('.github/') || file.startsWith('Dockerfile')) {
      categories.Infrastructure.push(file);
    } else if (file.startsWith('scripts/') || file.startsWith('server/') || file.startsWith('client/') || file.startsWith('shared/') || file.startsWith('src/')) {
      categories.Code.push(file);
    } else {
      categories.Operations.push(file);
    }
  }

  const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    const header = ['# Changelog', '', 'All notable changes to this project will be documented in this file.', ''];
    fs.writeFileSync(changelogPath, header.join('\n'), 'utf-8');
  }

  const existing = fs.readFileSync(changelogPath, 'utf-8');
  const releaseHeader = releaseName === 'Unreleased'
    ? '## [Unreleased]'
    : `## [${releaseName}] - ${new Date().toISOString().slice(0, 10)}`;

  const bodyLines: string[] = [];
  for (const [category, files] of Object.entries(categories)) {
    if (files.length === 0) continue;
    bodyLines.push(`### ${category}`);
    for (const file of files) {
      bodyLines.push(`- ${file}`);
    }
    bodyLines.push('');
  }

  if (bodyLines.length === 0) {
    console.log('No relevant files matched changelog categories.');
    return;
  }

  const newSection = `${releaseHeader}\n\n${bodyLines.join('\n')}`.trim() + '\n\n';
  const pattern = new RegExp(`## \\[${releaseName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\](?:[^]*?)(?=\n## \\[|$)`);

  let updated: string;
  if (pattern.test(existing)) {
    updated = existing.replace(pattern, newSection.trim());
  } else {
    const insertionPoint = existing.indexOf('## [');
    if (insertionPoint === -1) {
      updated = existing + '\n' + newSection;
    } else {
      updated = existing.slice(0, insertionPoint) + newSection + existing.slice(insertionPoint);
    }
  }

  if (dryRun) {
    console.log(newSection);
    return;
  }

  fs.writeFileSync(changelogPath, updated.trimEnd() + '\n', 'utf-8');
}

function parseArgs(argv: string[]): { command: string; flags: Record<string, string | boolean> } {
  const [command = 'audit', ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        flags[token] = next;
        i++;
      } else {
        flags[token] = true;
      }
    }
  }
  return { command, flags };
}

function resolveBaseRef(requested: string): string {
  try {
    execSync(`git rev-parse --verify ${requested}`, { cwd: repoRoot, stdio: 'ignore' });
    return requested;
  } catch (error) {
    try {
      execSync('git rev-parse --verify HEAD^', { cwd: repoRoot, stdio: 'ignore' });
      return 'HEAD^';
    } catch (err) {
      return 'HEAD';
    }
  }
}

function main(): void {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const files = runGitLsFiles();
  const records = files
    .map((file) => classifyFile(file))
    .filter((record): record is FileRecord => record !== null);
  const summary = buildAuditSummary(records);

  switch (command) {
    case 'audit': {
      writeAuditReport(summary);
      writeCleanupManifest(buildCleanupManifest(summary));
      console.log('Documentation audit complete.');
      break;
    }
    case 'enforce': {
      writeAuditReport(summary);
      writeCleanupManifest(buildCleanupManifest(summary));
      enforceDocs(records);
      console.log('Documentation governance checks passed.');
      break;
    }
    case 'changelog': {
      updateChangelog(flags);
      console.log('Changelog updated.');
      break;
    }
    default: {
      console.error(`Unknown command: ${command}`);
      process.exitCode = 1;
    }
  }
}

main();
