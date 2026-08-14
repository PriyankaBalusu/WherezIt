# Antigravity One-Ticket Prompt Template

Implement this ticket from `docs/TICKETS.md`:

`<TICKET-ID>`

Before coding:
- read `GEMINI.md`
- read the ticket
- read relevant `docs/MVP_SPEC.md` sections
- read relevant ADRs
- inspect current repository state

Use the approved PostgreSQL stack:
- EF Core
- Npgsql
- PostgreSQL
- Cloud SQL for PostgreSQL in hosted environments

Do not implement unrelated future tickets.

Start with:
1. Existing state
2. Plan
3. Files expected to change
4. Risks

Then implement, run relevant tests/builds, and fix failures.

For persistence behavior, use a real PostgreSQL integration environment.

Finish with:
- files changed
- behavior
- migration/schema impact
- tests/results
- acceptance criteria status
- remaining risks

Stop after this ticket.
