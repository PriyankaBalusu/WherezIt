# Architecture Review Decisions — 2026-08-14

Source: Gemini architecture review, adjudicated before implementation.

## Accepted

1. Strict non-empty StorageNode archive blocking.
2. Container archive with Items preserved.
3. PostgreSQL database-level guard for AI capture confirmation.
4. Retrieval Agent query expansion before PostgreSQL-backed search.
5. Authenticated Cloud Tasks invocation using OIDC and dedicated service account.
6. Preserve trusted internal QR resolver route through Firebase login.
7. Canonical BOX formatting with minimum three digits and unlimited growth.
8. Cloud Storage object keys prefixed by workspace/container UUIDs.

## Modified

- Deletion policy differs by entity:
  - StorageNode: archive blocked while non-empty.
  - Container: archive allowed with Items preserved.
- Cloud Tasks implementation may use a separately deployed private worker entry point or a protected route in the same service.

## Rejected

User-defined alternate canonical BOX formats such as `BOX 1`, `BOX 01`, or `box001`.

Wherezit owns the canonical BOX ID format. `display_id` is derived from `display_number`.
