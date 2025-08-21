# PENNY – Software Specification (v0.1 Draft)

**Owner:** Aldo Ruiz Luna (CEO)

**Author:** MADFAM CEO’s Executive Assistant

**Status:** Draft for review

**Scope:** MVP → v1.0 multi‑tenant, white‑label‑ready assistant platform

---

## 0) Executive Summary

PENNY is a multi‑tenant, extensible, AI‑first workbench that pairs a conversational interface with an artifact visualization layer (dashboards, documents, charts, images, flows) to bring order to day‑to‑day operational chaos. Built by combining and extending proven open‑source chat/agent platforms, it will be secure by design, model‑agnostic, and SaaS‑ready.

**Primary user promise:** “Ask, act, and see”—chat to request outcomes, trigger tools to act, and visualize artifacts instantly.

---

## 1) Objectives, Success Criteria, Constraints

### 1.1 Objectives

* **Unified interface:** Chat + Artifact Viewer with seamless handoff.
* **Actionable agent:** Safe tool/function calling to query data, automate tasks, and generate artifacts.
* **Enterprise‑grade:** Multi‑tenant RBAC, SSO, encryption, auditing, observability.
* **Vendor‑flexible:** Local and hosted LLMs; swappable backends.
* **White‑label:** Theming, per‑tenant configuration, domain/app name branding.

### 1.2 Success Metrics (MVP → v1)

* TTI (time‑to‑first‑token) ≤ 600ms p50; end‑to‑end actionable response ≤ 4s p50 under nominal load.
* ≥ 95% tool invocation success rate with guardrails; zero P0 security incidents.
* ≥ 80% of common workflows covered by prebuilt “widgets/dashboards.”
* Admin tasks < 10 clicks for: invite user, connect datasource, enable plugin.
* NPS ≥ 40 from internal users after 30 days.

### 1.3 Constraints & Assumptions

* Self‑host first; public SaaS readiness by v1.0.
* GPU availability variable; design for graceful degradation.
* Data never leaves tenant boundary unless explicitly configured (e.g., external API models).

---

## 2) Personas & Top Jobs‑to‑Be‑Done

* **CEO/Exec (Aldo):** “Show me company health now,” “Draft an investor update with charts.”
* **Ops/PM:** “Create a project dashboard,” “Open a Jira ticket from this conversation.”
* **Finance:** “Reconcile MTD spend vs budget,” “Export a board‑ready PDF.”
* **Engineer/Analyst:** “Run this Python analysis on latest data and plot.”

---

## 3) Core Capabilities (MVP)

1. **Conversational engine** with memory & retrieval, model‑agnostic routing.
2. **Tooling layer** (function calling) for data queries, actions (tickets/emails), code execution sandbox.
3. **Artifact generation** (docs, charts, images, flowcharts, dashboards) and **Artifact Viewer** (inline + full screen).
4. **Multi‑tenancy & RBAC** with SSO (OIDC/OAuth2), audit logs, rate‑limits.
5. **Plugin management** (enable/disable per tenant), marketplace‑style install of integrations.
6. **Observability** (traces for LLM calls & tools), policy & safety filters.

**Non‑goals (MVP):** mobile native apps; full BI replacement; unmanaged autonomous agents.

---

## 4) System Architecture

```mermaid
flowchart LR
  subgraph Client
    A[Web App (Chat + Artifact Viewer)]
  end

  subgraph Edge
    WS[WebSocket Streaming]
    API[REST/GraphQL API]
  end

  A <---> WS
  A <---> API

  subgraph Core Backend
    CB[Conversation Service]
    PM[Prompt/Policy Manager]
    TL[Tool Router]
    AR[Artifact Registry]
    AU[AuthN/AuthZ + RBAC]
    LOG[Audit & Telemetry]
  end

  API --> CB
  WS --> CB
  CB <--> PM
  CB <--> TL
  TL <--> AR
  AU --> API
  CB --> LOG
  TL --> LOG

  subgraph Model Layer
    ORCH[Model Orchestrator]
    LLM1[(Local LLMs)]
    LLM2[(External Providers)]
    RET[(Vector Store)]
  end

  PM <--> ORCH
  ORCH <--> LLM1
  ORCH <--> LLM2
  CB <--> RET

  subgraph Tools & Data
    DS[(Datasources: ERP/CRM/DBs)]
    CODE[Code Sandbox]
    INT[Integrations (Jira, Slack, Email, WebSearch)]
  end

  TL <--> DS
  TL <--> CODE
  TL <--> INT
```

### 4.1 Components (contracts & highlights)

* **Web App** (SPA): Chat pane (streaming), Artifact pane (inline previews + full‑screen), Widget Library, Admin Console.
* **Conversation Service:** Threading, branching, memory, citations, message store (Postgres/Mongo).
* **Prompt/Policy Manager:** Templates, per‑tenant system prompts, guardrails (PII leak checks), safety filters.
* **Model Orchestrator:** Provider abstraction, model selection policy (data‑sensitivity, latency, complexity), retries, caching.
* **Tool Router:** JSON‑schema function registry, auth‑scoped tool exposure, concurrency & timeout controls.
* **Artifact Registry:** Immutable artifacts (versioned), metadata (type, mime, lineage, source tool), CDN/cache.
* **AuthN/AuthZ:** OIDC, SAML (later), RBAC with scoped permissions; API keys & PATs; SCIM for provisioning.
* **Observability:** OpenTelemetry traces across LLM calls/tool invocations; per‑tenant dashboards; red‑flag alerts.

---

## 5) Data Model (high level)

**Entities:** Tenant, User, Role, Permission, Workspace, Conversation, Message, Memory, Artifact, Widget, Plugin, Tool, DataSource, Credential (vault ref), VectorIndex, Document, Run (tool/LLM), AuditEvent, Policy, Theme.

**Key relationships:**

* Tenant 1‑N Workspaces; Workspace 1‑N Conversations; Conversation 1‑N Messages & Artifacts.
* Tenant 1‑N Plugins; Plugin 1‑N Tools; Tool N‑N Roles (permission map).
* DataSource 1‑N VectorIndex; VectorIndex 1‑N Document chunks.

---

## 6) APIs & Contracts

### 6.1 Realtime & REST

* **POST** `/v1/chat/:conversationId/messages`
  **Body:** `{ content, attachments[], toolsAllowed[], artifactsExpected[] }`
  **Streams:** SSE/WebSocket tokens + tool‑calls.
* **POST** `/v1/tools/:name/invoke`
  **Body:** tool‑specific schema; **Auth:** user/tenant scoped.
* **GET** `/v1/artifacts/:id` — signed URLs; **POST** `/v1/artifacts` to publish.
* **Admin:** `/v1/plugins`, `/v1/datasources`, `/v1/policies`, `/v1/themes`.

### 6.2 Function‑Calling Schemas (examples)

```json
// Load a prebuilt dashboard artifact
{
  "name": "load_dashboard",
  "description": "Load a registered dashboard widget",
  "parameters": {
    "type": "object",
    "properties": {
      "slug": {"type":"string"},
      "filters": {"type":"object", "additionalProperties": true}
    },
    "required": ["slug"]
  }
}
```

```json
// Company KPI snapshot
{
  "name": "get_company_kpis",
  "parameters": {
    "type": "object",
    "properties": {
      "period": {"type":"string", "enum":["MTD","QTD","YTD"]},
      "unit": {"type":"string", "enum":["company","bu","project"]},
      "id": {"type":"string"}
    },
    "required": ["period","unit"]
  }
}
```

```json
// Jira ticket creation
{
  "name": "create_jira_ticket",
  "parameters": {
    "type":"object",
    "properties": {
      "projectKey":{"type":"string"},
      "title":{"type":"string"},
      "description":{"type":"string"},
      "assignee":{"type":"string"},
      "labels":{"type":"array","items":{"type":"string"}}
    },
    "required":["projectKey","title","description"]
  }
}
```

```json
// Code sandbox (Python) for data + chart artifacts
{
  "name": "run_python_job",
  "parameters": {
    "type":"object",
    "properties": {
      "script": {"type":"string"},
      "files": {"type":"array","items":{"type":"string","description":"artifact/file IDs to mount"}},
      "timeoutSec": {"type":"integer","minimum":1,"maximum":120}
    },
    "required": ["script"]
  }
}
```

---

## 7) Artifact Types & Viewer

**Types:** Text/Markdown, Table (CSV/Parquet), Chart (PNG/SVG/Vega), Diagram (Mermaid/DOT), Document (PDF/Docx), Image (SD output), Notebook (ipynb snapshot), 3D (glTF/STL preview), Dashboard (composed widgets).

**Viewer modes:**

* **Inline** (in chat bubble) with quick actions (expand, save, pin, export).
* **Full‑screen** dashboard mode with filters, drill‑downs, and layout save per user.

**Widget Library (initial):** Company Health, Finance Snapshot, Sales Funnel, Ops Incidents, Hiring Pipeline, Project Timeline.

---

## 8) Integrations (MVP list)

* **Data:** Postgres/BigQuery/Snowflake, S3/GCS, Google Sheets, CSV upload.
* **Ops:** Jira, Linear, GitHub, Slack/Teams, Email (SMTP/API), Calendar (Google/Microsoft).
* **Models:** Local (Ollama/vLLM/TGI), External (OpenAI/Anthropic/Gemini via provider registry).
* **Search/RAG:** pgvector/Weaviate/Milvus; file ingestion (PDF, Docx, HTML, MD) with chunkers.
* **Images:** Stable Diffusion / Flux (containerized) for text‑to‑image.

---

## 9) Security, Privacy, & Compliance

* **Isolation:** Tenant scoping at every layer; row‑level security; dedicated vector namespaces.
* **Encryption:** TLS in transit, KMS‑backed at rest; secrets in vault (HashiCorp or cloud KMS).
* **Auth:** OIDC/OAuth2; optional SAML; SCIM; MFA; device/session policies.
* **RBAC:** Roles: `admin`, `manager`, `creator`, `viewer`; per‑tool and per‑datasource grants.
* **Data Egress Controls:** Policy flags to restrict external model calls; allow‑list outbound hosts.
* **Moderation/PII:** Prompt/output filters, DLP checks; redaction utilities; configurable per tenant.
* **Audit:** Every tool call, data access, model/provider selection, admin action logged with payload hashes.

---

## 10) Observability & SRE

* **Metrics:** latency (TTFT, TTFB, end‑to‑end), token usage, tool success/failure, cache hit‑rate, GPU util.
* **Tracing:** Distributed traces across chat→LLM→tool→artifact; session replay for UI issues.
* **Alarms:** timeouts, elevated error rates, failed auth, abnormal egress; P0/P1 runbooks.

---

## 11) Performance & Scale Targets

* Concurrency: 500 active chats (MVP), 2,000 (v1).
* P50 latency: ≤ 600ms TTFT; ≤ 4s tool‑assisted answer; ≤ 1s artifact retrieval.
* Cost controls: model cache; small→large model escalations; quantized local models where possible.

---

## 12) Frontend UX Spec

* **Primary layout:** Left (conversations & presets), Center (chat stream), Right (Artifact Panel, collapsible).
* **Modes:** Chat, Dashboard, Composer (prompt + tool selection + dataset pickers).
* **Conversation branching:** Fork messages; compare branches side‑by‑side.
* **Admin Console:** Plugins (enable/disable, config), Datasources (connections, sync status), Users/Roles, Themes.
* **Accessibility:** Keyboard‑first ops, ARIA, high‑contrast theme, localization EN/ES.

---

## 13) Plugin/Tooling Architecture

* **Registry:** JSON‑schema contracts with versioning; semantic caps (max rows, rate limits); human‑in‑the‑loop flags.
* **Execution:** In‑proc for light tools; sidecar micro‑services for heavy/unsafe; network policies to isolate.
* **Marketplace:** Tenant‑admin discover/install/update; signed bundles; permission prompts; policy evaluation pre‑install.

**ADR‑01 (Base framework choice):**

* *Option A:* Start from **LibreChat** (multi‑user + plugins) and add Artifact Viewer + marketplace UI.
* *Option B:* Start from **LobeChat** (artifacts + marketplace) and harden enterprise multi‑tenant features.
* *Recommendation (MVP):* Option A for backend maturity; port “artifact” concepts and marketplace later.

---

## 14) Code Execution Sandbox

* **Runtime:** Containerized Python (3.11) with curated libs; network egress denied by default; file system ephemeral.
* **Limits:** CPU/GPU quotas, 512MB RAM soft cap (configurable), 60–120s wall clock; per‑tenant budget.
* **Artifacts:** stdout/stderr logs, generated files auto‑uploaded & versioned; diffs tracked.
* **Safety:** Static lint on submitted scripts; denylist of ops; allow‑list APIs; review queue for escalations.

---

## 15) Deployment & DevEx

* **Packaging:** Helm charts + Terraform modules; profiles: *dev*, *staging*, *prod*.
* **Services:** Web, API, Model Orchestrator, Tool Workers, Vector DB, DB, Ingress, Job queue, Sandbox pool.
* **GPU:** vLLM/TGI pods with HPA; node‑affinity; warm pools for burst.
* **CI/CD:** GitHub Actions; trunk‑based; SBOM & image signing; canary + feature flags.

---

## 16) Test Plan

* **Unit:** prompt templates, tool schemas, RBAC policy eval.
* **Integration:** end‑to‑end chat→tool→artifact; SSO; datasource connectors; sandbox outputs deterministic checks.
* **Load:** 500 concurrent users, 5 msg/min; chaos tests (model pod kill, tool timeout, vector DB failover).
* **Quality:** eval sets for RAG grounding & chart correctness; red‑team prompts for safety.

---

## 17) Rollout Plan (AAA Loop)

**Phase 0: Spike (2–3 weeks)**

* Fork base repo, stand up auth, one local model, streaming chat.
* Implement 2 tools (`get_company_kpis`, `load_dashboard`) and 1 widget (Company Health).
* Ship artifact inline previews.

**Phase 1: Internal Beta (4–6 weeks)**

* Add code sandbox, SD image tool, Jira/Slack/Email, vector store & ingest; Admin Console.
* RBAC + audit; Observability dashboards; policy flags for external models.

**Phase 2: v1 Readiness (4–6 weeks)**

* Theming & white‑label; plugin marketplace; scale/perf hardening; DR plan; documentation.

---

## 18) Risks & Mitigations

* **Model drift/perf regressions:** continuous evals; canary providers; kill‑switch.
* **Tool abuse/data exfiltration:** strict RBAC, egress policies, HIL confirmations, audit & anomaly alerts.
* **GPU scarcity:** quantized models; CPU fallbacks; job queue + graceful degradation.
* **Tenant boundary bugs:** RLS at DB + service checks + fuzz tests.
* **Cost overrun:** per‑tenant quotas, caching, budget alerts, usage‑based routing.

---

## 19) Acceptance Criteria (MVP)

* Login via OIDC; create tenant; invite user; assign role.
* Start chat; assistant calls `get_company_kpis`; returns chart artifact inline; open dashboard full‑screen.
* Create Jira ticket from chat; Slack notify; audit log shows end‑to‑end trace.
* Upload PDF; ask question; grounded answer with citation; export conversation + artifact bundle (zip/PDF).

---

## 20) Appendix

* **Prompts:** system/persona templates (EN/ES); safety prompts; tool selection policy hints.
* **Theme tokens:** brand colors, logos, font stacks; tenant overrides.
* **Glossary:** Artifact, Widget, Tool, Plugin, Run, Vector Index, Tenant, Workspace.
