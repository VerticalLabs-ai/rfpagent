# Proposal Generation Process

## Overview

AI-powered workflow for generating government proposal responses. Coordinates content-generator and compliance-checker agents to produce compliant, compelling proposals.

---

## Generation Workflow Stages

### Stage 1: Requirements Analysis

**Agent**: `proposal-manager` (Tier 2)

```yaml
inputs:
  - RFP documents (PDF, DOCX)
  - Extracted requirements
  - Evaluation criteria

actions:
  - Parse RFP structure
  - Extract "shall" statements (mandatory)
  - Identify "should" statements (optional)
  - Map evaluation factors and weights
  - Identify page limits and formatting rules

outputs:
  - Structured requirements list
  - Compliance checklist
  - Evaluation criteria matrix
```

### Stage 2: Win Strategy Development

**Agent**: `content-generator` (Tier 3)

```yaml
inputs:
  - Requirements analysis
  - Company capabilities
  - Past performance data
  - Competitive intelligence

actions:
  - Identify differentiators
  - Develop win themes (3-5)
  - Create proof points
  - Map strengths to evaluation criteria

outputs:
  - Win theme document
  - Discriminator matrix
  - Ghost competitor analysis
```

### Stage 3: Section Generation

**Agent**: `content-generator` (Tier 3)

```yaml
sections:
  executive_summary:
    priority: 1
    length: 1-2 pages
    focus: Customer benefits, win themes

  technical_approach:
    priority: 2
    length: 10-20 pages
    focus: Solution, methodology, innovation

  management_plan:
    priority: 3
    length: 5-10 pages
    focus: Team, processes, schedule

  past_performance:
    priority: 4
    length: 3-5 projects
    focus: Relevance, results, references

  cost_volume:
    priority: 5
    length: Variable
    focus: Competitive pricing, value
```

### Stage 4: Compliance Validation

**Agent**: `compliance-checker` (Tier 3)

```yaml
validation_checks:
  - All "shall" statements addressed
  - Page limits respected
  - Formatting requirements met
  - Required forms included
  - Certifications complete

outputs:
  - Compliance matrix
  - Gap analysis
  - Risk assessment
  - Remediation recommendations
```

### Stage 5: Review & Refinement

**Agent**: `proposal-manager` (Tier 2)

```yaml
review_cycles:
  pink_team:
    timing: 50% complete
    focus: Strategy, approach, compliance

  red_team:
    timing: 90% complete
    focus: Evaluator perspective, scoring

  gold_team:
    timing: Final
    focus: Executive review, pricing

refinement_actions:
  - Incorporate feedback
  - Strengthen weak sections
  - Enhance win themes
  - Final compliance check
```

### Stage 6: Assembly & Submission

**Workflow**: `proposal-pdf-assembly-workflow`

```yaml
assembly_steps:
  - Compile all sections
  - Generate table of contents
  - Add headers/footers
  - Apply formatting
  - Create PDF volumes
  - Verify file sizes

submission_prep:
  - Package per portal requirements
  - Validate file formats
  - Prepare submission credentials
```

---

## Section-by-Section Generation

### Executive Summary

```yaml
structure:
  opening: Hook with customer focus
  understanding: Demonstrate knowledge of mission
  solution: High-level approach
  differentiators: 3 key win themes
  commitment: Confidence statement

generation_prompt: "Generate an executive summary that:
  - Opens with customer's primary challenge
  - Shows understanding of their mission
  - Presents our solution in 2-3 sentences
  - Highlights 3 differentiators with proof
  - Closes with confident commitment"
```

### Technical Approach

```yaml
structure:
  overview: Solution architecture
  methodology: Step-by-step approach
  implementation: Phased plan
  innovation: Value-adds
  risk_mitigation: Identified risks and solutions

generation_prompt: 'Generate technical approach that:
  - Addresses each technical requirement
  - Shows clear methodology
  - Includes implementation timeline
  - Highlights innovative solutions
  - Demonstrates risk awareness'
```

### Past Performance

```yaml
structure:
  project_name: Contract title
  client: Agency/organization
  relevance: Why this project matters
  scope: Work performed
  results: Quantifiable outcomes
  reference: Contact information

generation_prompt: 'For each past performance project:
  - Emphasize relevance to current RFP
  - Include specific metrics and outcomes
  - Show lessons learned applied
  - Verify reference availability'
```

---

## Compliance Checking Integration

### Compliance Matrix Generation

```typescript
// From compliance-checker agent
interface ComplianceItem {
  requirementId: string;
  rfpReference: string;
  requirementText: string;
  mandatory: boolean;
  status: 'compliant' | 'partial' | 'non-compliant';
  proposalReference: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  notes: string;
}
```

### Gap Detection

```yaml
gap_types:
  missing: Requirement not addressed
  partial: Requirement partially addressed
  weak_evidence: Claim without proof
  format_issue: Page/format violation

remediation_priority:
  critical: Must fix before submission
  high: Should fix, impacts scoring
  medium: Recommended improvement
  low: Nice to have
```

---

## Review & Refinement Cycles

### Pink Team Review (Strategy)

```yaml
timing: 50% draft complete
reviewers: Capture manager, technical lead
focus:
  - Win strategy alignment
  - Technical approach soundness
  - Compliance trajectory
  - Resource allocation

deliverable: Pink team report with action items
```

### Red Team Review (Evaluation)

```yaml
timing: 90% draft complete
reviewers: External evaluators (simulate customer)
focus:
  - Score proposal against criteria
  - Identify weaknesses
  - Compare to likely competitors
  - Recommend improvements

deliverable: Red team scorecard and recommendations
```

### Gold Team Review (Executive)

```yaml
timing: Final draft
reviewers: Executive leadership
focus:
  - Strategic alignment
  - Pricing approval
  - Risk acceptance
  - Go/no-go decision

deliverable: Executive approval to submit
```

---

## Mastra Agent Integration

### Agent Coordination

```typescript
// Content generation flow
proposalManager.delegate({
  agent: 'content-generator',
  task: 'generate_section',
  section: 'technical_approach',
  requirements: extractedRequirements,
  winThemes: developedThemes,
});

// Compliance validation
proposalManager.delegate({
  agent: 'compliance-checker',
  task: 'validate_compliance',
  proposal: generatedContent,
  requirements: rfpRequirements,
});
```

### Progress Tracking

```typescript
// From agent-coordination-tools.ts
updateWorkflowProgress({
  workflowId: proposalWorkflowId,
  phase: 'generation',
  progress: 75,
  message: 'Technical approach complete',
});
```

---

## Database Integration

### Proposal Storage

```typescript
// From shared/schema.ts
proposals: {
  id: string;
  rfpId: string;
  content: jsonb; // Section content
  narratives: jsonb; // AI-generated text
  pricingTables: jsonb; // Cost breakdown
  forms: jsonb; // Completed forms
  attachments: jsonb; // File references
  status: 'draft' | 'review' | 'approved' | 'submitted';
}
```

### RFP Status Updates

```yaml
status_progression: discovered → parsing → drafting → review → approved → submitted

progress_tracking:
  0-25%: Requirements analysis
  25-50%: Section generation
  50-75%: Compliance validation
  75-90%: Review cycles
  90-100%: Final assembly
```

---

## Quality Metrics

### Content Quality

```yaml
metrics:
  - Requirement coverage (target: 100%)
  - Win theme integration (target: 3+ per section)
  - Evidence density (proof points per page)
  - Readability score (target: Grade 12)
  - Compliance score (target: 100%)
```

### Process Efficiency

```yaml
metrics:
  - Generation time per section
  - Review cycle duration
  - Rework rate
  - On-time submission rate
```
