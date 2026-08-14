# Wherezit Product-Agent Feature Workflow

For tickets touching Vision, Inventory, Retrieval, or Orchestrator:

1. Architect confirms responsibility/tool boundaries.
2. Backend defines typed application interfaces and authorization.
3. PostgreSQL Agent reviews persistence/index changes.
4. AI Agent implements Gemini/provider/prompt/structured output.
5. Frontend implements review/query UI when needed.
6. QA tests output validation, fallback, idempotency, human confirmation, grounding, and tenant isolation.
7. Security reviews tool permissions/data exposure.
8. Final Reviewer checks spec/ADR compliance.
