---
description: 'Run compliance validation on a proposal against RFP requirements'
agent: 'openagent'
---

# Check Compliance

<purpose>
Run comprehensive compliance validation on a proposal to ensure all RFP requirements 
are addressed. Invokes the Mastra `compliance-check` workflow to analyze the proposal 
against mandatory requirements, evaluation criteria, and submission guidelines.
</purpose>

<syntax>
/check-compliance <proposal-id> [--strict] [--output summary|detailed|matrix]
</syntax>

<parameters>
  <param name="proposal-id" required="true">
    The unique identifier of the proposal to validate (e.g., PROP-2024-001)
  </param>
  <param name="--strict" required="false">
    Enable strict mode to flag all requirements including optional ones. 
    Default: only mandatory requirements are flagged as critical.
  </param>
  <param name="--output" required="false">
    Output format for compliance results. Options:
    - `summary` (default) - High-level pass/fail with key issues
    - `detailed` - Full requirement-by-requirement analysis
    - `matrix` - Compliance matrix format for submission
  </param>
</parameters>

<examples>
  <example>
    <description>Basic compliance check with summary output</description>
    <input>/check-compliance PROP-2024-001</input>
    <output>
```yaml
compliance_check:
  proposal_id: PROP-2024-001
  rfp_id: RFP-2024-001
  rfp_title: "Cloud Infrastructure Modernization Services"
  status: complete
  
results:
  overall_score: 87%
  status: PASS_WITH_WARNINGS
  
  mandatory_requirements:
    total: 24
    addressed: 23
    missing: 1
    
  evaluation_criteria:
    technical: 92%
    management: 85%
    past_performance: 88%
    cost: 82%
    
  critical_issues:
    - requirement: "Section L.4.2 - Key Personnel Resumes"
      status: MISSING
      action: "Add resumes for Project Manager and Technical Lead"
      
  warnings:
    - requirement: "Section M.2 - Page Limit"
      status: WARNING
      detail: "Technical section at 48 pages (limit: 50)"
      
message: "Compliance check complete. 1 critical issue requires attention."
```
    </output>
  </example>
  
  <example>
    <description>Strict mode compliance check</description>
    <input>/check-compliance PROP-2024-002 --strict</input>
    <output>
```yaml
compliance_check:
  proposal_id: PROP-2024-002
  rfp_id: SAM-W911QY24R0001
  mode: strict
  status: complete
  
results:
  overall_score: 78%
  status: NEEDS_ATTENTION
  
  mandatory_requirements:
    total: 18
    addressed: 18
    missing: 0
    
  optional_requirements:
    total: 12
    addressed: 8
    missing: 4
    
  critical_issues: []
  
  strict_mode_findings:
    - requirement: "Optional: Include organizational chart"
      status: NOT_INCLUDED
      recommendation: "Adding org chart may improve evaluation score"
    - requirement: "Optional: Provide additional references"
      status: PARTIAL
      detail: "2 of 5 optional references provided"
      
message: "Strict compliance check complete. All mandatory requirements met. 4 optional items not addressed."
```
    </output>
  </example>
  
  <example>
    <description>Detailed output format</description>
    <input>/check-compliance PROP-2024-003 --output detailed</input>
    <output>
```yaml
compliance_check:
  proposal_id: PROP-2024-003
  output_format: detailed
  status: complete
  
detailed_analysis:
  section_l_instructions:
    - id: L.1
      requirement: "Cover letter on company letterhead"
      status: COMPLIANT
      location: "Volume I, Page 1"
      
    - id: L.2
      requirement: "Table of contents with page numbers"
      status: COMPLIANT
      location: "Volume I, Pages 2-3"
      
    - id: L.3
      requirement: "Executive summary (max 5 pages)"
      status: COMPLIANT
      location: "Volume I, Pages 4-8"
      page_count: 5
      
    - id: L.4
      requirement: "Technical approach addressing all SOW tasks"
      status: PARTIAL
      location: "Volume II"
      findings:
        - "SOW Task 3.2 not explicitly addressed"
        - "SOW Task 4.1 needs more detail"
      
  section_m_evaluation:
    - id: M.1
      criterion: "Technical Approach"
      weight: 40%
      assessment: "Strong"
      score_estimate: "85-90%"
      
    - id: M.2
      criterion: "Management Approach"
      weight: 30%
      assessment: "Adequate"
      score_estimate: "75-80%"
      
message: "Detailed compliance analysis complete. See full breakdown above."
```
    </output>
  </example>
  
  <example>
    <description>Compliance matrix output</description>
    <input>/check-compliance PROP-2024-004 --output matrix</input>
    <output>
```yaml
compliance_check:
  proposal_id: PROP-2024-004
  output_format: matrix
  status: complete
  
compliance_matrix:
  header:
    - "Req ID"
    - "Requirement Description"
    - "Proposal Reference"
    - "Status"
    - "Notes"
    
  rows:
    - ["L.1", "Cover Letter", "Vol I, p.1", "✓", ""]
    - ["L.2", "Table of Contents", "Vol I, p.2-3", "✓", ""]
    - ["L.3", "Executive Summary", "Vol I, p.4-8", "✓", "5 pages"]
    - ["L.4.1", "Technical Approach", "Vol II, p.1-45", "✓", ""]
    - ["L.4.2", "Key Personnel", "Vol II, p.46-60", "⚠", "Missing 1 resume"]
    - ["L.5", "Past Performance", "Vol III", "✓", "3 references"]
    - ["L.6", "Cost Proposal", "Vol IV", "✓", ""]
    
  summary:
    compliant: 6
    partial: 1
    non_compliant: 0
    
  export_available:
    - format: xlsx
      endpoint: "/api/proposals/PROP-2024-004/compliance/export?format=xlsx"
    - format: pdf
      endpoint: "/api/proposals/PROP-2024-004/compliance/export?format=pdf"
      
message: "Compliance matrix generated. Export available in XLSX and PDF formats."
```
    </output>
  </example>
</examples>

<workflow>
## Execution Steps

1. **Load Proposal and RFP**
   - Fetch proposal content from database
   - Load associated RFP requirements
   - Parse Section L (Instructions) and Section M (Evaluation Criteria)

2. **Parse Compliance Options**
   - Determine strict mode (default: false)
   - Set output format (default: summary)

3. **Trigger Compliance Check via API**

   ```bash
   # API call to run compliance check
   POST /api/proposals/{proposal-id}/compliance
   {
     "strict": false,
     "outputFormat": "summary"
   }
   ```

4. **Invoke Mastra Workflow**
   - Triggers `compliance-check` workflow
   - Extracts all requirements from RFP
   - Maps proposal sections to requirements
   - Analyzes coverage and completeness

5. **Requirement Analysis**
   For each requirement:
   - Identify requirement type (mandatory/optional)
   - Search proposal for addressing content
   - Evaluate completeness of response
   - Flag gaps or partial compliance

6. **Generate Compliance Report**
   - Calculate overall compliance score
   - Categorize issues by severity
   - Provide actionable recommendations
   - Format output per requested type

7. **Return Results**
   - Display compliance status
   - List critical issues requiring action
   - Provide improvement recommendations
     </workflow>

<api_reference>
**Endpoint:** `POST /api/proposals/:id/compliance`

**Request Body:**

```json
{
  "strict": false,
  "outputFormat": "summary | detailed | matrix",
  "options": {
    "includeRecommendations": true,
    "checkFormatting": true,
    "validatePageLimits": true
  }
}
```

**Response:**

```json
{
  "proposalId": "PROP-2024-001",
  "rfpId": "RFP-2024-001",
  "overallScore": 87,
  "status": "PASS_WITH_WARNINGS",
  "mandatoryRequirements": {
    "total": 24,
    "addressed": 23,
    "missing": 1
  },
  "criticalIssues": [...],
  "warnings": [...],
  "recommendations": [...]
}
```

**Related Endpoints:**

- `GET /api/proposals/:id/compliance` - Get latest compliance results
- `GET /api/proposals/:id/compliance/export` - Export compliance matrix
- `PUT /api/proposals/:id` - Update proposal to fix issues
  </api_reference>

<compliance_statuses>
**FULLY_COMPLIANT**

- All mandatory requirements addressed
- No critical issues
- Score: 95-100%

**PASS_WITH_WARNINGS**

- All mandatory requirements addressed
- Minor issues or recommendations
- Score: 80-94%

**NEEDS_ATTENTION**

- Most requirements addressed
- Some gaps requiring action
- Score: 60-79%

**NON_COMPLIANT**

- Critical requirements missing
- Proposal may be rejected
- Score: Below 60%
  </compliance_statuses>

<notes>
- Run compliance check after proposal generation and before submission
- Critical issues should be resolved before proceeding to submission
- Compliance matrix format is often required as part of proposal submission
- Strict mode is recommended for competitive procurements
- Re-run compliance check after making edits to verify fixes
- Export compliance matrix for inclusion in proposal package
</notes>
