# MATRIX LABS

**A chat-first Windows AI workspace with named agents, shared models, and account-based MATRIX Credits.**

MATRIX LABS is a Windows desktop application built with Tauri 2, Rust, React, and TypeScript. Users can create personal AI agents, customize their personalities, and chat with the available MATRIX models.

## Current application

- Tauri 2 + Rust Windows desktop shell, distributed as a per-user NSIS installer.
- React + TypeScript interface with a graphite, cyan, and violet visual system.
- Supabase Auth email/password sign-up and sign-in, plus guest access.
- Local agent profiles and conversation history, separated by signed-in account on each device.
- Server-managed MATRIX Credits: one-time 300 CRD welcome grant for new registered accounts.
- Two model choices:
  - **AGOORA 2.0** — `liquid/lfm-2.5-2.6b:free`
  - **MATRIX AI 1.0** — `thinkingmachines/inkling-small:free`
- One CRD reserved per successful AI response, with automatic refund on failed model requests.
- Supabase Edge Function validates sessions, model allowlist, credit balance, and rate limits before calling the model service.
- Optional Gmail connection for approved email workflows.

## Application updates

The Settings page includes **Check for updates**. MATRIX LABS also checks for a newer public GitHub release when the app starts and displays an in-app notification when one is available.

When a release is available, the user can choose **Download update**. The app opens the Windows installer attached to the latest GitHub Release; the user runs that installer to replace the installed version. The app does not silently install software or run downloaded files.

### Publishing a release

1. Update the version in all three files so they match:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
   - Also update `APP_VERSION` in `src/NetworkApp.tsx`.
2. Commit and push the version change to `main`.
3. Create and push a matching version tag, for example `v0.8.0`.
4. The **Build Windows installer** workflow builds the NSIS installer and attaches the `.exe` to the GitHub Release for that tag.
5. Users on older versions will see the release on their next startup check or when they press **Check for updates**.

The first release containing the update checker must be installed manually by existing users because earlier builds do not contain the checker. Later releases can be discovered from inside the app.

## Backend setup

The hosted Supabase project is configured separately from the desktop build. The repository contains the database schema and Edge Function source.

The Windows build uses these public client configuration values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or a Supabase publishable key)

The shared model-routing key must remain in Supabase Edge Function Secrets as `MATRIX_AI_ROUTER_KEY`. Never put a Supabase service-role/secret key or the model-routing key in frontend code, GitHub build variables, or the Windows installer.

See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for the backend deployment checklist and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for local development.

## Credit rules

- A new registered Auth account receives 300 CRD once through a Postgres trigger.
- Account balances and the append-only credit ledger are stored server-side.
- Each successful AI reply costs 1 CRD.
- Failed model requests are refunded.
- The client cannot directly edit balances or create ledger entries.
- CRD is an internal MATRIX LABS accounting unit, not cash or model tokens.
- Model providers may impose separate rate limits; a 300 CRD balance does not guarantee 300 requests per day.

## Model and data privacy

Chat requests send the selected model ID, agent name/personality/purpose, and recent conversation messages to the server, which forwards them to the selected model provider. Local files and general Windows content are not sent to the chat service.

The AGOORA model listing states prompts and outputs may be retained and used to improve Liquid models. Do not send passwords, private keys, or sensitive personal information. Provider availability and limits can change.

## Not included

- No general Windows file access or file modification.
- No shell, PowerShell, arbitrary script execution, or general computer-control tools.
- No microphone or voice calling.
- No general-purpose model tool execution.
- Agent profiles and conversation history are stored locally per account and device; cloud sync is not implemented.

## Technology

- **Tauri 2 + Rust** — desktop shell and installer.
- **React + TypeScript** — application UI.
- **Supabase Auth + Postgres + Edge Functions** — accounts, credits, authorization, and chat gateway.
- **GitHub Releases** — Windows installer distribution and update discovery.

## Development

Requirements: Windows 10/11 64-bit, Node.js 20.19+ or 22.12+, Rust with the MSVC toolchain, Microsoft C++ Build Tools, and WebView2 Runtime.

```bash
npm install
npm run tauri:dev
```

Build the Windows installer:

```bash
npm run tauri:build
```

The NSIS installer is generated under `src-tauri/target/release/bundle/nsis/`. It is an installer package, not a portable single-file application binary.
