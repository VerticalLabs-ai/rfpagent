---
description: 'Check RFP pipeline status, metrics, and active opportunities'
agent: 'openagent'
---

# RFP Status

<purpose>
Check the status of the RFP pipeline including active opportunities, pending proposals, 
submission deadlines, and overall metrics. Provides a dashboard view of all RFP activities 
and their current states in the workflow.
</purpose>

<syntax>
/rfp-status [--filter active|pending|submitted|awarded|all] [--portal portal-name] [--days number]
</syntax>

<parameters>
  <param name="--filter" required="false">
    Filter RFPs by status. Options:
    - `active` (default) - RFPs currently being worked on
    - `pending` - Discovered but not yet started
    - `submitted` - Proposals submitted, awaiting decision
    - `awarded` - Won or lost contracts
    - `all` - Show all RFPs regardless of status
  </param>
  <param name="--portal" required="false">
    Filter by source portal (e.g., sam-gov, texas-smartbuy, california-caleprocure)
  </param>
  <param name="--days" required="false">
    Time range in days to include (default: 30). Use for deadline-based filtering.
  </param>
</parameters>

<examples>
  <example>
    <description>Check active RFP pipeline status</description>
    <input>/rfp-status</input>
    <output>
```yaml
rfp_pipeline_status:
  timestamp: "2024-01-15T14:30:00Z"
  filter: active
  
summary:
  total_active: 8
  proposals_in_progress: 5
  pending_review: 2
  ready_for_submission: 1
  
upcoming_deadlines:
  - rfp_id: RFP-2024-001
    title: "Cloud Infrastructure Modernization"
    deadline: "2024-01-20T17:00:00Z"
    days_remaining: 5
    status: proposal_in_progress
    completion: 75%
    
  - rfp_id: SAM-W911QY24R0001
    title: "Army IT Support Services"
    deadline: "2024-01-25T14:00:00Z"
    days_remaining: 10
    status: compliance_review
    completion: 90%
    
  - rfp_id: RFP-2024-003
    title: "Cybersecurity Assessment"
    deadline: "2024-02-01T23:59:00Z"
    days_remaining: 17
    status: ready_for_submission
    completion: 100%

active_rfps:

- id: RFP-2024-001
  title: "Cloud Infrastructure Modernization"
  portal: sam-gov
  value: "$2.5M"
  stage: proposal_generation
- id: SAM-W911QY24R0001
  title: "Army IT Support Services"
  portal: sam-gov
  value: "$1.8M"
  stage: compliance_review

message: "8 active RFPs in pipeline. 1 ready for submission, 2 pending review."

````
    </output>
  </example>

  <example>
    <description>Check pending opportunities</description>
    <input>/rfp-status --filter pending</input>
    <output>
```yaml
rfp_pipeline_status:
  timestamp: "2024-01-15T14:30:00Z"
  filter: pending

summary:
  total_pending: 12
  high_priority: 3
  medium_priority: 5
  low_priority: 4

pending_rfps:
  high_priority:
    - id: RFP-2024-010
      title: "Enterprise Software Development"
      portal: sam-gov
      value: "$5.2M"
      deadline: "2024-02-15"
      match_score: 95%
      reason: "Strong NAICS match, past performance alignment"

    - id: RFP-2024-011
      title: "Data Analytics Platform"
      portal: california-caleprocure
      value: "$1.2M"
      deadline: "2024-02-20"
      match_score: 88%
      reason: "Technical capability match"

  medium_priority:
    - id: RFP-2024-012
      title: "Network Infrastructure Upgrade"
      portal: texas-smartbuy
      value: "$800K"
      deadline: "2024-03-01"
      match_score: 72%

recommendations:
  - "Consider starting RFP-2024-010 - high value, strong match"
  - "RFP-2024-011 deadline approaching - decision needed"

message: "12 pending opportunities. 3 high-priority RFPs recommended for pursuit."
````

    </output>

  </example>
  
  <example>
    <description>Check submitted proposals status</description>
    <input>/rfp-status --filter submitted</input>
    <output>
```yaml
rfp_pipeline_status:
  timestamp: "2024-01-15T14:30:00Z"
  filter: submitted
  
summary:
  total_submitted: 6
  awaiting_decision: 4
  in_evaluation: 2
  
submitted_proposals:
  - id: PROP-2023-045
    rfp_title: "Federal IT Modernization"
    submitted_date: "2023-12-01"
    expected_decision: "2024-01-30"
    days_waiting: 45
    status: in_evaluation
    notes: "Received clarification request on 2024-01-10"
    
  - id: PROP-2023-048
    rfp_title: "State Healthcare Portal"
    submitted_date: "2023-12-15"
    expected_decision: "2024-02-15"
    days_waiting: 31
    status: awaiting_decision
    
  - id: PROP-2024-001
    rfp_title: "Municipal Data Center"
    submitted_date: "2024-01-05"
    expected_decision: "2024-03-01"
    days_waiting: 10
    status: awaiting_decision
    
pipeline_value:
  total_submitted: "$8.5M"
  expected_win_rate: "35%"
  projected_wins: "$2.9M"
  
message: "6 proposals submitted. 2 currently in evaluation phase."
```
    </output>
  </example>
  
  <example>
    <description>Filter by portal and time range</description>
    <input>/rfp-status --portal sam-gov --days 60</input>
    <output>
```yaml
rfp_pipeline_status:
  timestamp: "2024-01-15T14:30:00Z"
  filter: all
  portal: sam-gov
  time_range: "60 days"
  
summary:
  total_rfps: 15
  by_status:
    pending: 5
    active: 4
    submitted: 4
    awarded: 2
    
sam_gov_metrics:
  discovered_last_60_days: 23
  pursued: 15
  pursuit_rate: "65%"
  
  submissions: 4
  wins: 1
  losses: 1
  pending_decision: 2
  win_rate: "50%"
  
  total_value_pursued: "$12.3M"
  total_value_won: "$2.1M"
  
recent_activity:
  - date: "2024-01-14"
    event: "New RFP discovered"
    rfp: "SAM-FA8732-24-R-0015"
    
  - date: "2024-01-12"
    event: "Proposal submitted"
    rfp: "SAM-W911QY24R0001"
    
  - date: "2024-01-10"
    event: "Contract awarded"
    rfp: "SAM-HC1028-23-R-0042"
    result: "WON - $2.1M"
    
message: "SAM.gov pipeline: 15 RFPs in last 60 days. 50% win rate on decisions."
```
    </output>
  </example>
  
  <example>
    <description>Check awarded contracts</description>
    <input>/rfp-status --filter awarded --days 90</input>
    <output>
```yaml
rfp_pipeline_status:
  timestamp: "2024-01-15T14:30:00Z"
  filter: awarded
  time_range: "90 days"
  
summary:
  total_decisions: 8
  won: 3
  lost: 5
  win_rate: "37.5%"
  
won_contracts:
  - id: RFP-2023-089
    title: "Federal Cloud Migration"
    portal: sam-gov
    value: "$2.1M"
    awarded_date: "2024-01-10"
    contract_start: "2024-02-01"
    
  - id: RFP-2023-076
    title: "State Data Analytics"
    portal: california-caleprocure
    value: "$950K"
    awarded_date: "2023-12-20"
    contract_start: "2024-01-15"
    
  - id: RFP-2023-065
    title: "Municipal IT Support"
    portal: texas-smartbuy
    value: "$450K"
    awarded_date: "2023-11-15"
    contract_start: "2023-12-01"
    
lost_contracts:
  - id: RFP-2023-082
    title: "DOD Cybersecurity"
    reason: "Price - competitor 15% lower"
    lessons: "Consider more competitive pricing for DOD"
    
  - id: RFP-2023-078
    title: "Healthcare System Integration"
    reason: "Past performance - lacked healthcare experience"
    lessons: "Build healthcare sector references"
    
performance_insights:
  strongest_areas:
    - "Cloud migration projects"
    - "State/local government"
  improvement_areas:
    - "DOD pricing competitiveness"
    - "Healthcare sector experience"
    
message: "3 contracts won ($3.5M) in last 90 days. 37.5% win rate."
```
    </output>
  </example>
</examples>

<workflow>
## Execution Steps

1. **Parse Filter Options**
   - Determine status filter (default: active)
   - Parse portal filter if provided
   - Set time range (default: 30 days)

2. **Query Pipeline Status via API**

   ```bash
   # API call to get status
   GET /api/rfps/status?filter={filter}&portal={portal}&days={days}
   ```

3. **Aggregate Pipeline Data**
   - Fetch RFPs matching criteria
   - Calculate summary metrics
   - Sort by deadline/priority

4. **Generate Status Report**
   - Format based on filter type
   - Include relevant metrics
   - Highlight urgent items

5. **Return Dashboard View**
   - Display summary statistics
   - List relevant RFPs with details
   - Provide actionable insights
     </workflow>

<api_reference>
**Endpoint:** `GET /api/rfps/status`

**Query Parameters:**

- `filter`: active | pending | submitted | awarded | all
- `portal`: Portal name filter
- `days`: Time range in days

**Response:**

```json
{
  "timestamp": "2024-01-15T14:30:00Z",
  "summary": {
    "total": 8,
    "byStatus": {...}
  },
  "rfps": [...],
  "metrics": {...},
  "upcomingDeadlines": [...]
}
```

**Related Endpoints:**

- `GET /api/rfps` - List all RFPs with full details
- `GET /api/portals` - List configured portals
- `GET /api/proposals` - List all proposals
  </api_reference>

<status_definitions>
**Pipeline Stages:**

- `discovered` - RFP found via portal scan
- `pending` - Awaiting go/no-go decision
- `active` - Actively pursuing, proposal in progress
- `proposal_generation` - AI generating proposal content
- `compliance_review` - Checking against requirements
- `ready_for_submission` - Complete, awaiting submission
- `submitted` - Proposal submitted to agency
- `in_evaluation` - Agency evaluating proposals
- `awaiting_decision` - Evaluation complete, decision pending
- `awarded` - Contract decision made (won/lost)
  </status_definitions>

<notes>
- Status updates automatically as RFPs progress through pipeline
- Deadlines are highlighted when within 7 days
- Win/loss tracking helps improve future proposals
- Use portal filter to analyze performance by source
- Metrics help identify pursuit patterns and success factors
- Export functionality available for reporting
</notes>
