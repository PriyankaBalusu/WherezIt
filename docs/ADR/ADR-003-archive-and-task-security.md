# ADR-003 — Archive Semantics and Secure Background Task Invocation

Status: Accepted

## Archive semantics

### StorageNode

Archive is blocked while the node has active child nodes or active containers.

No recursive soft-delete cascade is performed in MVP.

### Container

A container may be archived with items intact.

Contained items remain historically preserved but are excluded from normal active search/browse when their container is archived.

### Item

Items may be archived individually.

### Hard delete

Hard delete is not part of normal MVP user workflows.

## Secure Cloud Tasks invocation

Cloud Tasks handlers must not be anonymously invokable.

Use a dedicated service account and OIDC-authenticated HTTP invocation.

The implementation may use:
- a separately deployed private Cloud Run worker entry point from the same codebase, or
- a protected internal task route in the same Cloud Run service.

The selected option must preserve the modular-monolith code architecture and least-privilege security.
