# Government Portal Types

## Overview

Classification and characteristics of government procurement portals. Used by portal-scanner and portal-monitor agents for automated RFP discovery.

---

## Federal Portals

### SAM.gov (System for Award Management)

**Primary federal procurement portal**

- **URL**: https://sam.gov
- **API**: https://api.sam.gov/opportunities/v2
- **Auth**: API key (X-Api-Key header)
- **Rate Limits**: 10 req/sec, 10K/day
- **Data**: All federal opportunities, contract awards, entity registrations

```yaml
portal_config:
  type: sam_gov
  auth_type: api_key
  extractor: SAMGovContentExtractor
  downloader: SAMGovDocumentDownloader
```

### GSA eBuy

**GSA Schedule ordering portal**

- **URL**: https://www.ebuy.gsa.gov
- **Auth**: GSA credentials required
- **Focus**: GSA Schedule contract opportunities

### FedBizOpps (Legacy)

**Deprecated** - Migrated to SAM.gov in 2019. Some references may still exist.

---

## State/Local Portal Patterns

### Common Portal Platforms

**BidNet Direct**

- Used by: Multiple states and municipalities
- Pattern: `bidnetdirect.com/{entity}`
- Auth: Account registration required

**Bonfire**

- Used by: Cities, counties, universities
- Pattern: `{entity}.bonfirehub.com`
- Auth: Vendor registration + login
- Example: Austin, TX uses Bonfire

**IonWave**

- Used by: State governments
- Pattern: `{state}.ionwave.net`
- Auth: Vendor registration

**PlanetBids**

- Used by: California agencies, municipalities
- Pattern: `pbsystem.planetbids.com/{entity}`

### State-Specific Portals

| State      | Portal                | URL Pattern                         |
| ---------- | --------------------- | ----------------------------------- |
| Texas      | ESBD                  | `comptroller.texas.gov/purchasing/` |
| California | Cal eProcure          | `caleprocure.ca.gov`                |
| New York   | NYS Contract Reporter | `nyscr.ny.gov`                      |
| Florida    | MyFloridaMarketPlace  | `myfloridamarketplace.com`          |

---

## Portal Authentication Types

### API Key Authentication

```typescript
// SAM.gov pattern
headers: {
  'X-Api-Key': process.env.SAM_GOV_API_KEY,
  'Accept': 'application/json'
}
```

### Session-Based Authentication

```typescript
// Bonfire/BidNet pattern
// 1. Navigate to login page
// 2. Fill credentials form
// 3. Submit and capture session cookie
// 4. Use session for subsequent requests
```

### No Authentication

Some portals allow public browsing without login (limited data).

---

## Data Extraction Patterns

### API-First Extraction (Preferred)

```yaml
strategy: api_first
fallback: html_scraping
confidence: 0.95 # High confidence for API data
```

### HTML Scraping

```yaml
strategy: html_scraping
selectors:
  title: '.opportunity-title, h1.title'
  deadline: '.due-date, .response-deadline'
  agency: '.agency-name, .department'
  description: '.description, .summary'
```

### Hybrid Approach

1. Try API extraction first
2. Fall back to HTML if API unavailable
3. Validate extracted data against schema

---

## Monitoring Strategies

### Scheduled Scanning

```yaml
scan_frequency: 24 # hours between scans
max_rfps_per_scan: 50
incremental: true # Only fetch new/updated
```

### Real-Time Monitoring

- WebSocket connections (if supported)
- Webhook notifications
- RSS/Atom feeds

### Change Detection

```typescript
// Incremental scanning (rfp-discovery-workflow.ts)
const scanResult = await incrementalPortalScanService.scanPortal({
  portalId: portal.id,
  forceFullScan: false,
  maxRfpsToScan: 50,
});
```

---

## Portal Configuration Schema

```typescript
// From shared/schema.ts
interface Portal {
  id: string;
  name: string;
  url: string;
  type: string; // sam_gov, bonfire, bidnet, etc.
  isActive: boolean;
  monitoringEnabled: boolean;
  loginRequired: boolean;
  username?: string;
  password?: string;
  lastScanned?: Date;
  scanFrequency: number; // hours
  maxRfpsPerScan: number;
  selectors?: object; // CSS selectors for scraping
  filters?: object; // Business type, value filters
}
```

---

## Mastra Agent Context

**Relevant Agents:**

- `portal-scanner`: Executes portal scraping (Tier 3)
- `portal-monitor`: Tracks portal health and changes (Tier 3)
- `portal-manager`: Coordinates portal operations (Tier 2)

**Key Services:**

- `incrementalPortalScanService`: Efficient delta scanning
- `SAMGovContentExtractor`: SAM.gov API extraction
- `SAMGovDocumentDownloader`: Document retrieval

---

## Portal Detection Utility

```typescript
// From portalTypeUtils.ts
function shouldUseSAMGovExtraction(url: string, portalType?: string): boolean {
  const samGovPatterns = [/sam\.gov/i, /api\.sam\.gov/i, /beta\.sam\.gov/i];
  return samGovPatterns.some(p => p.test(url)) || portalType === 'sam_gov';
}
```
