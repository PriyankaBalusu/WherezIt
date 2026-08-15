# WherezIt Coding-Agent Ticket Lifecycle

This document defines the lifecycle of coding tickets from planning through implementation, QA, security review, and final merge.

---

## 1. Lifecycle Overview

```text
Human Developer
      ↓
Orchestrator (Execution Mode Selection: Sequential vs Controlled Parallel)
      ↓
Architect (01-ARCHITECT.md — when architectural/ADR design is needed)
      ↓
Implementation Specialist(s) (02-DATABASE, 03-BACKEND, 04-FRONTEND, 05-AI-GEMINI, 06-DEVOPS)
      ↓
QA Reviewer (07-QA.md)
      ↓
Security Reviewer (08-SECURITY.md — required for auth, data, AI, identifier, upload, and cloud infrastructure changes)
      ↓
Final Reviewer (09-REVIEWER.md)
      ↓
Parallel Wave Integration Gate (For parallel waves — full build, test suite, & migration check)
      ↓
Human Approval & Commit / Merge
```

---

## 2. Core Execution Rules

1. **Execution Mode Selection**: The Orchestrator evaluates ticket dependencies and selects either **Sequential Mode** (single ticket focus) or **Controlled Parallel Mode** (bounded wave of 2–3 tickets per `workflows/PARALLEL_EXECUTION.md`).
2. **Specialist Role Boundaries**: Implementation specialists (`02-DATABASE` through `06-DEVOPS`) own technical implementation within their domain but do not alter architecture or ADR decisions.
3. **Reviewer Authority**: Reviewers (`07-QA`, `08-SECURITY`, `09-REVIEWER`) approve or reject against acceptance criteria; they do not silently redesign code.
4. **Failed Gate Protocol**: If a QA, Security, or Review gate fails, the ticket returns to the responsible specialist with specific actionable feedback.
5. **Completion Criteria**: A ticket is complete ONLY when its acceptance criteria pass, relevant unit/integration tests pass, and security/review gates approve.
6. **EF Core Migration Serialization**: Only ONE active ticket at a time may create or modify EF Core migrations.
No parallel migration exceptions are permitted during MVP development.
7. **Wave Integration Rule**: Approval of an individual parallel ticket does NOT mean the parallel wave is complete. A wave is complete only after all tickets pass individual review and the solution-wide **Parallel Wave Integration Gate** succeeds.
8. **Persistence Seam Rule**: Persistence-owning tickets are incomplete without version-controlled EF Core migrations and real PostgreSQL integration test verification.
9. **Infrastructure Boundary Rule**: Cloud SQL infrastructure tickets provision database infrastructure and connectivity; domain feature tickets own application tables and schema migrations.
