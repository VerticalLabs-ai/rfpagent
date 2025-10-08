# RFP Agent Platform - Architecture Diagrams

This document contains visual architecture diagrams in Mermaid format. These diagrams can be rendered in GitHub, VS Code (with Mermaid extension), or any Mermaid-compatible viewer.

---

## 1. Current System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React Frontend<br/>Vite + TanStack Query]
    end

    subgraph "API Layer"
        API[Express.js API Server<br/>Single Instance]
    end

    subgraph "Agent System - Current"
        PO[Primary Orchestrator<br/>Claude Sonnet 4.5]

        PM[Portal Manager]
        PPM[Proposal Manager]
        RM[Research Manager]

        PS[Portal Scanner]
        PMon[Portal Monitor]
        CG[Content Generator]
        CC[Compliance Checker]
        DP[Document Processor]
        MA[Market Analyst]
        HA[Historical Analyzer]

        PO --> PM
        PO --> PPM
        PO --> RM

        PM --> PS
        PM --> PMon
        PPM --> CG
        PPM --> CC
        PPM --> DP
        RM --> MA
        RM --> HA
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>Neon Database)]
        GCS[Google Cloud Storage<br/>Documents]
    end

    subgraph "External Services"
        BB[Browserbase<br/>Browser Automation]
        OAI[OpenAI API<br/>GPT-5]
    end

    UI -->|HTTP/REST| API
    API --> PO
    API --> PG
    API --> GCS
    PS --> BB
    PO --> OAI
    CG --> OAI
```

---

## 2. Proposed High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Client<br/>React]
        MOBILE[Mobile Client<br/>Future]
    end

    subgraph "Edge Layer"
        LB[Load Balancer<br/>AWS ALB / Cloudflare]
        CDN[CDN<br/>Static Assets]
        WAF[WAF<br/>Security]
    end

    subgraph "Application Layer"
        API1[API Server 1]
        API2[API Server 2]
        API3[API Server N]
        WS[WebSocket Gateway<br/>Socket.io]
    end

    subgraph "Processing Layer"
        BULL[BullMQ<br/>Task Queue]
        AGENT[Agent Pool<br/>Kubernetes<br/>Auto-scaling 2-50]
    end

    subgraph "Caching Layer"
        REDIS[Redis Cluster<br/>Cache + Pub/Sub<br/>Sessions]
    end

    subgraph "Data Layer"
        PG_PRIMARY[(PostgreSQL<br/>Primary)]
        PG_REPLICA1[(Read Replica 1<br/>Analytics)]
        PG_REPLICA2[(Read Replica 2<br/>App Queries)]
        ES[(Elasticsearch<br/>Search + Analytics)]
        TS[(TimescaleDB<br/>Metrics)]
        S3[(Object Storage<br/>S3/GCS)]
    end

    subgraph "External Services"
        BB[Browserbase<br/>Session Pool]
        OAI[OpenAI API<br/>GPT-5]
    end

    subgraph "Observability"
        PROM[Prometheus<br/>Metrics]
        GRAF[Grafana<br/>Dashboards]
        DD[Datadog<br/>APM + Traces]
    end

    WEB --> CDN
    WEB --> LB
    MOBILE --> LB

    LB --> WAF
    WAF --> API1
    WAF --> API2
    WAF --> API3
    WAF --> WS

    API1 --> REDIS
    API2 --> REDIS
    API3 --> REDIS

    API1 --> BULL
    API2 --> BULL
    API3 --> BULL

    BULL --> AGENT

    API1 --> PG_REPLICA2
    API2 --> PG_REPLICA2

    AGENT --> PG_PRIMARY
    AGENT --> BB
    AGENT --> OAI

    PG_PRIMARY -->|Replication| PG_REPLICA1
    PG_PRIMARY -->|Replication| PG_REPLICA2

    AGENT --> ES
    AGENT --> S3

    API1 --> PROM
    AGENT --> DD
    PROM --> GRAF
```

---

## 3. Agent System Architecture (3-Tier Hierarchy)

```mermaid
graph TB
    subgraph "Tier 1: Orchestrator Layer (HA)"
        PO1[Primary Orchestrator<br/>Instance 1 - Active]
        PO2[Primary Orchestrator<br/>Instance 2 - Standby]

        PO1 -.->|Redis Sync| PO2
    end

    subgraph "Tier 2: Manager Layer (Pooled)"
        subgraph "Portal Manager Pool"
            PM1[Instance 1]
            PM2[Instance 2]
            PM3[Instance 3]
            PM4[Instance 4]
        end

        subgraph "Proposal Manager Pool"
            PPM1[Instance 1]
            PPM2[Instance 2]
            PPM3[Instance 3]
            PPM4[Instance 4]
        end

        subgraph "Research Manager Pool"
            RM1[Instance 1]
            RM2[Instance 2]
            RM3[Instance 3]
            RM4[Instance 4]
        end
    end

    subgraph "Tier 3: Specialist Layer (Auto-scaling)"
        subgraph "Portal Specialists"
            PS1[Scanner 1]
            PS2[Scanner 2]
            PS3[Scanner N]
            PMon1[Monitor 1]
            PMon2[Monitor 2]
        end

        subgraph "Proposal Specialists"
            CG1[Generator 1]
            CG2[Generator 2]
            CG3[Generator N]
            CC1[Checker 1]
            CC2[Checker 2]
            DP1[Processor 1]
            DP2[Processor 2]
        end

        subgraph "Research Specialists"
            MA1[Market Analyst 1]
            MA2[Market Analyst 2]
            HA1[Historical 1]
            HA2[Historical 2]
        end
    end

    subgraph "Infrastructure"
        QUEUE[BullMQ<br/>Task Queue]
        REDIS[Redis<br/>Coordination]
        DB[(PostgreSQL)]
    end

    PO1 -->|Delegate| QUEUE
    QUEUE --> PM1 & PM2 & PM3 & PM4
    QUEUE --> PPM1 & PPM2 & PPM3 & PPM4
    QUEUE --> RM1 & RM2 & RM3 & RM4

    PM1 -->|Request| PS1 & PS2 & PMon1
    PPM1 -->|Request| CG1 & CG2 & CC1 & DP1
    RM1 -->|Request| MA1 & HA1

    PS1 --> REDIS
    CG1 --> REDIS
    MA1 --> REDIS

    PS1 --> DB
    CG1 --> DB

    style PO1 fill:#ff6b6b
    style PO2 fill:#ffa07a
    style PM1 fill:#4ecdc4
    style PM2 fill:#4ecdc4
    style PPM1 fill:#4ecdc4
    style PPM2 fill:#4ecdc4
    style RM1 fill:#4ecdc4
    style RM2 fill:#4ecdc4
    style PS1 fill:#95e1d3
    style CG1 fill:#95e1d3
    style MA1 fill:#95e1d3
```

---

## 4. Real-Time Communication Flow

```mermaid
sequenceDiagram
    participant User as User Browser
    participant WS as WebSocket Gateway
    participant Redis as Redis Pub/Sub
    participant Agent as Agent Service
    participant DB as PostgreSQL

    User->>WS: Connect (WSS)
    WS->>WS: Authenticate User
    WS->>WS: Join Room: user:123
    WS->>User: Connection Established

    Note over Agent,DB: Agent discovers new RFP
    Agent->>DB: Save RFP
    DB-->>Agent: RFP Saved
    Agent->>Redis: Publish: rfp:discovered:user:123

    Redis->>WS: Receive Event
    WS->>User: Emit: rfp:discovered (Real-time)

    User->>User: Show Notification

    Note over Agent,DB: Portal scan in progress
    loop Every 5 seconds
        Agent->>Redis: Publish: scan:progress:scan123
        Redis->>WS: Receive Progress
        WS->>User: Emit: scan:progress
        User->>User: Update Progress Bar
    end

    Agent->>Redis: Publish: scan:completed:scan123
    Redis->>WS: Receive Completion
    WS->>User: Emit: scan:completed
    User->>User: Show Success Message
```

---

## 5. Task Queue and Agent Coordination Flow

```mermaid
flowchart TB
    START([API Request]) --> VALIDATE{Valid Request?}
    VALIDATE -->|No| ERROR[Return Error]
    VALIDATE -->|Yes| CREATE[Create Work Item]

    CREATE --> PRIORITY{Priority Level}
    PRIORITY -->|Urgent| URGENT_Q[Urgent Queue<br/>Priority: 10]
    PRIORITY -->|High| HIGH_Q[High Priority Queue<br/>Priority: 8]
    PRIORITY -->|Medium| NORMAL_Q[Normal Queue<br/>Priority: 5]
    PRIORITY -->|Low| LOW_Q[Low Priority Queue<br/>Priority: 1]

    URGENT_Q --> BULL[BullMQ Scheduler]
    HIGH_Q --> BULL
    NORMAL_Q --> BULL
    LOW_Q --> BULL

    BULL --> ASSIGN{Assign to Agent}
    ASSIGN --> AGENT1[Agent Instance 1<br/>Status: Idle]
    ASSIGN --> AGENT2[Agent Instance 2<br/>Status: Busy]
    ASSIGN --> AGENT3[Agent Instance N<br/>Status: Idle]

    AGENT1 --> EXECUTE[Execute Task]
    AGENT3 --> EXECUTE

    EXECUTE --> RESULT{Success?}
    RESULT -->|Yes| SUCCESS[Update Status<br/>Return Result]
    RESULT -->|No| RETRY{Retry Count < Max?}

    RETRY -->|Yes| BACKOFF[Exponential Backoff<br/>2s → 4s → 8s → 16s]
    BACKOFF --> BULL

    RETRY -->|No| DLQ[Dead Letter Queue<br/>Manual Review]

    SUCCESS --> NOTIFY[Notify via WebSocket]
    NOTIFY --> END([Complete])

    DLQ --> ALERT[Alert On-Call Engineer]
    ALERT --> END

    ERROR --> END

    style START fill:#90ee90
    style END fill:#ff6b6b
    style SUCCESS fill:#4ecdc4
    style DLQ fill:#ffa07a
    style URGENT_Q fill:#ff6b6b
    style HIGH_Q fill:#ffa500
    style NORMAL_Q fill:#4ecdc4
    style LOW_Q fill:#95e1d3
```

---

## 6. Browser Automation Architecture

```mermaid
graph TB
    subgraph "Request Layer"
        API[API Server]
        QUEUE[BullMQ<br/>Portal Scan Queue]
    end

    subgraph "Session Management"
        SM[Browser Session Manager]
        POOL[Session Pool<br/>Pre-warmed: 10<br/>Max: 100]

        SM --> POOL
    end

    subgraph "Scraping Engine"
        RETRY[Retry Handler<br/>Exponential Backoff]
        CB[Circuit Breaker<br/>Per Portal]
        FALLBACK[Fallback Chain]

        RETRY --> CB
        CB --> FALLBACK
    end

    subgraph "Browserbase Cloud"
        BB1[Browser Instance 1]
        BB2[Browser Instance 2]
        BB3[Browser Instance N]

        BB1 -.->|Anti-Detection| BB1
        BB2 -.->|Anti-Detection| BB2
    end

    subgraph "Extraction Layer"
        AI[AI Extraction<br/>GPT-5 Vision]
        CSS[CSS Selector<br/>Fallback 1]
        XPATH[XPath<br/>Fallback 2]
        OCR[OCR<br/>Fallback 3]
        MANUAL[Manual Review<br/>Fallback 4]

        AI -->|Fails| CSS
        CSS -->|Fails| XPATH
        XPATH -->|Fails| OCR
        OCR -->|Fails| MANUAL
    end

    subgraph "Data Pipeline"
        VALIDATE[Validate Data]
        ENRICH[Enrich Metadata]
        SAVE[(Save to DB)]
        CACHE[Cache Results]
    end

    API --> QUEUE
    QUEUE --> SM
    SM --> RETRY

    FALLBACK --> BB1
    FALLBACK --> BB2
    FALLBACK --> BB3

    BB1 --> AI
    BB2 --> AI
    BB3 --> AI

    AI --> VALIDATE
    CSS --> VALIDATE
    XPATH --> VALIDATE
    OCR --> VALIDATE
    MANUAL --> VALIDATE

    VALIDATE --> ENRICH
    ENRICH --> SAVE
    ENRICH --> CACHE

    style AI fill:#4ecdc4
    style CSS fill:#95e1d3
    style XPATH fill:#95e1d3
    style OCR fill:#95e1d3
    style MANUAL fill:#ffa07a
```

---

## 7. SAFLA Learning System Architecture

```mermaid
graph TB
    subgraph "Data Collection"
        AGENTS[All Agent Instances]
        EVENTS[Learning Events<br/>Success/Failure]

        AGENTS --> EVENTS
    end

    subgraph "Pattern Recognition"
        COLLECT[Event Collector<br/>Last 500 Events]
        ANALYZE[GPT-5 Analysis<br/>Pattern Detection]
        CLUSTER[Clustering<br/>Similar Patterns]
        CORRELATION[Correlation Analysis<br/>Success Factors]

        EVENTS --> COLLECT
        COLLECT --> ANALYZE
        ANALYZE --> CLUSTER
        CLUSTER --> CORRELATION
    end

    subgraph "Strategy Management"
        CANDIDATE[Candidate Strategies<br/>Confidence < 0.5]
        TESTING[A/B Testing Phase<br/>20% Traffic]
        VALIDATED[Validated Strategies<br/>Confidence > 0.7]
        PRODUCTION[Production<br/>100% Traffic]

        CORRELATION --> CANDIDATE
        CANDIDATE -->|Statistical Test| TESTING
        TESTING -->|Significant Improvement| VALIDATED
        VALIDATED --> PRODUCTION

        TESTING -->|No Improvement| DEPRECATED[Deprecated]
    end

    subgraph "Knowledge Distribution"
        KB[(Knowledge Base<br/>PostgreSQL)]
        REDIS_PUB[Redis Pub/Sub<br/>Real-time]
        SYNC[Agent Sync<br/>On Startup]

        PRODUCTION --> KB
        KB --> REDIS_PUB
        KB --> SYNC

        REDIS_PUB --> AGENTS
        SYNC --> AGENTS
    end

    subgraph "Monitoring"
        METRICS[Strategy Metrics<br/>Success Rate<br/>Application Count]
        DASHBOARD[SAFLA Dashboard<br/>Grafana]
        ALERTS[Alerts<br/>Regression Detection]

        PRODUCTION --> METRICS
        METRICS --> DASHBOARD
        METRICS --> ALERTS
    end

    style EVENTS fill:#4ecdc4
    style ANALYZE fill:#ff6b6b
    style PRODUCTION fill:#90ee90
    style DEPRECATED fill:#ffa07a
```

---

## 8. Data Flow Architecture

```mermaid
graph LR
    subgraph "Write Path"
        W_CLIENT[Client] --> W_API[API Server]
        W_API --> W_VALIDATE[Validate]
        W_VALIDATE --> W_PRIMARY[(PostgreSQL<br/>Primary)]
        W_PRIMARY --> W_CACHE_INV[Cache Invalidation]
        W_CACHE_INV --> W_REDIS[Redis]
        W_PRIMARY -.->|Async| W_ES[(Elasticsearch<br/>Index)]
    end

    subgraph "Read Path - Cache Hit"
        R_CLIENT[Client] --> R_API[API Server]
        R_API --> R_CACHE{Cache Hit?}
        R_CACHE -->|Yes| R_REDIS[Redis Cache]
        R_REDIS --> R_API
        R_API --> R_CLIENT
    end

    subgraph "Read Path - Cache Miss"
        M_CLIENT[Client] --> M_API[API Server]
        M_API --> M_CACHE{Cache Hit?}
        M_CACHE -->|No| M_REPLICA[(PostgreSQL<br/>Read Replica)]
        M_REPLICA --> M_UPDATE[Update Cache]
        M_UPDATE --> M_REDIS[Redis]
        M_REDIS --> M_API
        M_API --> M_CLIENT
    end

    subgraph "Search Path"
        S_CLIENT[Client] --> S_API[API Server]
        S_API --> S_ES[(Elasticsearch)]
        S_ES --> S_API
        S_API --> S_CLIENT
    end

    subgraph "Analytics Path"
        A_TOOL[Analytics Tool] --> A_REPLICA[(PostgreSQL<br/>Analytics Replica)]
        A_REPLICA --> A_TS[(TimescaleDB<br/>Metrics)]
        A_TS --> A_GRAFANA[Grafana]
    end

    style W_PRIMARY fill:#ff6b6b
    style R_REDIS fill:#4ecdc4
    style M_REPLICA fill:#95e1d3
    style S_ES fill:#ffa500
    style A_TS fill:#9b59b6
```

---

## 9. Deployment Architecture (Kubernetes)

```mermaid
graph TB
    subgraph "AWS/GCP Cloud"
        subgraph "Kubernetes Cluster"
            subgraph "Ingress Layer"
                INGRESS[Nginx Ingress<br/>Load Balancer]
            end

            subgraph "Application Pods"
                API_POD1[API Server Pod 1]
                API_POD2[API Server Pod 2]
                API_POD3[API Server Pod N]
                WS_POD[WebSocket Pod]
            end

            subgraph "Agent Pools"
                subgraph "Portal Manager Pool"
                    PM_POD1[Pod 1]
                    PM_POD2[Pod 2]
                    PM_POD3[Pod N]
                end

                subgraph "Specialist Pool"
                    SP_POD1[Pod 1]
                    SP_POD2[Pod 2]
                    SP_POD3[Pod N]
                end
            end

            subgraph "Auto-scaling"
                HPA[Horizontal Pod<br/>Autoscaler]

                HPA -.->|Scale| API_POD1
                HPA -.->|Scale| PM_POD1
                HPA -.->|Scale| SP_POD1
            end
        end

        subgraph "Managed Services"
            RDS[(RDS PostgreSQL<br/>Multi-AZ)]
            ELASTICACHE[ElastiCache<br/>Redis Cluster]
            ES_SERVICE[Elasticsearch<br/>Service]
        end

        subgraph "Storage"
            S3_BUCKET[S3 Buckets<br/>Documents]
        end
    end

    subgraph "External Services"
        BROWSERBASE[Browserbase]
        OPENAI[OpenAI API]
    end

    subgraph "Monitoring"
        CLOUDWATCH[CloudWatch]
        DATADOG[Datadog]
    end

    INGRESS --> API_POD1
    INGRESS --> API_POD2
    INGRESS --> API_POD3
    INGRESS --> WS_POD

    API_POD1 --> ELASTICACHE
    API_POD1 --> RDS

    PM_POD1 --> RDS
    PM_POD1 --> BROWSERBASE

    SP_POD1 --> OPENAI
    SP_POD1 --> RDS
    SP_POD1 --> S3_BUCKET

    API_POD1 -.->|Metrics| DATADOG
    PM_POD1 -.->|Metrics| DATADOG
    SP_POD1 -.->|Metrics| DATADOG

    RDS -.->|Logs| CLOUDWATCH
    ELASTICACHE -.->|Metrics| CLOUDWATCH

    style INGRESS fill:#ff6b6b
    style HPA fill:#4ecdc4
    style RDS fill:#9b59b6
    style ELASTICACHE fill:#e74c3c
```

---

## 10. Scaling Journey Timeline

```mermaid
gantt
    title RFP Agent Scaling Roadmap
    dateFormat YYYY-MM-DD
    section Phase 1: Foundation
    Redis Cluster Setup           :2025-10-01, 14d
    WebSocket Implementation       :2025-10-08, 14d
    BullMQ Task Queue             :2025-10-15, 14d
    PostgreSQL Read Replicas      :2025-10-22, 14d
    Basic Monitoring              :2025-10-29, 14d

    section Phase 2: Agent Enhancement
    Kubernetes Setup              :2025-11-12, 21d
    Agent Pool Deployment         :2025-11-26, 21d
    Resilient Scraping            :2025-12-10, 21d
    SAFLA Learning 2.0            :2026-01-07, 30d

    section Phase 3: Search & Analytics
    Elasticsearch Cluster         :2026-02-06, 30d
    Search Implementation         :2026-02-20, 21d
    TimescaleDB Metrics           :2026-03-06, 21d
    Advanced Dashboards           :2026-03-20, 14d

    section Phase 4: Scale Testing
    Load Testing (1K users)       :2026-04-03, 14d
    Optimization Round 1          :2026-04-17, 21d
    Load Testing (10K users)      :2026-05-08, 14d
    Optimization Round 2          :2026-05-22, 21d

    section Phase 5: Production Hardening
    Disaster Recovery             :2026-06-12, 30d
    Security Audit                :2026-07-12, 30d
    SOC 2 Preparation             :2026-08-11, 60d
```

---

## 11. Cost Evolution Chart

```mermaid
graph LR
    subgraph "User Scale"
        U1[100 Users<br/>$210/month<br/>$2.10/user]
        U2[1,000 Users<br/>$890/month<br/>$0.89/user]
        U3[10,000 Users<br/>$4,100/month<br/>$0.41/user]
        U4[100,000 Users<br/>$15,000/month<br/>$0.15/user]
    end

    U1 -->|3 months| U2
    U2 -->|6 months| U3
    U3 -->|12 months| U4

    style U1 fill:#95e1d3
    style U2 fill:#4ecdc4
    style U3 fill:#3498db
    style U4 fill:#9b59b6
```

---

## 12. System Health Dashboard Layout

```mermaid
graph TB
    subgraph "System Health Dashboard"
        subgraph "Top Row - Key Metrics"
            KPI1[Active Users<br/>10,234]
            KPI2[API Response Time<br/>p95: 342ms]
            KPI3[Error Rate<br/>0.8%]
            KPI4[Uptime<br/>99.95%]
        end

        subgraph "Middle Row - Agent Status"
            AGENT_HEALTH[Agent Health<br/>48/50 Healthy]
            QUEUE_DEPTH[Queue Depth<br/>124 Pending]
            SCAN_RATE[Portal Scans/Hour<br/>1,247]
            PROPOSAL_RATE[Proposals/Hour<br/>87]
        end

        subgraph "Bottom Row - Infrastructure"
            DB_CONN[DB Connections<br/>145/200]
            REDIS_HIT[Cache Hit Rate<br/>87.3%]
            CPU[CPU Usage<br/>62%]
            MEMORY[Memory Usage<br/>71%]
        end

        subgraph "Charts"
            TIME_SERIES[Response Time<br/>Last 24 Hours]
            ERROR_CHART[Error Distribution<br/>By Service]
            AGENT_CHART[Agent Utilization<br/>By Type]
        end
    end

    style KPI1 fill:#4ecdc4
    style KPI2 fill:#4ecdc4
    style KPI3 fill:#ffa07a
    style KPI4 fill:#90ee90
```

---

## 13. Observability Stack Integration

```mermaid
graph TB
    subgraph "Application"
        API[API Servers]
        AGENTS[Agent Pool]
        WS[WebSocket Gateway]
    end

    subgraph "Instrumentation"
        OTEL[OpenTelemetry SDK]
        PROM_CLIENT[Prometheus Client]
        LOGGER[Structured Logger<br/>Winston/Pino]

        API --> OTEL
        AGENTS --> OTEL
        WS --> OTEL

        API --> PROM_CLIENT
        AGENTS --> PROM_CLIENT

        API --> LOGGER
        AGENTS --> LOGGER
    end

    subgraph "Collection"
        PROM[Prometheus<br/>Metrics]
        JAEGER[Jaeger<br/>Traces]
        LOKI[Loki<br/>Logs]
        DD[Datadog<br/>APM]

        PROM_CLIENT --> PROM
        OTEL --> JAEGER
        OTEL --> DD
        LOGGER --> LOKI
    end

    subgraph "Visualization"
        GRAFANA[Grafana<br/>Dashboards]
        DD_UI[Datadog UI]
        SENTRY[Sentry<br/>Error Tracking]

        PROM --> GRAFANA
        JAEGER --> GRAFANA
        LOKI --> GRAFANA
        DD --> DD_UI
        LOGGER --> SENTRY
    end

    subgraph "Alerting"
        ALERT_MGR[AlertManager]
        PAGERDUTY[PagerDuty]
        SLACK[Slack]

        PROM --> ALERT_MGR
        DD --> ALERT_MGR
        ALERT_MGR --> PAGERDUTY
        ALERT_MGR --> SLACK
    end

    style OTEL fill:#4ecdc4
    style PROM fill:#e74c3c
    style GRAFANA fill:#ffa500
    style DD fill:#9b59b6
```

---

## Notes on Diagram Usage

### Viewing Diagrams

1. **GitHub:** These diagrams will render automatically when viewing this file on GitHub
2. **VS Code:** Install the "Markdown Preview Mermaid Support" extension
3. **Online:** Use <https://mermaid.live> to view and edit diagrams
4. **Export:** Use mermaid-cli to export diagrams to PNG/SVG:

   ```bash
   npm install -g @mermaid-js/mermaid-cli
   mmdc -i ARCHITECTURE_DIAGRAMS.md -o diagrams/
   ```

### Diagram Types Used

- **Graph TB/LR:** Flowcharts and architecture diagrams
- **Sequence Diagrams:** Interaction flows (WebSocket, API calls)
- **Gantt Charts:** Project timeline and roadmap
- **Class Diagrams:** (Not used, but available for data models if needed)

### Color Scheme

- 🔴 Red (#ff6b6b): Critical components, orchestrators
- 🔵 Blue (#4ecdc4): Main services, managers
- 🟢 Green (#95e1d3): Specialists, success states
- 🟠 Orange (#ffa07a): Warnings, fallbacks, deprecated
- 🟣 Purple (#9b59b6): Databases, storage

---

**End of Architecture Diagrams**

_Last Updated: 2025-10-02_
_For questions: <architecture@rfpagent.com>_
