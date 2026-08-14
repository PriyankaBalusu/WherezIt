# Gemini Prompt — Review Antigravity Implementation

Review the implementation completed for ticket:

`<TICKET-ID>`

Read:
- `GEMINI.md`
- the ticket in `docs/TICKETS.md`
- relevant `docs/MVP_SPEC.md`
- relevant ADRs
- the git diff and affected tests

Review specifically for:

1. Acceptance-criteria completeness.
2. Architecture violations.
3. PostgreSQL correctness.
4. EF Core/Npgsql usage.
5. Transaction/concurrency correctness.
6. Workspace tenant isolation.
7. Authentication/authorization flaws.
8. Security/privacy.
9. AI confirmation-rule violations.
10. QR/barcode authorization mistakes.
11. Incorrect BOX ID behavior.
12. Error handling and idempotency.
13. Test gaps.
14. Unnecessary abstractions or scope creep.
15. Maintainability.

Do not rewrite the whole solution.

Output:
- Critical issues
- Important issues
- Minor issues
- Missing tests
- What was implemented well
- Final recommendation: APPROVE / APPROVE WITH CHANGES / REQUEST CHANGES


Also read and preserve `docs/ADR/ADR-003-archive-and-task-security.md`.
