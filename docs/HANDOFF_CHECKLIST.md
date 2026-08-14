# AI Agent Handoff Checklist

Before giving the repository to Gemini or Antigravity, confirm:

- [ ] `GEMINI.md` is in repository root.
- [ ] `docs/MVP_SPEC.md` exists.
- [ ] `docs/TICKETS.md` exists.
- [ ] accepted ADRs are present.
- [ ] PostgreSQL is named everywhere as the relational database.
- [ ] no MySQL package/config/migration remains unless being intentionally migrated.
- [ ] secrets are not committed.
- [ ] local PostgreSQL setup is documented.
- [ ] agents are instructed to inspect the repo before editing.
- [ ] one-ticket-at-a-time execution is the default.

## Gemini

Use for:
- architecture review
- spec consistency
- database/schema review
- code review
- security review
- design critique
- ticket dependency review

Recommended first prompt:
`prompts/GEMINI_ARCHITECT_REVIEW_PROMPT.md`

## Antigravity

Use for:
- repository edits
- feature implementation
- migrations
- builds
- tests
- Docker/configuration
- ticket execution

Recommended first prompt:
`prompts/ANTIGRAVITY_IMPLEMENTATION_PROMPT.md`

Then use:
`prompts/ANTIGRAVITY_TICKET_PROMPT.md`

## Review loop

Antigravity implements → tests pass → Gemini reviews diff → developer approves/requests changes → commit.
