# WherezIt — Controlled Parallel Execution Workflow

This document defines the rules, conflict classification, isolation requirements, and integration gates for parallel ticket execution in the WherezIt codebase.

---

## 1. Overview & Principles

Parallel ticket execution accelerates development while preserving architectural integrity, tenant security, and database consistency. 

Key Principles:
- **Max Concurrency**: Recommended maximum of **2–3 concurrent implementation tickets** per execution wave.
- **Strict Isolation**: Each parallel ticket operates in its own isolated Git branch or `git worktree`.
- **Single Migration Owner**: Only ONE active ticket at a time may create or modify EF Core migrations. No parallel migration exceptions are permitted during MVP development.
- **Contract First**: Shared API contracts, DTOs, and interfaces must be defined and frozen before parallel frontend and backend tickets execute.
- **Zero Shared File Collisions**: Shared files (e.g., core configuration or bootstrap files) must have explicit single-ticket ownership assigned by the Orchestrator before parallel execution begins.

---

## 2. Conflict Classification Framework

Before approving a parallel wave, the Orchestrator performs a Conflict Risk Assessment across all proposed tickets.

| Conflict Level | Description | Execution Rules |
| :--- | :--- | :--- |
| **LOW** | Disjoint domain components, separate projects, or independent infrastructure/auth setup with no shared file modifications. | **Parallel Execution Approved.** Run in separate branches/worktrees. |
| **MEDIUM** | Frontend and Backend implementation for the same domain feature, sharing an API endpoint or DTO contract. | **Parallel Execution Approved with Contract Freeze.** DTOs and API contract must be frozen before parallel coding begins. |
| **HIGH** | Multiple tickets creating EF Core migrations, modifying shared startup/DI files, or changing core workspace authorization rules. | **Parallel Execution DENIED.** Tickets MUST execute sequentially in strict order. |

---

## 3. Parallel Execution Eligibility Rules

### When Tickets MAY Run in Parallel
1. Tickets belong to separate vertical layers or independent domain slices (e.g., `PLAT-004` Firebase Hosting / frontend platform setup + `AUTH-001` Firebase Authentication frontend integration, provided file ownership is explicitly assigned).
2. One ticket is a pure frontend UI implementation (`04-FRONTEND-REACT.md`) and another is an independent backend infrastructure/AI ticket (`05-AI-GEMINI.md` or `06-DEVOPS-GCP.md`).
3. Only ONE ticket in the proposed wave contains EF Core database migrations (`02-DATABASE-POSTGRES.md`).

### When Tickets MUST Remain Sequential
1. Multiple tickets require creating EF Core migrations (`dotnet ef migrations add`).
2. A ticket depends on the data model, database table, or domain entity created by another ticket.
3. Multiple tickets require editing the same core bootstrap or configuration file without a pre-assigned single owner.
4. Architectural foundation tickets (`PLAT-001`, `PLAT-002`, `PLAT-003`, `PLAT-003B`) must finish completely before domain feature waves start.

---

## 4. Branch & Worktree Isolation Strategy

Every ticket in a parallel wave MUST execute in a dedicated, isolated workspace:

```bash
# Example: Wave 1 Parallel Worktree Setup
git worktree add ../WherezIt-PLAT-004 -b feature/PLAT-004-firebase-hosting
git worktree add ../WherezIt-AUTH-001 -b feature/AUTH-001-firebase-auth
```

Rules:
- No two agents or execution streams may edit files in the same working directory concurrently.
- Each worktree runs its own local verification tests (`dotnet test`) before declaring its ticket ready for review.

---

## 5. Migration Serialization Rule

> [!CRITICAL]
> **EF Core Migration Lock**: Only ONE active ticket at a time may create or modify EF Core migrations. No parallel migration exceptions are permitted during MVP development. Parallel creation of migrations leads to non-deterministic migration history graphs and database state corruption. If two tickets require schema changes, they MUST run in sequential waves.

---

## 6. Shared File & Contract Ownership

When parallel tickets share a dependency boundary:
1. **Shared Configuration & Bootstrap Ownership**:
   - `PLAT-004` owns Firebase project/hosting/bootstrap configuration required for the frontend.
   - `AUTH-001` consumes the established Firebase configuration and owns authentication-specific frontend code.
   - Any shared configuration file must have explicit single-ticket ownership assigned by the Orchestrator before parallel execution begins.
2. **Contract Freeze**: For parallel Frontend (`04-FRONTEND-REACT`) and Backend (`03-BACKEND-DOTNET`) work, the REST endpoint paths, request/response DTO schemas, and status codes MUST be defined in advance and committed before implementation begins.

---

## 7. Review & Wave Integration Lifecycle

Each parallel ticket follows the complete specialist review pipeline independently, followed by a wave integration gate:

```text
[Ticket A Worktree] ---> QA (07-QA) ---> Security (08-SECURITY) ---> Reviewer (09-REVIEWER) ---┐
                                                                                                 ├--> [Parallel Wave Integration Gate] --> Merge to Main
[Ticket B Worktree] ---> QA (07-QA) ---> Security (08-SECURITY) ---> Reviewer (09-REVIEWER) ---┘
```

### Parallel Wave Integration Gate (Executed by Orchestrator)
1. Merge ticket feature branches sequentially into a unified wave integration branch.
2. Run full solution restoration and build: `dotnet restore`, `dotnet build WherezIt.sln`.
3. Run full test suite: `dotnet test WherezIt.sln`.
4. Verify EF Core migration history and database compatibility (`dotnet ef migrations list`).
5. Run secret leakage audit (`git diff`).
6. Seek final human confirmation before pushing the completed wave to `main`.
