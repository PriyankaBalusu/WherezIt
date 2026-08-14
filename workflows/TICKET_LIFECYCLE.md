# Wherezit Coding-Agent Ticket Lifecycle

```text
Human
  ↓
Orchestrator
  ↓
Architect (when design is needed)
  ↓
Implementation specialist(s)
  ↓
QA
  ↓
Security (for auth/data/AI/identifier/upload/cloud changes)
  ↓
Final Reviewer
  ↓
Human approval / commit
```

Rules:
- one ticket is the default work unit
- specialists do not redefine architecture
- reviewers reject/approve; they do not silently redesign
- failed gates return to the responsible specialist
- completion requires acceptance criteria + relevant passing tests
