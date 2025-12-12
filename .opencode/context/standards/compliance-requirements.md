# Compliance Requirements Standards

## Overview

Validation rules and compliance standards for government RFP responses. Used by compliance-checker agent to ensure proposals meet all regulatory and solicitation requirements.

---

## FAR Compliance Requirements

### FAR Part 4: Administrative Matters

```yaml
requirements:
  - SAM.gov registration current
  - DUNS/UEI number valid
  - Tax identification provided
  - Organizational information accurate
```

### FAR Part 9: Contractor Qualifications

```yaml
requirements:
  - Not debarred or suspended
  - Adequate financial resources
  - Necessary experience and skills
  - Satisfactory performance record
  - Integrity and business ethics
```

### FAR Part 15: Contracting by Negotiation

```yaml
requirements:
  - Proposal format per instructions
  - All volumes submitted
  - Pricing complete and realistic
  - Technical approach responsive
```

### FAR Part 52: Contract Clauses

```yaml
common_clauses:
  52.204-7: SAM registration
  52.212-3: Offeror representations
  52.219-1: Small business program
  52.222-26: Equal opportunity
  52.225-1: Buy American Act
```

---

## DFARS Requirements (DoD)

### DFARS 252.204: Cybersecurity

```yaml
requirements:
  - NIST SP 800-171 compliance
  - CMMC certification (if required)
  - Incident reporting procedures
  - Controlled unclassified information (CUI) handling
```

### DFARS 252.225: Buy American

```yaml
requirements:
  - Domestic preference compliance
  - Country of origin documentation
  - Specialty metals restrictions
  - Berry Amendment compliance (textiles)
```

### DFARS 252.239: IT Security

```yaml
requirements:
  - Cloud computing requirements
  - Data protection standards
  - Network security controls
  - Access management procedures
```

---

## Required Certifications

### Representations and Certifications

```yaml
certifications:
  - Small business size status
  - Socioeconomic certifications (8(a), HUBZone, SDVOSB, WOSB)
  - Organizational conflicts of interest
  - Debarment and suspension
  - Tax delinquency
  - Felony conviction
  - Unpaid federal tax liability
```

### Business Certifications

```yaml
certifications:
  - SAM.gov active registration
  - State business license
  - Professional licenses (if applicable)
  - Security clearances (if required)
  - Insurance certificates
```

### Quality Certifications

```yaml
certifications:
  - ISO 9001 (quality management)
  - ISO 27001 (information security)
  - CMMI (capability maturity)
  - SOC 2 (service organization controls)
```

---

## Document Formatting Standards

### Page Formatting

```yaml
requirements:
  font_size: 11-12pt minimum
  font_type: Times New Roman, Arial, or specified
  margins: 1 inch minimum (all sides)
  line_spacing: Single or as specified
  page_numbers: Required, consistent format
```

### Page Limits

```yaml
enforcement:
  strict: Pages beyond limit not evaluated
  warning: Flag sections approaching limit

common_limits:
  executive_summary: 2-5 pages
  technical_volume: 20-50 pages
  past_performance: 10-20 pages
  management_plan: 10-20 pages
```

### File Requirements

```yaml
formats:
  documents: PDF (preferred), DOCX
  spreadsheets: XLSX, PDF
  presentations: PDF, PPTX

size_limits:
  per_file: 25-100 MB (portal dependent)
  total_submission: 100-500 MB

naming_convention:
  pattern: '{Company}_{Volume}_{Version}.pdf'
  example: 'AcmeCorp_TechnicalVolume_v1.pdf'
```

---

## Compliance Validation Rules

### Mandatory Requirements ("Shall")

```yaml
validation:
  rule: Every "shall" statement must be addressed
  check: Cross-reference to proposal section
  status: Compliant, Partial, Non-Compliant

non_compliance_action:
  - Flag as critical gap
  - Require remediation before submission
  - Document exception if unavoidable
```

### Optional Requirements ("Should/May")

```yaml
validation:
  rule: Address if competitive advantage
  check: Document decision to include/exclude
  status: Addressed, Not Addressed, N/A
```

### Evaluation Criteria Alignment

```yaml
validation:
  rule: Proposal addresses all evaluation factors
  check: Map content to criteria
  scoring: Estimate score per factor
```

---

## Compliance Matrix Template

```markdown
| ID   | RFP Ref | Requirement       | Type | Proposal Ref | Status        | Risk |
| ---- | ------- | ----------------- | ---- | ------------ | ------------- | ---- |
| R001 | 3.1.1   | Shall provide...  | M    | 2.1, p.5     | Compliant     | Low  |
| R002 | 3.1.2   | Shall maintain... | M    | 2.3, p.8     | Partial       | High |
| R003 | 3.2.1   | Should include... | O    | 2.4, p.10    | Addressed     | Low  |
| R004 | 4.1.1   | May propose...    | O    | N/A          | Not Addressed | N/A  |

Legend:
M = Mandatory, O = Optional
Status: Compliant, Partial, Non-Compliant, Addressed, Not Addressed, N/A
Risk: Low, Medium, High, Critical
```

---

## Submission Checklist

### Pre-Submission Validation

```yaml
checklist:
  content:
    - [ ] All volumes complete
    - [ ] Page limits respected
    - [ ] All requirements addressed
    - [ ] Compliance matrix complete
    - [ ] Pricing accurate and complete

  formatting:
    - [ ] Font size/type correct
    - [ ] Margins correct
    - [ ] Page numbers present
    - [ ] Headers/footers correct
    - [ ] Table of contents accurate

  documents:
    - [ ] All required forms included
    - [ ] Certifications signed
    - [ ] Resumes included
    - [ ] Past performance references
    - [ ] Letters of commitment

  files:
    - [ ] Correct file formats
    - [ ] File sizes within limits
    - [ ] Naming convention followed
    - [ ] No corrupted files
    - [ ] Virus scan passed
```

### Portal Submission

```yaml
checklist:
  - [ ] Portal credentials valid
  - [ ] Submission deadline confirmed
  - [ ] All files uploaded
  - [ ] Submission confirmed
  - [ ] Confirmation receipt saved
```

---

## Risk Assessment Framework

### Risk Levels

```yaml
critical:
  definition: Non-responsive, likely rejection
  examples:
    - Missing mandatory requirement
    - Exceeded page limit (strict enforcement)
    - Missing required certification
  action: Must resolve before submission

high:
  definition: Significant scoring impact
  examples:
    - Weak response to high-weight factor
    - Missing evidence for claims
    - Formatting violations
  action: Should resolve, document if not

medium:
  definition: Moderate scoring impact
  examples:
    - Partial compliance with optional requirement
    - Minor formatting inconsistencies
    - Weak past performance relevance
  action: Resolve if time permits

low:
  definition: Minor impact
  examples:
    - Stylistic improvements
    - Additional evidence opportunities
    - Enhanced graphics
  action: Nice to have
```

---

## Mastra Agent Integration

### Compliance Checker Agent

```typescript
// From compliance-checker.ts
complianceChecker.validate({
  proposal: generatedContent,
  requirements: rfpRequirements,
  evaluationCriteria: criteria,
  formatRules: formattingRequirements
});

// Output
{
  complianceMatrix: ComplianceItem[],
  gapAnalysis: Gap[],
  riskAssessment: RiskLevel,
  recommendations: Recommendation[],
  bidNoBidRecommendation: 'bid' | 'no-bid' | 'bid-with-caution'
}
```

### Database Storage

```typescript
// From shared/schema.ts
rfps.complianceItems: jsonb;  // Compliance checklist
rfps.riskFlags: jsonb;        // High-risk items
proposals.status: string;     // Compliance-gated progression
```

---

## Common Compliance Failures

### Avoidable Failures

```yaml
failures:
  - Missing signature on certification
  - Wrong file format
  - Exceeded page limit
  - Missing required section
  - Outdated SAM.gov registration

prevention:
  - Automated validation checks
  - Pre-submission checklist
  - Multiple review cycles
  - Portal test submissions
```

### Recoverable Issues

```yaml
issues:
  - Minor formatting inconsistencies
  - Weak evidence (can strengthen)
  - Partial requirement coverage
  - Unclear technical approach

remediation:
  - Targeted content revision
  - Additional evidence gathering
  - Clarification requests (if allowed)
  - Enhanced graphics/diagrams
```
