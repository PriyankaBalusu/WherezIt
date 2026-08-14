# ADR-002 — Agent Orchestration Inside the Modular Monolith

Status: Accepted

## Context

Wherezit needs multiple AI capabilities: photo understanding, candidate inventory normalization, and natural-language retrieval.

A multi-agent model provides clear responsibilities, but separate agent microservices would add unnecessary MVP complexity.

## Decision

Implement:

```text
Wherezit Orchestrator
├── Vision Agent
├── Inventory Agent
└── Retrieval Agent
```

These are logical components inside the existing modular monolith.

Vertex AI / Gemini integration stays behind Infrastructure/application interfaces.

PostgreSQL remains the system of record.

## Guardrails

- no unrestricted DB access for agents
- authorization-aware tools only
- no cross-workspace access
- no automatic promotion of suggestions to trusted inventory
- no hidden reasoning persistence
- schema validation for agent output
- idempotent retryable workflows
- provider implementation replaceable behind interfaces

## Framework decision

Do not couple Domain/Application to a specific agent framework.

Infrastructure may later evaluate Google ADK or another orchestration runtime. A framework that materially changes runtime architecture requires a new ADR.

## Consequences

Benefits:
- meaningful agent orchestration
- simple deployment
- centralized security/domain rules
- testable responsibilities
- future framework flexibility

Reconsider when:
- agent workflows require truly independent deployment/scaling
- orchestration complexity justifies a dedicated runtime
- a production agent framework provides clear measurable benefit


## Retrieval grounding decision

The Retrieval Agent may perform LLM-driven query expansion and semantic-to-syntactic translation.

It must then retrieve evidence through authorized PostgreSQL-backed application tools.

Final answers may reference only returned application records.

No external vector database is required for MVP.
