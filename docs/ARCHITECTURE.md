# MATRIX LABS Architecture (Initial Proposal)

This document defines the initial boundaries. It may evolve as implementation and security testing reveal better designs.

## High-level components

```text
┌───────────────────────────────────────────────┐
│              MATRIX LABS Desktop              │
│                                               │
│  React + TypeScript UI                        │
│  Dashboard · Agent Workshop · Chat · Settings │
│                    │                          │
│             Typed IPC requests                │
│                    ▼                          │
│  Tauri / Rust native application              │
│  ┌─────────────────────────────────────────┐  │
│  │ Agent coordinator                       │  │
│  │ Provider adapter                        │  │
│  │ Permission and policy engine             │  │
│  │ Confirmation workflow                    │  │
│  │ Narrow native action executors           │  │
│  │ Audit log and local persistence          │  │
│  └─────────────────────────────────────────┘  │
│                    │                          │
│           SQLite + OS credential vault        │
└───────────────────────────────────────────────┘
                       │
                       ▼
              Configured AI provider
```

## Trust boundaries

### User interface

The UI displays agents, permissions, action previews, approvals, and history. It is not the security boundary: a modified or compromised UI must not be able to bypass native policy checks.

### Agent coordinator

The coordinator sends conversation context to a configured provider and receives responses or structured action proposals. Model output is untrusted input. It must be schema-validated and treated as data, never as executable code.

### Policy engine

The policy engine is the authority for local capability checks. It verifies:

- The action type is on an explicit allowlist.
- The user has granted the exact capability.
- The target is inside the granted resource scope.
- Arguments satisfy strict validation and size limits.
- The required approval is present and still valid.
- The permission has not been revoked or expired.

### Native action executors

Each executor implements one narrow operation, such as reading a file in an approved folder or creating a document after confirmation. There should be no generic "run command" executor.

### Persistence

SQLite stores agent profiles, settings, credit ledger entries, permission grants, and action history. Secrets are stored separately using OS-protected credential storage. Secrets must not be stored in SQLite as plaintext.

## Proposed data concepts

- **Agent:** ID, display name, personality instructions, created/updated timestamps.
- **Conversation:** ID, agent ID, messages, timestamps, retention metadata.
- **PermissionGrant:** ID, capability, resource scope, status, granted/revoked timestamps.
- **ActionProposal:** ID, agent ID, action type, validated arguments, risk level, status.
- **ActionRecord:** ID, proposal ID, result, timestamp, undo metadata when available.
- **CreditLedgerEntry:** ID, amount, reason, task ID, timestamp, idempotency key.

A credit balance is computed from ledger entries; it is not the authoritative record by itself.

## Provider integration

Use a provider interface so API calls, model selection, usage reporting, and errors are isolated from the rest of the app.

Provider keys must be stored in the OS credential vault. Do not hardcode keys, bundle shared keys in the installer, or commit local environment files.

The app must clearly identify when content is sent to a provider. Provider usage and billing are distinct from MATRIX Credits.

## Initial implementation order

1. Desktop shell and navigation.
2. Local database and agent profile CRUD.
3. Provider settings and simple text chat.
4. Credit ledger and safe task catalog.
5. Permission center and audit history.
6. Typed document actions with preview and confirmation.
7. Later integrations such as email drafts and voice.

## Windows packaging

The goal is a standalone Windows installer. The exact Tauri bundling target, signing process, supported Windows versions, and update mechanism will be documented once the first build pipeline is tested on a clean Windows environment.
