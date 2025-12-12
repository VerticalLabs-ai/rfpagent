---
description: 'Trigger portal scanning to discover new RFPs from government and procurement portals'
agent: 'openagent'
---

# Scan Portals

<purpose>
Trigger automated portal scanning to discover new RFP opportunities from configured government 
and procurement portals. Invokes the Mastra `rfp-discovery` workflow via the API to scan 
SAM.gov, state portals, and other configured sources for matching opportunities.
</purpose>

<syntax>
/scan-portals [portal] [--keywords "search terms"] [--naics code]
</syntax>

<parameters>
  <param name="portal" required="false">
    Specific portal to scan. Options: `sam-gov`, `state-portals`, `all` (default: all)
  </param>
  <param name="--keywords" required="false">
    Search keywords to filter RFPs (e.g., "software development", "IT services")
  </param>
  <param name="--naics" required="false">
    NAICS code filter for industry-specific opportunities (e.g., 541512, 541511)
  </param>
</parameters>

<examples>
  <example>
    <description>Scan all configured portals</description>
    <input>/scan-portals</input>
    <output>
```yaml
scan_initiated:
  portals: [sam-gov, state-portals]
  status: running
  job_id: scan-2024-001
  estimated_time: "2-5 minutes"
  
message: "Portal scan initiated. You'll receive updates as new RFPs are discovered."
```
    </output>
  </example>
  
  <example>
    <description>Scan SAM.gov with specific keywords</description>
    <input>/scan-portals sam-gov --keywords "cloud migration services"</input>
    <output>
```yaml
scan_initiated:
  portal: sam-gov
  keywords: "cloud migration services"
  status: running
  job_id: scan-2024-002
  
message: "Scanning SAM.gov for 'cloud migration services' opportunities..."
```
    </output>
  </example>
  
  <example>
    <description>Scan with NAICS code filter</description>
    <input>/scan-portals sam-gov --naics 541512 --keywords "software"</input>
    <output>
```yaml
scan_initiated:
  portal: sam-gov
  naics_code: 541512
  keywords: "software"
  status: running
  job_id: scan-2024-003
  filters_applied:
    - naics: "541512 - Computer Systems Design Services"
    - keywords: "software"
    
message: "Scanning SAM.gov with NAICS 541512 filter..."
```
    </output>
  </example>
  
  <example>
    <description>Scan state portals only</description>
    <input>/scan-portals state-portals --keywords "IT modernization"</input>
    <output>
```yaml
scan_initiated:
  portal: state-portals
  keywords: "IT modernization"
  status: running
  job_id: scan-2024-004
  portals_included:
    - texas-smartbuy
    - california-caleprocure
    - new-york-ogs
    
message: "Scanning state procurement portals for 'IT modernization'..."
```
    </output>
  </example>
</examples>

<workflow>
## Execution Steps

1. **Parse Parameters**
   - Extract portal target (default: all)
   - Parse keywords if provided
   - Validate NAICS code format if provided

2. **Validate Configuration**
   - Check portal credentials are configured
   - Verify API connectivity
   - Confirm Mastra workflow is available

3. **Trigger Scan via API**

   ```bash
   # API call to trigger scan
   POST /api/rfps/scan
   {
     "portal": "{portal}",
     "keywords": "{keywords}",
     "naicsCode": "{naics}"
   }
   ```

4. **Invoke Mastra Workflow**
   - Triggers `rfp-discovery` workflow
   - Workflow handles portal authentication
   - Scrapes and parses RFP listings
   - Stores discovered RFPs in database

5. **Return Status**
   - Provide job ID for tracking
   - Estimate completion time
   - Set up notification for results

6. **Monitor Progress** (async)
   - Real-time updates via WebSocket
   - New RFPs added to pipeline automatically
   - Compliance pre-check on discovered RFPs
     </workflow>

<api_reference>
**Endpoint:** `POST /api/rfps/scan`

**Request Body:**

```json
{
  "portal": "sam-gov | state-portals | all",
  "keywords": "optional search terms",
  "naicsCode": "optional NAICS code"
}
```

**Response:**

```json
{
  "jobId": "scan-2024-001",
  "status": "running",
  "portals": ["sam-gov"],
  "estimatedTime": "2-5 minutes"
}
```

**Related Endpoints:**

- `GET /api/rfps` - List discovered RFPs
- `GET /api/portals` - List configured portals
- `GET /api/rfps/status` - Check scan status
  </api_reference>

<notes>
- Scans run asynchronously; results appear in the RFP pipeline as discovered
- Rate limiting is applied to avoid portal blocking
- Duplicate RFPs are automatically detected and skipped
- Use `/rfp-status` to check scan progress and results
- Portal credentials must be configured in environment variables
- NAICS codes: 541511 (Custom Programming), 541512 (Computer Systems Design), 541519 (Other IT Services)
</notes>
