---
description: 'Start AI-powered proposal generation for a specific RFP'
agent: 'openagent'
---

# Generate Proposal

<purpose>
Initiate AI-powered proposal generation for a specific RFP. Invokes the Mastra 
`proposal-generation` workflow to create comprehensive proposal content including 
executive summary, technical approach, management plan, past performance, and cost sections.
</purpose>

<syntax>
/generate-proposal <rfp-id> [--sections "section1,section2"] [--tone formal|persuasive|technical]
</syntax>

<parameters>
  <param name="rfp-id" required="true">
    The unique identifier of the RFP to generate a proposal for (e.g., RFP-2024-001, SAM-W911QY24R0001)
  </param>
  <param name="--sections" required="false">
    Comma-separated list of specific sections to generate. Options:
    - `executive-summary` - High-level overview and value proposition
    - `technical` - Technical approach and methodology
    - `management` - Management plan and team structure
    - `past-performance` - Relevant experience and references
    - `cost` - Pricing and cost breakdown
    - `all` (default) - Generate all sections
  </param>
  <param name="--tone" required="false">
    Writing tone for the proposal. Options:
    - `formal` (default) - Professional government contracting language
    - `persuasive` - Emphasizes benefits and differentiators
    - `technical` - Detailed technical specifications focus
  </param>
</parameters>

<examples>
  <example>
    <description>Generate complete proposal with default settings</description>
    <input>/generate-proposal RFP-2024-001</input>
    <output>
```yaml
proposal_generation:
  rfp_id: RFP-2024-001
  rfp_title: "Cloud Infrastructure Modernization Services"
  status: generating
  job_id: prop-gen-2024-001
  sections:
    - executive-summary: pending
    - technical: pending
    - management: pending
    - past-performance: pending
    - cost: pending
  tone: formal
  estimated_time: "5-10 minutes"
  
message: "Generating proposal for RFP-2024-001. All sections will be created with formal tone."
```
    </output>
  </example>
  
  <example>
    <description>Generate specific sections only</description>
    <input>/generate-proposal SAM-W911QY24R0001 --sections "executive-summary,technical"</input>
    <output>
```yaml
proposal_generation:
  rfp_id: SAM-W911QY24R0001
  rfp_title: "Army IT Support Services"
  status: generating
  job_id: prop-gen-2024-002
  sections:
    - executive-summary: pending
    - technical: pending
  tone: formal
  estimated_time: "3-5 minutes"
  
message: "Generating executive summary and technical sections for SAM-W911QY24R0001..."
```
    </output>
  </example>
  
  <example>
    <description>Generate with persuasive tone</description>
    <input>/generate-proposal RFP-2024-003 --tone persuasive</input>
    <output>
```yaml
proposal_generation:
  rfp_id: RFP-2024-003
  rfp_title: "Digital Transformation Initiative"
  status: generating
  job_id: prop-gen-2024-003
  sections:
    - executive-summary: pending
    - technical: pending
    - management: pending
    - past-performance: pending
    - cost: pending
  tone: persuasive
  style_notes:
    - "Emphasizing competitive differentiators"
    - "Highlighting ROI and value proposition"
    - "Using benefit-focused language"
  estimated_time: "5-10 minutes"
  
message: "Generating persuasive proposal for RFP-2024-003..."
```
    </output>
  </example>
  
  <example>
    <description>Generate technical-focused proposal</description>
    <input>/generate-proposal RFP-2024-004 --sections "technical,cost" --tone technical</input>
    <output>
```yaml
proposal_generation:
  rfp_id: RFP-2024-004
  rfp_title: "Cybersecurity Assessment Services"
  status: generating
  job_id: prop-gen-2024-004
  sections:
    - technical: pending
    - cost: pending
  tone: technical
  style_notes:
    - "Detailed technical specifications"
    - "Methodology and tooling focus"
    - "Compliance framework alignment"
  estimated_time: "3-5 minutes"
  
message: "Generating technical sections for RFP-2024-004..."
```
    </output>
  </example>
</examples>

<workflow>
## Execution Steps

1. **Validate RFP ID**
   - Fetch RFP details from database
   - Verify RFP exists and has required data
   - Check for existing proposal drafts

2. **Parse Generation Options**
   - Determine sections to generate (default: all)
   - Set writing tone (default: formal)
   - Configure AI model parameters

3. **Trigger Generation via API**

   ```bash
   # API call to start generation
   POST /api/proposals/generate
   {
     "rfpId": "{rfp-id}",
     "sections": ["executive-summary", "technical", ...],
     "tone": "formal"
   }
   ```

4. **Invoke Mastra Workflow**
   - Triggers `proposal-generation` workflow
   - Loads RFP requirements and evaluation criteria
   - Retrieves company profile and past performance data
   - Generates each section using AI

5. **Section Generation Process**
   For each section:
   - Analyze RFP requirements relevant to section
   - Pull relevant company data and capabilities
   - Generate draft content with appropriate tone
   - Apply compliance checks inline

6. **Return Progress**
   - Provide job ID for tracking
   - Stream section completion updates
   - Notify when all sections complete

7. **Post-Generation**
   - Store proposal draft in database
   - Queue for compliance validation
   - Make available for review and editing
     </workflow>

<api_reference>
**Endpoint:** `POST /api/proposals/generate`

**Request Body:**

```json
{
  "rfpId": "RFP-2024-001",
  "sections": [
    "executive-summary",
    "technical",
    "management",
    "past-performance",
    "cost"
  ],
  "tone": "formal | persuasive | technical",
  "options": {
    "includeCompliance": true,
    "maxLength": "standard | detailed"
  }
}
```

**Response:**

```json
{
  "jobId": "prop-gen-2024-001",
  "proposalId": "PROP-2024-001",
  "status": "generating",
  "sections": [
    { "name": "executive-summary", "status": "pending" },
    { "name": "technical", "status": "pending" }
  ],
  "estimatedTime": "5-10 minutes"
}
```

**Related Endpoints:**

- `GET /api/proposals/:id` - Get proposal details
- `POST /api/proposals/:id/compliance` - Run compliance check
- `PUT /api/proposals/:id/sections/:section` - Update section
  </api_reference>

<section_descriptions>
**executive-summary**

- Company introduction and qualifications
- Understanding of requirements
- Value proposition and key differentiators
- High-level approach summary

**technical**

- Detailed technical approach
- Methodology and processes
- Tools and technologies
- Implementation timeline
- Risk mitigation strategies

**management**

- Organizational structure
- Key personnel and qualifications
- Communication plan
- Quality assurance approach
- Subcontractor management (if applicable)

**past-performance**

- Relevant contract experience
- Similar project examples
- Performance metrics and outcomes
- Client references

**cost**

- Pricing structure
- Labor categories and rates
- Cost breakdown by task/phase
- Assumptions and exclusions
  </section_descriptions>

<notes>
- RFP must be in the system before generating a proposal (use `/scan-portals` first)
- Generation uses company profile data from configuration
- Past performance pulls from stored contract history
- Generated content should be reviewed and customized before submission
- Use `/check-compliance` after generation to validate requirements coverage
- Large RFPs may take longer to process; progress updates provided via WebSocket
</notes>
