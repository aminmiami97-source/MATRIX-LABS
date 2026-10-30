# MATRIX LABS

**Personal AI agents for Windows — built around permission, personality, and user control.**

MATRIX LABS is a Windows desktop application where people can create named AI-agent profiles, customize their personalities, talk with them, and gradually grant them narrowly scoped abilities to help with everyday computer tasks.

The product direction includes agent profiles, text and voice conversations, a transparent in-app credit system, document workflows, and carefully scoped integrations such as email drafts.

## Product principles

1. **The user stays in control.** Agents never receive unrestricted control of Windows.
2. **Permissions are specific.** Access is granted per capability and, where possible, per folder or account.
3. **Actions are visible.** Meaningful changes are previewed before execution.
4. **Sensitive actions require confirmation.** Sending messages, deleting data, sharing information, or changing account settings must never happen silently.
5. **Permissions are revocable.** Users can inspect and disable every grant.
6. **Credits are not model tokens.** MATRIX Credits are an in-app reward currency. Provider usage and costs are tracked separately.
7. **Local-first by default.** Agent profiles, settings, and action history stay on the device unless a feature clearly requires an external service.

## Current build — 0.1.0 preview

The repository contains a Tauri 2 + Rust desktop shell and a React + TypeScript interface.

Working in the local preview:
- Create and delete agent profiles.
- Set an agent's name, purpose, and personality preset.
- Open a local chat preview and save messages on this device.
- Complete three onboarding tasks and earn demo MATRIX Credits.
- View the permission catalog and local settings.

Not connected yet:
- No AI model/provider is connected. Chat replies are preview notices, not generated answers.
- No Windows files are read or modified.
- No email accounts are connected.
- No microphone or voice features are enabled.
- No shell, PowerShell, or arbitrary command execution is available.
- Agent and task data currently uses webview local storage; this is prototype persistence, not the final hardened database.

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for Windows setup and build commands.

## MVP scope

The first full release aims to include:
- A polished Windows desktop application.
- Custom agent names, personalities, and instructions.
- Text chat through a user-configured AI provider.
- Secure storage for provider credentials.
- MATRIX Credits and safe, verifiable tasks.
- A permission center with clear scopes and revocation.
- A file workspace limited to folders the user explicitly selects.
- Preview-first document creation and editing.
- Local action history.

Voice and email integrations are later milestones. The first email milestone should create drafts; sending must require a separate, immediate confirmation.

## Planned technology

- **Tauri 2 + Rust** for the Windows desktop shell and privileged local operations.
- **React + TypeScript** for the user interface.
- **SQLite** for local agent profiles, settings, credit ledger, and action history.
- **Windows Credential Manager** (or an appropriately protected OS credential API) for secrets.
- A provider adapter so model services can be changed without rewriting the agent runtime.

Exact dependency versions are pinned in package.json. A package lockfile should be committed after the first Windows npm install.

## Security boundary

The AI model does not run arbitrary shell commands and does not get direct, unrestricted filesystem access. It proposes typed actions. A local policy layer checks capability, scope, arguments, and confirmation requirements before the native executor performs the operation.

Read [SECURITY.md](SECURITY.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Repository structure

    MATRIX-LABS/
    ├── src/                  # React application
    ├── src-tauri/            # Tauri + Rust desktop shell
    ├── docs/
    │   ├── ARCHITECTURE.md
    │   ├── DEVELOPMENT.md
    │   └── ROADMAP.md
    ├── SECURITY.md
    ├── package.json
    └── README.md

## Development status

**Current stage:** Desktop shell and UI preview  
**Initial target:** Windows 10/11 x64  
**Distribution goal:** A signed Windows setup executable and installed desktop application

The NSIS setup executable is an installer, not a portable single-file app binary. Build and packaging details are documented in the development guide.

## License and contributions

A public license and contribution policy will be added before wider distribution. Until then, the repository is a project workspace and no additional reuse permissions are granted by this README.
