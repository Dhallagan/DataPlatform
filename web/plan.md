# AutoHoc - Self-Service Ad-Hoc Reporting Portal

## Current State (v0.1)

We've built a working prototype of a self-service reporting portal with AI-powered chat and direct report execution.

### What's Working

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AUTOHOC v0.1                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────────────────────────────────────────┐   │
│  │             │     │                                                 │   │
│  │  Chat UI    │────►│  LangChain Agent (Claude)                       │   │
│  │  (Next.js)  │     │  ├─ introspect_schema                          │   │
│  │             │◄────│  ├─ execute_query                              │   │
│  └─────────────┘     │  ├─ revenue_report                             │   │
│                      │  ├─ aging_report                               │   │
│  ┌─────────────┐     │  └─ invoice_lookup                             │   │
│  │             │     │                                                 │   │
│  │  Reports UI │────►│  Direct API Endpoints (bypass LLM)             │   │
│  │  (Forms)    │     │  POST /api/reports/revenue                     │   │
│  │             │◄────│  POST /api/reports/aging                       │   │
│  └─────────────┘     │  POST /api/reports/invoice-lookup              │   │
│                      │  GET  /api/reports/schema                      │   │
│                      │  POST /api/reports/query                       │   │
│                      └──────────────────┬──────────────────────────────┘   │
│                                         │                                   │
│                                         ▼                                   │
│                                  ┌─────────────┐                            │
│                                  │   SQLite    │                            │
│                                  │   (Demo)    │                            │
│                                  └─────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Next.js 14, TypeScript, Tailwind    |
| Backend  | FastAPI, Python 3.11                |
| AI       | LangChain + Claude (Anthropic)      |
| Database | SQLite (demo data)                  |
| Theme    | Anthropic-style warm cream/terracotta |

### Project Structure

```
/AutoHoc
├── backend/
│   ├── main.py                 # FastAPI app + direct report endpoints
│   ├── agent/
│   │   ├── agent.py            # LangChain agent setup
│   │   └── tools/
│   │       ├── schema.py       # introspect_schema tool
│   │       ├── query.py        # execute_query tool
│   │       └── reports.py      # revenue, aging, invoice tools
│   ├── models/
│   │   ├── chat.py             # Chat request/response models
│   │   └── reports.py          # Report parameter schemas
│   └── db/
│       ├── database.py         # SQLite connection
│       ├── schema.sql          # Table definitions
│       └── seed.py             # Sample data (10 customers, 61 invoices)
│
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx            # Main chat interface
│   │   └── reports/
│   │       ├── page.tsx        # Report catalog grid
│   │       └── [reportId]/
│   │           └── page.tsx    # Report config + execution
│   ├── src/components/
│   │   ├── ChatPanel.tsx       # Chat messages + input
│   │   ├── MessageBubble.tsx   # Message rendering + embedded data
│   │   ├── EmbeddedSpreadsheet.tsx  # Full-height data grid
│   │   ├── ThinkingBlock.tsx   # Collapsible tool call display
│   │   ├── Toolbar.tsx         # Top nav bar
│   │   ├── ConversationsSidebar.tsx  # Chat history
│   │   └── ResultsPanel.tsx    # Query results sidebar
│   └── src/lib/
│       ├── api.ts              # Chat API client
│       └── reports.ts          # Report definitions + execution
│
└── plan.md                     # This file
```

### Features Implemented

#### Chat Interface (/)
- Natural language queries via LangChain agent
- Tool calls displayed with expandable "Thinking" block
- Embedded spreadsheets for query results in chat
- Conversation history sidebar
- Results panel with query history

#### Reports Interface (/reports)
- Report catalog with grid layout
- Individual report pages with:
  - Collapsible parameter sidebar
  - Form validation
  - Direct API execution (no LLM)
  - Full-height spreadsheet results
  - CSV export
  - Summary metrics bar

#### Domain: Law Firm Accounting

**Key Entities:**
- **Client** - The law firm's customer
- **Matter** - A case/project for a client
- **Attorney** - Timekeeper who does the work
- **Originating Attorney** - Who brought in the client/matter

**Common Filter Dimensions:**
- Client
- Matter
- Attorney (working)
- Originating Attorney
- Practice Area
- Start/End Date

#### Available Reports (20 Law Firm Reports)

**Billing & Revenue**
| # | Report | Parameters | Description |
|---|--------|------------|-------------|
| 1 | Revenue by Client | start_date, end_date, client_id? | Billed & collected by client |
| 2 | Revenue by Attorney | start_date, end_date, attorney_id? | Billed & collected by timekeeper |
| 3 | Revenue by Matter | start_date, end_date, client_id?, matter_id? | Billed & collected by matter |
| 4 | Revenue by Practice Area | start_date, end_date, practice_area? | Revenue by practice group |
| 5 | Billing Summary | start_date, end_date, client_id? | Invoices generated in period |

**AR & Collections**
| # | Report | Parameters | Description |
|---|--------|------------|-------------|
| 6 | AR Aging by Client | as_of_date, client_id? | Outstanding balances by client |
| 7 | AR Aging by Attorney | as_of_date, attorney_id? | Aging by responsible attorney |
| 8 | Collections Report | start_date, end_date, client_id? | Payments received |
| 9 | Write-offs Report | start_date, end_date, client_id? | Amounts written off |
| 10 | Realization Report | start_date, end_date, attorney_id? | Standard → Discounted → Collected |

**Time & Productivity**
| # | Report | Parameters | Description |
|---|--------|------------|-------------|
| 11 | Timekeeper Productivity | start_date, end_date, attorney_id? | Hours worked by attorney |
| 12 | Daily Time Summary | date, attorney_id? | Time entries for a day |
| 13 | Utilization Report | start_date, end_date, attorney_id? | Billable vs available hours |
| 14 | Unbilled Time (WIP) | as_of_date, client_id?, matter_id? | Work not yet billed |
| 15 | Time by Matter | start_date, end_date, matter_id | Hours logged per matter |

**Matter & Client Analysis**
| # | Report | Parameters | Description |
|---|--------|------------|-------------|
| 16 | Matter Profitability | start_date, end_date, matter_id? | Revenue vs cost by matter |
| 17 | Client Profitability | start_date, end_date, client_id? | Revenue vs cost by client |
| 18 | New Matters Report | start_date, end_date, client_id? | Matters opened in period |
| 19 | Matter Status Report | status?, client_id?, attorney_id? | Active/closed matters |
| 20 | Client Activity Report | start_date, end_date, client_id | All activity for a client |

**Timecard Lifecycle:**
```
┌──────────┐    ┌────────────┐    ┌───────────┐    ┌───────────┐
│ Standard │───►│ Discounted │───►│  Billed   │───►│ Collected │
│  Hours   │    │   Hours    │    │  Amount   │    │  Amount   │
└──────────┘    └────────────┘    └───────────┘    └───────────┘
     │                │                 │                │
     └── Realization Rate ──────────────┴────────────────┘
```

### Running the App

```bash
# Backend (from /backend)
python3 -m uvicorn main:app --reload --port 8000

# Frontend (from /frontend)
npm run dev
```

Requires `ANTHROPIC_API_KEY` in backend/.env

---

## Roadmap

### Phase 1: Chat + Direct Reports ✅ DONE
- [x] LangChain agent with tool calling
- [x] Chat UI with embedded results
- [x] Direct report execution with forms
- [x] Databricks-style dense data layout

### Phase 1.5: Separate Analysis from Data (Next)

Currently in chat, the AI response and data are mixed in one bubble. We should separate them:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CURRENT STATE                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [Thinking: 1 tool used]                                             │   │
│  │                                                                     │   │
│  │ Here are the Q3 results. Total outstanding is $173K with most      │   │
│  │ concentrated in the 90+ day bucket...                              │   │
│  │                                                                     │   │
│  │ ┌─────────────────────────────────────────────────────────────┐    │   │
│  │ │  # │ Customer    │ Current │ 30 Days │ Total Balance       │    │   │
│  │ │  1 │ Acme Corp   │ $5,000  │ $2,500  │ $7,500              │    │   │
│  │ │  2 │ Beta Inc    │ $3,200  │ $0      │ $3,200              │    │   │
│  │ └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  TARGET STATE                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ AI ANALYSIS                                                         │   │
│  │ Here are the Q3 results. Total outstanding is $173K with most      │   │
│  │ concentrated in the 90+ day bucket. Acme Corp is your largest      │   │
│  │ exposure - recommend prioritizing collection.                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📊 AR AGING REPORT                              [Expand] [Export]   │   │
│  │ as_of_date: 2026-01-13 │ 10 rows │ $173,462.83 outstanding         │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  # │ Customer         │ Current  │ 1-30 Days │ ... │ Total        │   │
│  │  1 │ Acme Corp        │ $28,996  │ $0        │     │ $73,433      │   │
│  │  2 │ GreenEnergy      │ $26,474  │ $0        │     │ $30,737      │   │
│  │  3 │ ...              │          │           │     │              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Changes needed:**

1. **ReportCard component** - Standalone card for report results with:
   - Report name + icon in header
   - Parameters used (collapsed)
   - Summary metrics row
   - Expandable data grid
   - Export button
   - Timestamp

2. **MessageBubble update** - Render analysis text and ReportCards separately:
   ```tsx
   <div className="space-y-3">
     {/* AI Analysis */}
     <div className="prose">
       <ReactMarkdown>{message.content}</ReactMarkdown>
     </div>

     {/* Report Objects */}
     {message.toolResults?.map(result => (
       <ReportCard key={result.tool} result={result} />
     ))}
   </div>
   ```

3. **Report metadata** - Include report name/type in tool results so we can label them properly

4. **Expand/collapse** - Data grid collapsed by default, click to expand full-height

5. **Click to open** - Clicking the ReportCard navigates to the full report page with parameters pre-filled:
   ```
   Click on "AR Aging Report" card in chat
         │
         ▼
   /reports/aging_report?as_of_date=2026-01-13
         │
         ▼
   Full report view with:
   - Parameters pre-populated from the chat query
   - Can tweak and re-run
   - Full-screen data grid
   ```

This creates a clear separation: AI commentary is prose, data is a distinct object that can be opened in its own view.

---

### Phase 2: Request Queue
Add human review workflow for compliance:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌───────────┐
│  Chat UI    │────►│  AI Agent   │────►│  Request    │────►│  Review   │
│  (Users)    │     │  (Claude)   │     │  Queue      │     │  (Admin)  │
└─────────────┘     └─────────────┘     └─────────────┘     └───────────┘
```

- [ ] Request model (id, user, query, status, created_at)
- [ ] Queue view for admins
- [ ] Approve/reject workflow
- [ ] Audit log

### Phase 3: Self-Service Tiers
- [ ] Trust levels by report type
- [ ] Auto-approve for standard reports
- [ ] Review required for ad-hoc queries

### Phase 4: Scheduling
- [ ] Cron-style recurring reports
- [ ] Email delivery (SMTP)
- [ ] Report subscriptions

### Phase 5: Production Readiness
- [ ] Replace SQLite with SQL Server/Postgres
- [ ] Authentication (SSO/OAuth)
- [ ] Role-based access control
- [ ] Query result caching
- [ ] Error monitoring

---

## Original Vision

The goal is to replace email-based report requests with a structured system:

**Today's Pain:**
- Requests come via email, get lost
- No verification before sending
- Forget what queries were built before
- Users can't self-service
- Team is the bottleneck

**Target State:**
- Everything logged in queue with history
- Human review step for compliance
- Saved queries library, searchable
- AI writes SQL, humans verify
- Chat interface for simple stuff
- Scheduled delivery for recurring reports
