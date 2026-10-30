# MATRIX LABS

**Personal AI agents for Windows — built around permission, personality, and user control.**

MATRIX LABS is a standalone Windows desktop application where people can create named AI agents, customize their personalities, talk with them, and gradually grant them narrowly scoped abilities to help with everyday computer tasks.

The product direction includes agent profiles, text and voice conversations, a transparent in-app credit system, document workflows, and carefully scoped integrations such as email drafts.

## Product principles

1. **The user stays in control.** Agents never receive unrestricted control of Windows.
2. **Permissions are specific.** Access is granted per capability and, where possible, per folder or account.
3. **Actions are visible.** Meaningful changes are previewed before execution.
4. **Sensitive actions require confirmation.** Sending messages, deleting data, sharing information, or changing account settings must never happen silently.
5. **Permissions are revocable.** Users can inspect and disable every grant.
6. **Credits are not model tokens.** MATRIX Credits are an in-app reward currency. Provider usage and costs are tracked separately.
7. **Local-first by default.** Agent profiles, settings, and action history stay on the device unless a feature clearly requires an external service.

## MVP scope

The first usable release aims to include:

- A polished Windows desktop application.
- Create, rename, and delete agents.
- Configure each agent's name, personality, and instructions.
- Text chat using a user-configured AI provider.
- Secure storage for provider credentials.
- MATRIX Credits balance and a small set of safe, verifiable tasks.
- A permission center with clear scopes and revocation.
- A file workspace limited to folders the user explicitly selects.
- Preview-first document creation and editing.
- A local action history.

Voice and email integrations are later milestones. The first email milestone should create drafts; sending must require a separate, immediate confirmation.

## Planned technology

- **Tauri 2 + Rust** for the Windows desktop shell and privileged local operations.
- **React + TypeScript** for the user interface.
- **SQLite** for local agent profiles, settings, credit ledger, and action history.
- **Windows Credential Manager** (or an appropriately protected OS credential API) for secrets.
- A provider adapter so model services can be changed without rewriting the agent runtime.

Exact dependency versions and build instructions will be pinned when the application scaffold is added.

## Security boundary

The AI model does not run arbitrary shell commands and does not get direct, unrestricted filesystem access. It proposes typed actions. A local policy layer checks capability, scope, arguments, and confirmation requirements before the native executor performs the operation.

Read [SECURITY.md](SECURITY.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Planned repository structure

```text
MATRIX-LABS/
├── apps/
│   └── desktop/          # Tauri + React desktop application
├── crates/
│   └── agent-core/       # Rust policy and action execution layer
├── docs/
│   ├── ARCHITECTURE.md
│   └── ROADMAP.md
├── SECURITY.md
└── README.md
```

## Development status

**Current stage:** Project foundation  
**Initial target:** Windows 10/11 x64  
**Distribution goal:** A signed Windows installer / standalone application package

The first engineering milestone is a runnable desktop shell with agent creation and chat. Computer actions are intentionally scheduled after the permission and audit systems exist.

## Building

Build and packaging instructions will be added with the first runnable desktop scaffold. Do not run untrusted scripts or grant broad system permissions to experimental builds.
