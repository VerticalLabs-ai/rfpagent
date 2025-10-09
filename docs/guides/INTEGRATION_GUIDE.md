# RFP Agent Integration Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Integration Patterns](#integration-patterns)
3. [Frontend Integration](#frontend-integration)
4. [Backend Integration](#backend-integration)
5. [Webhook Integration](#webhook-integration)
6. [Mobile Integration](#mobile-integration)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

## Getting Started

### System Requirements

- **Node.js**: 18.x or higher
- **Database**: PostgreSQL 14+ (Neon Database recommended)
- **Storage**: Google Cloud Storage or AWS S3
- **AI Provider**: OpenAI API with GPT-5 access
- **Browser Automation**: Browserbase or Puppeteer

### Environment Setup

```bash
# Clone the repository
git clone https://github.com/your-org/rfpagent.git
cd rfpagent

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env

# Required environment variables
DATABASE_URL="postgresql://user:password@localhost:5432/rfpagent"
OPENAI_API_KEY="sk-..."
GCS_BUCKET_NAME="rfpagent-documents"
BROWSERBASE_API_KEY="..."

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

## Integration Patterns

### Pattern 1: Embedded Widget

Embed RFP discovery directly in your application:

```html
<!-- Embed RFP Agent Widget -->
<div id="rfp-agent-widget"></div>

<script src="https://cdn.rfpagent.com/widget.js"></script>
<script>
  RFPAgent.init({
    container: '#rfp-agent-widget',
    apiKey: 'your-api-key',
    theme: 'light',
    features: ['discovery', 'proposals'],
    onRFPDiscovered: (rfp) => {
      console.log('New RFP discovered:', rfp);
    }
  });
</script>
```

### Pattern 2: Microservice Integration

Use RFP Agent as a microservice:

```javascript
// Your application
import { RFPAgentClient } from '@rfpagent/client';

const rfpAgent = new RFPAgentClient({
  apiUrl: process.env.RFP_AGENT_URL,
  apiKey: process.env.RFP_AGENT_API_KEY
});

// Discover RFPs
const rfps = await rfpAgent.discover({
  portals: ['austin', 'philadelphia'],
  categories: ['technology', 'consulting'],
  minValue: 100000
});

// Generate proposal
const proposal = await rfpAgent.generateProposal({
  rfpId: rfps[0].id,
  companyProfile: yourCompanyProfile
});
```

### Pattern 3: Webhook Integration

Receive real-time updates via webhooks:

```javascript
// Configure webhook endpoint
app.post('/webhooks/rfp-agent', (req, res) => {
  const { event, data } = req.body;

  switch (event) {
    case 'rfp.discovered':
      handleNewRFP(data.rfp);
      break;
    case 'proposal.generated':
      handleProposalComplete(data.proposal);
      break;
    case 'submission.completed':
      handleSubmissionComplete(data.submission);
      break;
  }

  res.status(200).send('OK');
});

// Register webhook with RFP Agent
await rfpAgent.registerWebhook({
  url: 'https://your-app.com/webhooks/rfp-agent',
  events: ['rfp.discovered', 'proposal.generated', 'submission.completed']
});
```

### Pattern 4: Scheduled Sync

Periodically sync RFPs with your system:

```javascript
// Cron job for RFP sync
import cron from 'node-cron';

cron.schedule('0 */4 * * *', async () => {
  console.log('Starting RFP sync...');

  // Get new RFPs since last sync
  const lastSync = await getLastSyncTime();
  const newRFPs = await rfpAgent.getRFPs({
    discoveredAfter: lastSync,
    status: 'discovered'
  });

  // Process each RFP
  for (const rfp of newRFPs) {
    await processRFP(rfp);
  }

  await updateLastSyncTime();
  console.log(`Synced ${newRFPs.length} RFPs`);
});
```

## Frontend Integration

### React Integration

```typescript
// hooks/useRFPAgent.ts
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

export function useRFPAgent() {
  const baseURL = process.env.NEXT_PUBLIC_API_URL;

  // Fetch RFPs
  const { data: rfps, isLoading } = useQuery({
    queryKey: ['rfps'],
    queryFn: async () => {
      const response = await fetch(`${baseURL}/api/rfps`);
      return response.json();
    }
  });

  // Submit manual RFP
  const submitRFP = useMutation({
    mutationFn: async (data: { url: string; notes?: string }) => {
      const response = await fetch(`${baseURL}/api/rfps/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    }
  });

  return { rfps, isLoading, submitRFP };
}

// components/RFPList.tsx
import { useRFPAgent } from '../hooks/useRFPAgent';

export function RFPList() {
  const { rfps, isLoading } = useRFPAgent();

  if (isLoading) return <div>Loading RFPs...</div>;

  return (
    <div className="rfp-list">
      {rfps?.rfps.map((rfp) => (
        <div key={rfp.id} className="rfp-card">
          <h3>{rfp.title}</h3>
          <p>{rfp.agency}</p>
          <span>${rfp.estimatedValue}</span>
          <time>{new Date(rfp.deadline).toLocaleDateString()}</time>
        </div>
      ))}
    </div>
  );
}

// components/ManualRFPForm.tsx
export function ManualRFPForm() {
  const { submitRFP } = useRFPAgent();
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await submitRFP.mutateAsync({ url, notes });
      console.log('RFP submitted:', result);
      // Navigate to RFP details or show success message
    } catch (error) {
      console.error('Failed to submit RFP:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="RFP URL"
        required
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
      />
      <button type="submit" disabled={submitRFP.isPending}>
        {submitRFP.isPending ? 'Submitting...' : 'Submit RFP'}
      </button>
    </form>
  );
}
```

### Real-time Updates with SSE

```typescript
// hooks/usePortalScan.ts
import { useEffect, useState } from 'react';

interface ScanEvent {
  type: string;
  data: any;
}

export function usePortalScan(portalId: string, scanId: string) {
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  useEffect(() => {
    if (!portalId || !scanId) return;

    const eventSource = new EventSource(
      `/api/portals/${portalId}/scan/stream?scanId=${scanId}`
    );

    eventSource.onopen = () => {
      setStatus('connected');
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEvents(prev => [...prev, data]);

      if (data.type === 'scan_completed' || data.type === 'scan_failed') {
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setStatus('error');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [portalId, scanId]);

  return { events, status };
}

// components/ScanMonitor.tsx
export function ScanMonitor({ portalId, scanId }: Props) {
  const { events, status } = usePortalScan(portalId, scanId);

  const progress = events.find(e => e.type === 'step_update')?.progress || 0;
  const rfpsDiscovered = events.filter(e => e.type === 'rfp_discovered').length;

  return (
    <div className="scan-monitor">
      <h3>Portal Scan Progress</h3>
      <div className="progress-bar">
        <div style={{ width: `${progress}%` }} />
      </div>
      <p>RFPs Discovered: {rfpsDiscovered}</p>

      <div className="event-log">
        {events.map((event, i) => (
          <div key={i} className="event">
            <span className="event-type">{event.type}</span>
            <pre>{JSON.stringify(event.data, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Vue.js Integration

```vue
<!-- RFPList.vue -->
<template>
  <div class="rfp-list">
    <h2>Available RFPs</h2>

    <div v-if="loading">Loading...</div>

    <div v-else class="rfp-grid">
      <div
        v-for="rfp in rfps"
        :key="rfp.id"
        class="rfp-card"
        @click="selectRFP(rfp)"
      >
        <h3>{{ rfp.title }}</h3>
        <p>{{ rfp.agency }}</p>
        <div class="rfp-meta">
          <span class="value">${{ formatValue(rfp.estimatedValue) }}</span>
          <span class="deadline">{{ formatDate(rfp.deadline) }}</span>
        </div>
        <div class="status-badge" :class="rfp.status">
          {{ rfp.status }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const rfps = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const response = await fetch('/api/rfps');
    const data = await response.json();
    rfps.value = data.rfps;
  } catch (error) {
    console.error('Failed to fetch RFPs:', error);
  } finally {
    loading.value = false;
  }
});

function selectRFP(rfp: any) {
  router.push(`/rfps/${rfp.id}`);
}

function formatValue(value: string) {
  return parseFloat(value).toLocaleString();
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString();
}
</script>
```

## Backend Integration

### Node.js/Express Integration

```javascript
// services/rfpService.js
import axios from 'axios';

class RFPService {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.RFP_AGENT_URL,
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });
  }

  async discoverRFPs(filters = {}) {
    const { data } = await this.client.get('/api/rfps', { params: filters });
    return data;
  }

  async generateProposal(rfpId, companyProfileId, options = {}) {
    const { data } = await this.client.post('/api/proposals/enhanced/generate', {
      rfpId,
      companyProfileId,
      options
    });
    return data;
  }

  async monitorProposalGeneration(sessionId) {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `${process.env.RFP_AGENT_URL}/api/proposals/submission-materials/stream/${sessionId}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.status === 'completed') {
          eventSource.close();
          resolve(data);
        } else if (data.status === 'failed') {
          eventSource.close();
          reject(new Error(data.error));
        }
      };

      eventSource.onerror = (error) => {
        eventSource.close();
        reject(error);
      };
    });
  }

  async submitProposal(submissionData) {
    const { data } = await this.client.post('/api/submissions', submissionData);
    return data;
  }
}

export default new RFPService();

// routes/rfp.routes.js
import express from 'express';
import rfpService from '../services/rfpService.js';

const router = express.Router();

router.post('/discover', async (req, res) => {
  try {
    const { filters } = req.body;
    const rfps = await rfpService.discoverRFPs(filters);

    // Store in your database
    await storeRFPs(rfps);

    res.json({ success: true, rfps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-proposal', async (req, res) => {
  try {
    const { rfpId, companyProfileId } = req.body;

    // Start proposal generation
    const { sessionId } = await rfpService.generateProposal(
      rfpId,
      companyProfileId
    );

    // Monitor in background
    rfpService.monitorProposalGeneration(sessionId)
      .then(async (result) => {
        // Notify user via email/webhook
        await notifyProposalComplete(result);
      })
      .catch(console.error);

    res.json({ success: true, sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Python/FastAPI Integration

```python
# services/rfp_service.py
from typing import Dict, List, Optional
import httpx
import asyncio
from sse_client import SSEClient

class RFPAgentService:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url)

    async def discover_rfps(
        self,
        filters: Optional[Dict] = None
    ) -> Dict:
        response = await self.client.get(
            '/api/rfps',
            params=filters or {}
        )
        response.raise_for_status()
        return response.json()

    async def generate_proposal(
        self,
        rfp_id: str,
        company_profile_id: str,
        options: Optional[Dict] = None
    ) -> Dict:
        response = await self.client.post(
            '/api/proposals/enhanced/generate',
            json={
                'rfpId': rfp_id,
                'companyProfileId': company_profile_id,
                'options': options or {}
            }
        )
        response.raise_for_status()
        return response.json()

    async def monitor_proposal_generation(
        self,
        session_id: str,
        callback=None
    ):
        url = f"{self.base_url}/api/proposals/submission-materials/stream/{session_id}"

        async with httpx.AsyncClient() as client:
            async with client.stream('GET', url) as response:
                async for line in response.aiter_lines():
                    if line.startswith('data: '):
                        data = json.loads(line[6:])

                        if callback:
                            await callback(data)

                        if data['status'] in ['completed', 'failed']:
                            break

    async def submit_proposal(self, submission_data: Dict) -> Dict:
        response = await self.client.post(
            '/api/submissions',
            json=submission_data
        )
        response.raise_for_status()
        return response.json()

# main.py
from fastapi import FastAPI, BackgroundTasks
from services.rfp_service import RFPAgentService

app = FastAPI()
rfp_service = RFPAgentService(base_url="http://localhost:3000")

@app.post("/discover-rfps")
async def discover_rfps(filters: Dict = None):
    rfps = await rfp_service.discover_rfps(filters)
    # Store in database
    await store_rfps(rfps)
    return {"success": True, "rfps": rfps}

@app.post("/generate-proposal")
async def generate_proposal(
    rfp_id: str,
    company_profile_id: str,
    background_tasks: BackgroundTasks
):
    result = await rfp_service.generate_proposal(
        rfp_id,
        company_profile_id
    )

    # Monitor in background
    async def monitor_callback(data):
        if data['status'] == 'completed':
            await notify_proposal_complete(data)

    background_tasks.add_task(
        rfp_service.monitor_proposal_generation,
        result['sessionId'],
        monitor_callback
    )

    return {"success": True, "sessionId": result['sessionId']}
```

### Go Integration

```go
// pkg/rfpagent/client.go
package rfpagent

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type Client struct {
    BaseURL    string
    HTTPClient *http.Client
}

type RFP struct {
    ID             string    `json:"id"`
    Title          string    `json:"title"`
    Agency         string    `json:"agency"`
    EstimatedValue string    `json:"estimatedValue"`
    Deadline       time.Time `json:"deadline"`
    Status         string    `json:"status"`
}

func NewClient(baseURL string) *Client {
    return &Client{
        BaseURL: baseURL,
        HTTPClient: &http.Client{
            Timeout: 30 * time.Second,
        },
    }
}

func (c *Client) GetRFPs(filters map[string]string) ([]RFP, error) {
    url := fmt.Sprintf("%s/api/rfps", c.BaseURL)

    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return nil, err
    }

    // Add query parameters
    q := req.URL.Query()
    for key, value := range filters {
        q.Add(key, value)
    }
    req.URL.RawQuery = q.Encode()

    resp, err := c.HTTPClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result struct {
        RFPs []RFP `json:"rfps"`
    }

    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    return result.RFPs, nil
}

func (c *Client) GenerateProposal(
    rfpID string,
    companyProfileID string,
    options map[string]interface{},
) (string, error) {
    url := fmt.Sprintf("%s/api/proposals/enhanced/generate", c.BaseURL)

    body := map[string]interface{}{
        "rfpId":            rfpID,
        "companyProfileId": companyProfileID,
        "options":          options,
    }

    jsonBody, err := json.Marshal(body)
    if err != nil {
        return "", err
    }

    resp, err := c.HTTPClient.Post(url, "application/json", bytes.NewBuffer(jsonBody))
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    var result struct {
        SessionID string `json:"sessionId"`
    }

    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return "", err
    }

    return result.SessionID, nil
}

// main.go
package main

import (
    "log"
    "myapp/pkg/rfpagent"
)

func main() {
    client := rfpagent.NewClient("http://localhost:3000")

    // Discover RFPs
    rfps, err := client.GetRFPs(map[string]string{
        "status":   "discovered",
        "category": "technology",
    })
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Found %d RFPs\n", len(rfps))

    // Generate proposal for first RFP
    if len(rfps) > 0 {
        sessionID, err := client.GenerateProposal(
            rfps[0].ID,
            "company-profile-123",
            map[string]interface{}{
                "generatePricing":    true,
                "generateCompliance": true,
            },
        )
        if err != nil {
            log.Fatal(err)
        }

        log.Printf("Proposal generation started: %s\n", sessionID)
    }
}
```

## Webhook Integration

### Setting Up Webhooks

```javascript
// Register webhook
const webhook = await fetch('http://localhost:3000/api/webhooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://your-app.com/webhooks/rfp-agent',
    events: [
      'rfp.discovered',
      'rfp.updated',
      'proposal.generated',
      'proposal.approved',
      'submission.completed'
    ],
    secret: 'your-webhook-secret'
  })
});
```

### Webhook Handler

```javascript
import crypto from 'crypto';
import express from 'express';

const app = express();

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

app.post('/webhooks/rfp-agent', express.json(), async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  // Verify signature
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, data, timestamp } = req.body;

  try {
    switch (event) {
      case 'rfp.discovered':
        await handleRFPDiscovered(data.rfp);
        break;

      case 'proposal.generated':
        await handleProposalGenerated(data.proposal);
        break;

      case 'submission.completed':
        await handleSubmissionCompleted(data.submission);
        break;

      default:
        console.log('Unknown event:', event);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

async function handleRFPDiscovered(rfp) {
  console.log('New RFP discovered:', rfp.title);

  // Store in database
  await db.rfps.create(rfp);

  // Notify relevant team members
  await notifyTeam('New RFP discovered', {
    title: rfp.title,
    agency: rfp.agency,
    value: rfp.estimatedValue,
    url: `/rfps/${rfp.id}`
  });

  // Auto-generate proposal if criteria met
  if (shouldAutoGenerateProposal(rfp)) {
    await generateProposal(rfp.id);
  }
}

async function handleProposalGenerated(proposal) {
  console.log('Proposal generated:', proposal.id);

  // Update database
  await db.proposals.update(proposal.id, proposal);

  // Send for review
  await sendForReview(proposal);

  // Notify proposal manager
  await notifyProposalManager(proposal);
}

async function handleSubmissionCompleted(submission) {
  console.log('Submission completed:', submission.id);

  // Update tracking systems
  await updateSubmissionStatus(submission);

  // Generate reports
  await generateSubmissionReport(submission);

  // Archive documents
  await archiveSubmissionDocuments(submission);
}
```

## Mobile Integration

### React Native

```typescript
// services/RFPAgentService.ts
import { EventSource } from 'react-native-sse';

class RFPAgentService {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async getRFPs(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(
      `${this.baseURL}/api/rfps?${params}`
    );
    return response.json();
  }

  async submitRFP(url: string, notes?: string) {
    const response = await fetch(`${this.baseURL}/api/rfps/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, userNotes: notes })
    });
    return response.json();
  }

  monitorScan(portalId: string, scanId: string, onEvent: (event: any) => void) {
    const eventSource = new EventSource(
      `${this.baseURL}/api/portals/${portalId}/scan/stream?scanId=${scanId}`
    );

    eventSource.addEventListener('message', (event) => {
      onEvent(JSON.parse(event.data));
    });

    return () => eventSource.close();
  }
}

export default new RFPAgentService('http://localhost:3000');

// components/RFPList.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, Text, View, TouchableOpacity } from 'react-native';
import RFPAgentService from '../services/RFPAgentService';

export function RFPList() {
  const [rfps, setRFPs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRFPs();
  }, []);

  async function loadRFPs() {
    try {
      const data = await RFPAgentService.getRFPs();
      setRFPs(data.rfps);
    } catch (error) {
      console.error('Failed to load RFPs:', error);
    } finally {
      setLoading(false);
    }
  }

  const renderRFP = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.rfpCard}
      onPress={() => navigation.navigate('RFPDetail', { rfpId: item.id })}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.agency}>{item.agency}</Text>
      <View style={styles.meta}>
        <Text style={styles.value}>${item.estimatedValue}</Text>
        <Text style={styles.deadline}>
          {new Date(item.deadline).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={rfps}
      renderItem={renderRFP}
      keyExtractor={(item) => item.id}
      refreshing={loading}
      onRefresh={loadRFPs}
    />
  );
}
```

### Flutter/Dart

```dart
// lib/services/rfp_agent_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class RFPAgentService {
  final String baseUrl;

  RFPAgentService(this.baseUrl);

  Future<Map<String, dynamic>> getRFPs({Map<String, String>? filters}) async {
    final uri = Uri.parse('$baseUrl/api/rfps').replace(queryParameters: filters);
    final response = await http.get(uri);

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load RFPs');
    }
  }

  Future<Map<String, dynamic>> submitRFP(String url, {String? notes}) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/rfps/manual'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'url': url,
        'userNotes': notes,
      }),
    );

    if (response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to submit RFP');
    }
  }

  Stream<Map<String, dynamic>> monitorScan(String portalId, String scanId) async* {
    final client = http.Client();
    final request = http.Request(
      'GET',
      Uri.parse('$baseUrl/api/portals/$portalId/scan/stream?scanId=$scanId'),
    );

    final response = await client.send(request);
    await for (var chunk in response.stream.transform(utf8.decoder)) {
      if (chunk.startsWith('data: ')) {
        final data = chunk.substring(6);
        yield json.decode(data);
      }
    }
  }
}

// lib/screens/rfp_list_screen.dart
import 'package:flutter/material.dart';
import '../services/rfp_agent_service.dart';

class RFPListScreen extends StatefulWidget {
  @override
  _RFPListScreenState createState() => _RFPListScreenState();
}

class _RFPListScreenState extends State<RFPListScreen> {
  final RFPAgentService _service = RFPAgentService('http://localhost:3000');
  List<dynamic> _rfps = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadRFPs();
  }

  Future<void> _loadRFPs() async {
    try {
      final data = await _service.getRFPs();
      setState(() {
        _rfps = data['rfps'];
        _loading = false;
      });
    } catch (e) {
      print('Error loading RFPs: $e');
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('RFPs')),
      body: _loading
          ? Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _rfps.length,
              itemBuilder: (context, index) {
                final rfp = _rfps[index];
                return ListTile(
                  title: Text(rfp['title']),
                  subtitle: Text(rfp['agency']),
                  trailing: Text('\$${rfp['estimatedValue']}'),
                  onTap: () {
                    Navigator.pushNamed(
                      context,
                      '/rfp-detail',
                      arguments: rfp['id'],
                    );
                  },
                );
              },
            ),
    );
  }
}
```

## Testing

### Unit Tests

```typescript
// __tests__/rfpService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RFPService } from '../services/rfpService';

describe('RFPService', () => {
  let service: RFPService;

  beforeEach(() => {
    service = new RFPService('http://localhost:3000');
  });

  it('should fetch RFPs with filters', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rfps: [
          { id: '1', title: 'Test RFP', agency: 'Test Agency' }
        ],
        total: 1
      })
    });

    const result = await service.getRFPs({ status: 'discovered' });

    expect(result.rfps).toHaveLength(1);
    expect(result.rfps[0].title).toBe('Test RFP');
  });

  it('should handle API errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' })
    });

    await expect(service.getRFPs()).rejects.toThrow();
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/rfpWorkflow.test.ts
import { describe, it, expect } from 'vitest';
import { RFPAgentClient } from '../client';

describe('RFP Workflow Integration', () => {
  const client = new RFPAgentClient('http://localhost:3000');

  it('should complete full RFP-to-submission workflow', async () => {
    // 1. Submit RFP
    const submitResult = await client.submitRFP(
      'https://test-portal.gov/rfp/123',
      'Test RFP'
    );
    expect(submitResult.success).toBe(true);

    const rfpId = submitResult.rfpId;

    // 2. Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    const rfp = await client.getRFP(rfpId);
    expect(rfp.status).toBe('parsing');

    // 3. Generate proposal
    const proposalResult = await client.generateProposal(
      rfpId,
      'company-profile-123'
    );
    expect(proposalResult.success).toBe(true);

    // 4. Monitor generation (simplified)
    await new Promise(resolve => setTimeout(resolve, 10000));

    const proposals = await client.getProposals(rfpId);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].status).toBe('draft');
  }, 30000); // 30 second timeout
});
```

### E2E Tests with Playwright

```typescript
// e2e/rfp-submission.spec.ts
import { test, expect } from '@playwright/test';

test.describe('RFP Submission Flow', () => {
  test('user can submit and process RFP', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000');

    // Click "Add RFP" button
    await page.click('button:has-text("Add RFP")');

    // Fill in RFP URL
    await page.fill('input[name="url"]', 'https://test-portal.gov/rfp/123');
    await page.fill('textarea[name="notes"]', 'Test RFP submission');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success message
    await expect(page.locator('.success-message')).toBeVisible();

    // Check RFP appears in list
    await page.goto('http://localhost:3000/rfps');
    await expect(page.locator('.rfp-card').first()).toContainText('Test RFP');
  });

  test('user can generate proposal', async ({ page }) => {
    await page.goto('http://localhost:3000/rfps/test-rfp-id');

    // Click generate proposal
    await page.click('button:has-text("Generate Proposal")');

    // Wait for generation to complete
    await expect(page.locator('.proposal-status')).toContainText('Completed', {
      timeout: 60000
    });

    // Verify proposal is created
    await expect(page.locator('.proposal-card')).toBeVisible();
  });
});
```

## Deployment

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build application
RUN pnpm build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  rfp-agent:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GCS_BUCKET_NAME=${GCS_BUCKET_NAME}
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=rfpagent
      - POSTGRES_USER=rfpagent
      - POSTGRES_PASSWORD=${DB_PASSWORD}

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rfp-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rfp-agent
  template:
    metadata:
      labels:
        app: rfp-agent
    spec:
      containers:
      - name: rfp-agent
        image: rfpagent/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: rfp-agent-secrets
              key: database-url
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: rfp-agent-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/system/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/system/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: rfp-agent-service
spec:
  selector:
    app: rfp-agent
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Troubleshooting

### Common Issues

#### 1. CORS Errors

```javascript
// server/index.ts
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
```

#### 2. Session Issues

```javascript
// Ensure cookies are set correctly
const response = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include', // Important!
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
```

#### 3. SSE Connection Drops

```javascript
// Implement reconnection logic
function connectSSE(url, onMessage, maxRetries = 3) {
  let retries = 0;

  function connect() {
    const eventSource = new EventSource(url);

    eventSource.onmessage = onMessage;

    eventSource.onerror = () => {
      eventSource.close();

      if (retries < maxRetries) {
        retries++;
        const delay = Math.pow(2, retries) * 1000;
        setTimeout(connect, delay);
      }
    };

    return eventSource;
  }

  return connect();
}
```

### Debug Mode

```javascript
// Enable debug logging
const DEBUG = process.env.DEBUG === 'true';

function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
  }
}

// Use in code
debugLog('Making API request:', endpoint, params);
```

### Performance Monitoring

```javascript
// Add performance tracking
async function trackAPICall(name, fn) {
  const start = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - start;

    console.log(`API Call ${name}: ${duration}ms`);

    // Send to monitoring service
    if (window.analytics) {
      window.analytics.track('API Call', {
        name,
        duration,
        success: true
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    console.error(`API Call ${name} failed: ${duration}ms`, error);

    if (window.analytics) {
      window.analytics.track('API Call', {
        name,
        duration,
        success: false,
        error: error.message
      });
    }

    throw error;
  }
}

// Usage
const rfps = await trackAPICall('getRFPs', () =>
  client.getRFPs({ status: 'discovered' })
);
```

## Support

For integration support:
- Email: integrations@rfpagent.com
- Slack: [RFP Agent Community](https://rfpagent.slack.com)
- Documentation: https://docs.rfpagent.com
- GitHub: https://github.com/rfpagent/api
