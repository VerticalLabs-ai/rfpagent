# SAM.gov Integration Quick Start Guide

**Last Updated**: November 18, 2025

---

## What is SAM.gov?

SAM.gov (System for Award Management) is the **primary federal government procurement portal** for discovering contract opportunities from federal agencies. The RFP Agent platform provides first-class integration with SAM.gov, featuring:

- ✅ **API-first extraction** using SAM.gov Opportunities API v2
- ✅ **Automatic authentication** via API key (no browser automation needed)
- ✅ **Document downloads** directly from API attachments
- ✅ **Hybrid fallback** to HTML scraping when API unavailable
- ✅ **Intelligent portal detection** from URLs and portal types

---

## 5-Minute Setup

### Step 1: Get Your SAM.gov API Key (2 minutes)

1. Visit: https://open.gsa.gov/api/opportunities-api/
2. Click **"Get API Key"** or **"Request Access"**
3. Fill out the registration form with your contact information
4. Receive API key via email (usually within minutes)
5. Your API key format: `YOUR-API-KEY-HERE`

**Rate Limits**:
- 10 requests per second
- 10,000 requests per day

### Step 2: Configure Your Environment (1 minute)

Add your API key to `.env`:

```bash
# Add to .env file
SAM_GOV_API_KEY="YOUR-API-KEY-HERE"
```

### Step 3: Verify Integration (2 minutes)

Test the integration with a simple API call:

```bash
# Start your development server
pnpm dev

# In another terminal, test SAM.gov discovery
curl http://localhost:3000/api/portals/sam-gov/scan
```

You should see RFP opportunities being discovered!

---

## Usage Examples

### Example 1: Discover Federal RFPs

```typescript
// Automatic portal detection from URL
const samGovUrl = 'https://sam.gov/search/?index=opp&page=1';
const rfps = await scrapingService.scrapePortal(samGovUrl);

console.log(`Found ${rfps.length} federal opportunities`);
```

### Example 2: Submit SAM.gov RFP Manually

```bash
# Via API
curl -X POST http://localhost:3000/api/rfps/manual \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://sam.gov/opp/abc123456/view",
    "userNotes": "High-priority federal contract"
  }'
```

### Example 3: Download RFP Documents

```typescript
import { SAMGovDocumentDownloader } from './samGovDocumentDownloader';

const downloader = new SAMGovDocumentDownloader();

// Download all attachments for a SAM.gov notice
const documents = await downloader.downloadRFPDocuments(
  'abc123456',  // SAM.gov notice ID
  'rfp-uuid'    // Your internal RFP ID
);

console.log(`Downloaded ${documents.length} documents`);
// Output: Downloaded 3 documents (PDF, Excel, Word)
```

### Example 4: Search with Filters

```typescript
// Search for IT contracts over $100K
const searchUrl = 'https://sam.gov/search/?index=opp&postedFrom=01/01/2025&naicsCode=541512';
const opportunities = await scrapingService.scrapePortal(searchUrl);

// Filter by value
const highValueRFPs = opportunities.filter(rfp =>
  parseFloat(rfp.estimatedValue) > 100000
);
```

---

## Portal Configuration

The SAM.gov portal is pre-configured in the system:

**Portal Details**:
- **URL**: https://sam.gov
- **Listing URL**: https://sam.gov/search/?index=opp&page=1
- **Portal Type**: `sam_gov`
- **Authentication**: API key (X-Api-Key header)
- **Extractor**: SAMGovContentExtractor
- **Downloader**: SAMGovDocumentDownloader

**Automatic Detection**:
The system automatically detects SAM.gov portals from these URL patterns:
- `https://sam.gov/...`
- `https://api.sam.gov/...`
- `https://beta.sam.gov/...`
- `https://www.sam.gov/...`

---

## API Endpoints

### SAM.gov Opportunities API v2

**Base URL**: `https://api.sam.gov/opportunities/v2`

**Common Endpoints**:

1. **Search Opportunities**
   ```
   GET /search?api_key=YOUR_KEY&limit=50
   ```

2. **Get Specific Opportunity**
   ```
   GET /search?api_key=YOUR_KEY&noticeId=abc123456
   ```

3. **Download Attachment**
   ```
   GET /opportunities/resources/files/{noticeId}/download?api_key=YOUR_KEY
   ```

**Query Parameters**:
- `limit`: Results per page (1-1000, default 50)
- `offset`: Pagination offset
- `postedFrom`: Start date (MM/DD/YYYY)
- `postedTo`: End date (MM/DD/YYYY)
- `keyword`: Search keywords
- `organizationName`: Filter by agency
- `state`: Filter by state code
- `noticeId`: Specific opportunity ID
- `naicsCode`: NAICS industry code

---

## Common Use Cases

### Use Case 1: Daily Federal Contract Monitoring

```typescript
// Schedule daily scan of SAM.gov
import cron from 'node-cron';

cron.schedule('0 8 * * *', async () => {
  console.log('Starting daily SAM.gov scan...');

  const today = new Date().toLocaleDateString('en-US');
  const url = `https://sam.gov/search/?index=opp&postedFrom=${today}`;

  const rfps = await scrapingService.scrapePortal(url);
  console.log(`Found ${rfps.length} new opportunities`);

  // Auto-generate proposals for high-priority contracts
  for (const rfp of rfps) {
    if (rfp.estimatedValue > 500000 && rfp.naicsCode === '541512') {
      await proposalService.generate(rfp.id, companyProfileId);
    }
  }
});
```

### Use Case 2: Track Specific Agencies

```typescript
// Monitor Department of Defense contracts
const dodUrl = 'https://sam.gov/search/?index=opp&organizationName=Department%20of%20Defense';
const dodRFPs = await scrapingService.scrapePortal(dodUrl);

// Get notifications
dodRFPs.forEach(rfp => {
  notificationService.send({
    title: `New DoD Contract: ${rfp.title}`,
    message: `Agency: ${rfp.agency}, Value: ${rfp.estimatedValue}`,
    priority: 'high'
  });
});
```

### Use Case 3: Competitive Intelligence

```typescript
// Analyze competitor activity on federal contracts
const competitorWins = await rfpService.getAwardedContracts({
  winner: 'Competitor Corp',
  dateRange: '2024-01-01 to 2024-12-31',
  source: 'sam_gov'
});

console.log(`Competitor won ${competitorWins.length} federal contracts`);
console.log(`Total value: $${competitorWins.reduce((sum, c) => sum + c.value, 0)}`);
```

---

## Troubleshooting

### Issue: "SAM_GOV_API_KEY not configured"

**Solution**: Add your API key to the `.env` file:
```bash
SAM_GOV_API_KEY="YOUR-API-KEY-HERE"
```

### Issue: "API validation failed: 401 Unauthorized"

**Causes**:
1. API key is incorrect
2. API key has expired
3. API key hasn't been activated yet

**Solution**:
1. Verify your API key in the SAM.gov email
2. Check if you need to activate it via a confirmation link
3. Request a new API key if needed

### Issue: "Rate limit exceeded"

**Response Headers**:
```
x-ratelimit-limit: 10000
x-ratelimit-remaining: 0
x-ratelimit-reset: 1735689600
```

**Solution**: Wait until rate limit resets (check `x-ratelimit-reset` timestamp) or:
1. Reduce request frequency
2. Use caching for repeated queries
3. Implement exponential backoff retry logic

### Issue: "No opportunities found"

**Possible Causes**:
1. Date range too narrow
2. Filters too restrictive
3. No active opportunities matching criteria

**Solution**:
```typescript
// Broaden your search
const url = 'https://sam.gov/search/?index=opp';  // No filters
const rfps = await scrapingService.scrapePortal(url);

if (rfps.length === 0) {
  console.log('No active opportunities on SAM.gov right now');
}
```

### Issue: "Document download failed"

**Solution**: The system automatically retries with exponential backoff:
```typescript
// Manual retry logic (if needed)
let attempts = 0;
const maxAttempts = 3;

while (attempts < maxAttempts) {
  try {
    const docs = await downloader.downloadRFPDocuments(noticeId, rfpId);
    break;
  } catch (error) {
    attempts++;
    if (attempts === maxAttempts) throw error;
    await sleep(Math.pow(2, attempts) * 1000);  // Exponential backoff
  }
}
```

---

## Best Practices

### 1. Respect Rate Limits

```typescript
// Good: Batch requests and cache results
const cache = new Map();

async function getCachedOpportunity(noticeId: string) {
  if (cache.has(noticeId)) {
    return cache.get(noticeId);
  }

  const opp = await api.getOpportunity(noticeId);
  cache.set(noticeId, opp);
  return opp;
}
```

### 2. Handle API Errors Gracefully

```typescript
// Good: Fallback to HTML scraping
try {
  const rfps = await extractorAPI.extract(url);
} catch (apiError) {
  console.warn('API extraction failed, falling back to HTML scraping');
  const htmlContent = await browserAutomation.scrape(url);
  const rfps = await extractorHTML.extract(htmlContent, url);
}
```

### 3. Monitor API Health

```typescript
// Good: Track API response times and success rates
const metrics = {
  requests: 0,
  successes: 0,
  failures: 0,
  avgResponseTime: 0
};

async function monitoredAPICall() {
  const start = Date.now();
  metrics.requests++;

  try {
    const result = await api.search();
    metrics.successes++;
    return result;
  } catch (error) {
    metrics.failures++;
    throw error;
  } finally {
    const duration = Date.now() - start;
    metrics.avgResponseTime =
      (metrics.avgResponseTime * (metrics.requests - 1) + duration) / metrics.requests;
  }
}
```

### 4. Use Incremental Scanning

```typescript
// Good: Only fetch new opportunities since last scan
const lastScan = await storage.getLastScanTime('sam_gov');
const postedFrom = lastScan.toLocaleDateString('en-US');

const url = `https://sam.gov/search/?index=opp&postedFrom=${postedFrom}`;
const newRFPs = await scrapingService.scrapePortal(url);

console.log(`Found ${newRFPs.length} new opportunities since ${postedFrom}`);
```

---

## Advanced Features

### Custom Search Filters

```typescript
// Search by NAICS code (IT services)
const itContractsUrl = 'https://sam.gov/search/?index=opp&naicsCode=541512';

// Search by state
const californiaUrl = 'https://sam.gov/search/?index=opp&state=CA';

// Search by set-aside
const smallBusinessUrl = 'https://sam.gov/search/?index=opp&typeOfSetAside=SBA';

// Combine filters
const complexUrl = 'https://sam.gov/search/?index=opp&naicsCode=541512&state=CA&postedFrom=01/01/2025';
```

### Document Processing

```typescript
// Download and process all RFP documents
const documents = await downloader.downloadRFPDocuments(noticeId, rfpId);

// Extract requirements from PDFs
for (const doc of documents) {
  if (doc.fileType === 'pdf') {
    const text = await pdfParser.extractText(doc.objectPath);
    const requirements = await aiService.extractRequirements(text);

    await storage.updateDocument(doc.id, {
      extractedText: text,
      parsedData: requirements
    });
  }
}
```

### Real-time Monitoring

```typescript
// WebSocket-based real-time updates
import { WebSocket } from 'ws';

const ws = new WebSocket('ws://localhost:3000/api/portals/sam-gov/stream');

ws.on('message', (data) => {
  const event = JSON.parse(data);

  if (event.type === 'rfp_discovered') {
    console.log('New RFP discovered:', event.data.title);
    // Trigger proposal generation
  }
});
```

---

## Resources

- **Official SAM.gov API Docs**: https://open.gsa.gov/api/opportunities-api/
- **SAM.gov Portal**: https://sam.gov
- **OpenAPI Specification**: https://open.gsa.gov/api/opportunities-api/v2/openapi.yaml
- **RFP Agent Integration Guide**: [docs/SAM_GOV_INTEGRATION.md](../SAM_GOV_INTEGRATION.md)
- **API Testing Tool**: https://api.sam.gov/opportunities/v2/search?api_key=YOUR_KEY

---

## Support

For SAM.gov integration support:

- **Integration Issues**: Open issue at https://github.com/VerticalLabs-ai/rfpagent/issues
- **SAM.gov API**: Contact GSA support at https://www.gsa.gov/about-us/organization/federal-acquisition-service/technology-transformation-services/integrated-award-environment-iae/sam
- **Documentation**: See [docs/SAM_GOV_INTEGRATION.md](../SAM_GOV_INTEGRATION.md) for technical details

---

*Happy Federal Contract Hunting! 🇺🇸*
