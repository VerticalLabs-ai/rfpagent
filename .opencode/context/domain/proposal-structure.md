# Proposal Structure Templates

## Overview

Standard proposal section templates and best practices for government RFP responses. Used by content-generator agent for AI-powered proposal creation.

---

## Standard Proposal Sections

### 1. Executive Summary (1-2 pages)

**Purpose**: Capture evaluator attention, summarize key themes

**Structure**:

```markdown
## Executive Summary

### Understanding of Requirements

[Demonstrate understanding of customer's mission and challenges]

### Our Solution

[High-level approach and key features]

### Why Choose Us

- [Differentiator 1]
- [Differentiator 2]
- [Differentiator 3]

### Commitment

[Confidence statement and call to action]
```

**Best Practices**:

- Lead with customer benefits, not company history
- Include 2-3 compelling win themes
- Reference specific RFP requirements
- Keep language action-oriented

---

### 2. Technical Approach (10-20 pages)

**Purpose**: Detail how work will be performed

**Structure**:

```markdown
## Technical Approach

### 2.1 Solution Overview

[Architecture diagram and methodology]

### 2.2 Implementation Plan

#### Phase 1: [Name]

- Objectives
- Activities
- Deliverables
- Timeline

#### Phase 2: [Name]

[...]

### 2.3 Technical Capabilities

[Tools, technologies, innovations]

### 2.4 Risk Mitigation

| Risk     | Likelihood | Impact | Mitigation |
| -------- | ---------- | ------ | ---------- |
| [Risk 1] | Medium     | High   | [Strategy] |

### 2.5 Quality Assurance

[QA processes, standards compliance]
```

**Best Practices**:

- Mirror RFP section structure
- Address every "shall" statement
- Include diagrams and visuals
- Show innovation and value-adds

---

### 3. Management Plan (5-10 pages)

**Purpose**: Demonstrate organizational capability

**Structure**:

```markdown
## Management Plan

### 3.1 Project Management Approach

[Methodology: Agile, Waterfall, Hybrid]

### 3.2 Organizational Structure

[Org chart with reporting relationships]

### 3.3 Key Personnel

| Role | Name   | Qualifications        |
| ---- | ------ | --------------------- |
| PM   | [Name] | [Relevant experience] |

### 3.4 Communication Plan

[Reporting cadence, escalation paths]

### 3.5 Schedule

[Gantt chart or milestone table]
```

---

### 4. Past Performance (3-5 projects)

**Purpose**: Prove relevant experience

**Structure per Project**:

```markdown
## Past Performance

### Project: [Contract Name]

**Client**: [Agency/Organization]
**Contract Value**: $X.XM
**Period**: MM/YYYY - MM/YYYY
**Relevance**: [Why this project is relevant]

#### Scope

[Brief description of work performed]

#### Results

- [Quantifiable achievement 1]
- [Quantifiable achievement 2]

#### Reference

[Name, Title, Phone, Email]
```

**Best Practices**:

- Select most relevant projects (similar scope, size, complexity)
- Include quantifiable results
- Verify references are available
- Address any performance issues proactively

---

### 5. Cost/Price Volume

**Purpose**: Present competitive, realistic pricing

**Structure**:

```markdown
## Cost Proposal

### 5.1 Pricing Summary

| CLIN | Description   | Price |
| ---- | ------------- | ----- |
| 0001 | Base Year     | $X    |
| 0002 | Option Year 1 | $X    |

### 5.2 Labor Categories

| Category | Rate | Hours | Total |
| -------- | ---- | ----- | ----- |
| PM       | $XXX | XXX   | $XXX  |

### 5.3 Other Direct Costs

[Travel, materials, equipment]

### 5.4 Basis of Estimate

[Methodology for pricing]
```

---

## Compliance Matrix Template

```markdown
| Req ID  | RFP Section | Requirement       | Proposal Section | Status    |
| ------- | ----------- | ----------------- | ---------------- | --------- |
| REQ-001 | 3.1.1       | Shall provide...  | 2.1, p.5         | Compliant |
| REQ-002 | 3.1.2       | Shall maintain... | 2.3, p.8         | Compliant |
| REQ-003 | 3.2.1       | Should include... | 2.4, p.10        | Exceeds   |
```

**Status Values**:

- `Compliant`: Fully addresses requirement
- `Exceeds`: Goes beyond requirement
- `Partial`: Partially addresses (explain)
- `Non-Compliant`: Cannot meet (rare, explain)

---

## Evaluation Criteria Alignment

### Common Evaluation Factors

| Factor           | Weight | Focus Areas                       |
| ---------------- | ------ | --------------------------------- |
| Technical        | 40-50% | Approach, innovation, feasibility |
| Past Performance | 20-30% | Relevance, quality, references    |
| Price            | 20-30% | Competitiveness, realism          |
| Management       | 10-20% | Team, processes, risk             |

### Scoring Alignment

- Map proposal sections to evaluation criteria
- Ensure strongest content addresses highest-weighted factors
- Include proof points for every claim

---

## Mastra Agent Context

**Relevant Agents:**

- `content-generator`: Creates proposal sections (Tier 3)
- `compliance-checker`: Validates compliance matrix (Tier 3)
- `proposal-manager`: Coordinates proposal workflow (Tier 2)

**Database Fields (shared/schema.ts):**

```typescript
proposals: {
  content: jsonb,      // Generated proposal content
  narratives: jsonb,   // AI-generated narratives
  pricingTables: jsonb,// Pricing breakdown
  forms: jsonb,        // Filled forms
  attachments: jsonb   // File references
}
```

---

## Content Generation Workflow

```yaml
# From content-generator agent
workflow: 1. Parse RFP requirements
  2. Identify evaluation criteria
  3. Develop win themes
  4. Generate section drafts
  5. Cross-reference compliance
  6. Refine and polish
  7. Submit for review
```
