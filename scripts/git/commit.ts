#!/usr/bin/env tsx
/**
 * Smart Commit Wizard
 * 
 * Interactive tool to generate standardized commits with rich metadata
 * for automated changelog generation.
 */

import { execSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const COMMIT_TYPES = [
  { value: 'feat', label: 'Feature', description: 'A new feature' },
  { value: 'fix', label: 'Fix', description: 'A bug fix' },
  { value: 'docs', label: 'Documentation', description: 'Documentation only changes' },
  { value: 'style', label: 'Style', description: 'Changes that do not affect the meaning of the code' },
  { value: 'refactor', label: 'Refactor', description: 'A code change that neither fixes a bug nor adds a feature' },
  { value: 'perf', label: 'Performance', description: 'A code change that improves performance' },
  { value: 'test', label: 'Test', description: 'Adding missing tests or correcting existing tests' },
  { value: 'build', label: 'Build', description: 'Changes that affect the build system or external dependencies' },
  { value: 'ci', label: 'CI', description: 'Changes to our CI configuration files and scripts' },
  { value: 'chore', label: 'Chore', description: 'Other changes that don\'t modify src or test files' },
  { value: 'revert', label: 'Revert', description: 'Reverts a previous commit' },
];

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`\x1b[36m?\x1b[0m ${question} `, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function askMultiline(question: string): Promise<string> {
  console.log(`\x1b[36m?\x1b[0m ${question} (Press <Enter> twice to finish)`);
  const lines: string[] = [];
  return new Promise((resolve) => {
    rl.on('line', (line) => {
      if (line.trim() === '' && lines.length > 0 && lines[lines.length - 1] === '') {
        // Remove the last empty line and resolve
        lines.pop();
        rl.removeAllListeners('line');
        resolve(lines.join('\n').trim());
      } else {
        lines.push(line);
      }
    });
  });
}

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

async function main() {
  console.log('\x1b[1m\x1b[32m📝 Smart Commit Wizard\x1b[0m\n');

  // 1. Check staged files
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.error('\x1b[31m❌ No staged files found. Please git add files first.\x1b[0m');
    process.exit(1);
  }

  console.log(`\x1b[33mStaged files (${stagedFiles.length}):\x1b[0m`);
  stagedFiles.forEach(f => console.log(`  ${f}`));
  console.log('');

  // 2. Select Type
  console.log('\x1b[1mSelect commit type:\x1b[0m');
  COMMIT_TYPES.forEach((t, i) => {
    console.log(`  ${i + 1}. \x1b[36m${t.value}\x1b[0m: ${t.description}`);
  });
  
  let typeIndex = -1;
  while (typeIndex < 0 || typeIndex >= COMMIT_TYPES.length) {
    const answer = await ask('Type number (or name):');
    if (!answer) continue;
    
    const num = parseInt(answer);
    if (!isNaN(num) && num > 0 && num <= COMMIT_TYPES.length) {
      typeIndex = num - 1;
    } else {
      const found = COMMIT_TYPES.findIndex(t => t.value === answer || t.label.toLowerCase() === answer.toLowerCase());
      if (found !== -1) typeIndex = found;
    }
  }
  const type = COMMIT_TYPES[typeIndex].value;

  // 3. Scope
  const scope = await ask('Scope (optional, e.g. "auth", "api"):');

  // 4. Subject
  let subject = '';
  while (!subject) {
    subject = await ask('Subject (short description, max 70 chars):');
    if (subject.length > 70) {
      console.log(`\x1b[33mWarning: Subject is ${subject.length} chars (recommended max 70)\x1b[0m`);
    }
  }

  // 5. TL;DR
  const tldr = await ask('TL;DR (One sentence summary for changelog):');

  // 6. What Changed
  console.log('\n\x1b[1mDetailed Description (What Changed):\x1b[0m');
  console.log('Explain the "why" and "how". Use bullet points if needed.');
  const whatChanged = await askMultiline('Enter description:');

  // 7. Technical Details (Auto-populated with files, but ask for more)
  const techDetails = await ask('Technical Details (optional, e.g. "Added new API endpoint"):');

  // 8. Deployment Notes
  const deployment = await ask('Deployment Notes (optional, e.g. "Requires db migration"):');

  // Construct Commit Message
  const header = `${type}${scope ? `(${scope})` : ''}: ${subject}`;
  
  let body = '';
  
  if (tldr) {
    body += `TL;DR: ${tldr}\n\n`;
  }

  if (whatChanged) {
    body += `### What Changed\n\n${whatChanged}\n\n`;
  }

  // Auto-generate file list for Technical Details
  body += `### Technical Details\n\n`;
  if (techDetails) {
    body += `${techDetails}\n\n`;
  }
  body += `**Files Modified:**\n`;
  stagedFiles.forEach(f => body += `- ${f}\n`);
  body += '\n';

  if (deployment) {
    body += `### Deployment\n\n${deployment}\n`;
  }

  const fullMessage = `${header}\n\n${body.trim()}`;

  console.log('\n\x1b[1m--------------------------------------------------\x1b[0m');
  console.log(fullMessage);
  console.log('\x1b[1m--------------------------------------------------\x1b[0m\n');

  const confirm = await ask('Commit with this message? (y/n)');
  
  if (confirm.toLowerCase() === 'y') {
    try {
      // We use a temporary file to pass the message to git to avoid shell escaping issues
      const tmpFile = join(process.cwd(), '.git', 'COMMIT_EDITMSG_TMP');
      writeFileSync(tmpFile, fullMessage);
      
      execSync(`git commit -F "${tmpFile}"`, { stdio: 'inherit' });
      unlinkSync(tmpFile);
      
      console.log('\n\x1b[32m✅ Commit successful!\x1b[0m');
    } catch (error) {
      console.error('\n\x1b[31m❌ Commit failed.\x1b[0m');
    }
  } else {
    console.log('\n\x1b[33mCommit aborted.\x1b[0m');
  }

  rl.close();
}

main().catch(console.error);
