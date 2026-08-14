# Wherezit — In-Product Agent Orchestration

Version: 1.0  
Status: Approved architecture extension

## Purpose

Wherezit uses a hierarchical AI layer to help users catalog physical belongings and retrieve them later using photos and natural-language questions.

These are **product agents inside Wherezit**. They are different from the coding agents under `/agents`, which are used to build the application.

## Non-negotiable invariants

- PostgreSQL remains the system of record.
- Workspace remains the tenant/security boundary.
- AI agents never receive unrestricted database access.
- AI-generated inventory is never trusted until explicit user confirmation.
- Agents call typed, authorization-aware application tools.
- Product agents remain logical components inside the modular monolith for MVP.
- Agents cannot bypass domain/application rules.
- Hidden model reasoning is never stored.

## Product Agent Hierarchy

```text
Wherezit Assistant / Orchestrator
│
├── Vision Agent
│   └── Understand storage photos and propose candidate items.
│
├── Inventory Agent
│   └── Normalize, deduplicate, categorize, and refine candidates.
│
└── Retrieval Agent
    └── Interpret natural-language find requests and retrieve evidence.
```

Future agents such as a Moving Agent may be added only after a clear product requirement and ADR.

---

## Orchestrator

Responsibilities:

1. Receive the user intent.
2. Resolve authenticated user and workspace.
3. Select the required agent/tool.
4. Pass only the minimum authorized context.
5. Validate structured outputs.
6. Coordinate agent calls.
7. Return suggestions/results to the application layer.
8. Require user confirmation before trusted mutations where applicable.
9. Record safe operational metadata.
10. Fail safely when dependencies are unavailable.

The Orchestrator must not write directly to PostgreSQL outside approved application services.

---

## Vision Agent

Goal: convert one or more container photos into structured **candidate detections**.

Example output:

```json
{
  "items": [
    {
      "name": "Christmas string lights",
      "quantity": 2,
      "category": "Holiday decorations",
      "confidence": 0.93
    }
  ]
}
```

Rules:

- output becomes `DetectionSuggestion`
- never directly creates trusted `Item`
- confidence is advisory
- ambiguous objects remain suggestions
- invalid output is rejected
- manual entry remains available if AI fails

---

## Inventory Agent

Goal: improve candidate inventory quality before human review.

Capabilities:

- normalize item names
- suggest categories
- merge obvious duplicate detections
- refine quantities
- preserve uncertainty
- compare against authorized existing container data

Examples:

- `Xmas lights` → `Christmas string lights`
- `red electrical extension wire` → `Extension cord`

Normalization remains a suggestion until the user confirms inventory.

---

## Retrieval Agent

Goal: answer natural-language storage questions using real authorized Wherezit data.

Examples:

- "Where are my Christmas lights?"
- "Which box has the camping stove?"
- "Where did I put the things we use for outdoor Christmas decorations?"

The agent may call typed application tools such as:

```text
SearchItems(workspaceId, query)
GetContainer(containerId)
GetStoragePath(containerId)
GetRelatedItems(workspaceId, categoryOrTags)
GetRecentMoves(entityId)
```

The agent does not receive direct unrestricted SQL/database access.

Expected answer contains:

- matched item(s)
- permanent BOX ID
- full location path
- grounding/evidence
- optional relevance/confidence indicator

If there is no evidence, the agent must say it did not find a reliable match.

---

## C# Application Boundaries

Conceptual interfaces:

```text
IAgentOrchestrator
IInventoryVisionProvider
IInventoryNormalizationAgent
IRetrievalAgent
IStorageSearchService
IContainerReadService
IStoragePathResolver
```

Provider/Vertex AI SDK details belong in Infrastructure.

Domain must remain free of AI/Google SDK dependencies.

---

## Catalog Flow

```text
User captures photo
        ↓
InventoryCapture
        ↓
Cloud Task
        ↓
Wherezit Orchestrator
        ↓
Vision Agent
        ↓
Inventory Agent
        ↓
DetectionSuggestion rows
        ↓
REVIEW_REQUIRED
        ↓
User edits / accepts / rejects / adds
        ↓
Confirm inventory
        ↓
Trusted Item rows in PostgreSQL
```

## Retrieval Flow

```text
Natural-language question
        ↓
Authenticate + resolve workspace
        ↓
Wherezit Orchestrator
        ↓
Retrieval Agent
        ↓
Authorization-aware search/read tools
        ↓
PostgreSQL evidence
        ↓
Answer with BOX ID + location
```

---

## Persistence and Telemetry

May persist:

- capture/job status
- structured agent output
- accepted/rejected/modified suggestions
- provider/model/version
- latency/token/cost metadata when appropriate
- safe tool-call metadata
- failure codes

Must not persist:

- hidden chain-of-thought
- secrets
- unnecessary raw private prompts
- auth tokens

Use PostgreSQL `jsonb` only for flexible operational metadata.

---

## Evaluation

### Vision

- precision
- recall
- user correction rate
- quantity correction rate
- manual fallback rate

### Inventory

- normalization acceptance
- duplicate-merge correction rate
- category acceptance

### Retrieval

- top-result accuracy
- BOX ID accuracy
- location-path accuracy
- no-answer correctness
- evidence grounding rate
- cross-workspace leakage rate: **0**

### Operations

- P50/P95 latency
- model error rate
- retry rate
- AI cost per successful workflow

---

## MVP Agent Scope

P0:
- Orchestrator abstraction
- Vision Agent
- Inventory Agent
- Retrieval Agent
- schema-constrained outputs
- authorization-aware tools
- mandatory human review
- evaluation harness

P1:
- richer telemetry
- evaluation dashboard
- prompt/model version registry

Not MVP:
- independent microservice per agent
- unrestricted autonomous DB actions
- autonomous moving/reorganization
- autonomous deletion/purchasing


---

## Retrieval Query Expansion Strategy

The Retrieval Agent may use Gemini to translate a natural-language request into structured search intent.

Example:

```json
{
  "keywords": ["holiday", "Christmas", "lights"],
  "categories": ["Holiday decorations"],
  "relatedTerms": ["string lights", "wreath", "inflatable"]
}
```

The agent then calls authorization-aware PostgreSQL-backed application search tools.

The LLM provides semantic expansion; PostgreSQL provides evidence.

Final responses may mention only records returned by authorized tools.
If no reliable evidence is returned, the agent must not invent an answer.
