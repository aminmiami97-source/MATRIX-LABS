# MATRIX LABS

**A chat-first Windows AI workspace with named agents, shared models, and account-based MATRIX Credits.**

MATRIX LABS is a Windows desktop application where people create personal AI agents, customize their personalities, and chat with them. The current release is chat-only and cannot control Windows or access user files.

## V0.4 — MATRIX Network

The current codebase includes:

- Tauri 2 + Rust Windows desktop shell.
- React + TypeScript chat-first interface in a black-and-grey theme.
- Email/password sign-up and sign-in through Supabase Auth.
- Per-account local agent profiles and conversation history.
- A server-managed balance with a one-time 300 CRD welcome grant per newly registered account.
- Two fixed model choices:
  - **AGOORA 2.0** — liquid/lfm-2.5-2.6b:free
  - **MATRIX AI 1.0** — thinkingmachines/inkling-small:free
- One CRD reserved for each chat response, with an automatic refund when the model request fails.
- A Supabase Edge Function that validates the user session, model allowlist, credit balance, and rate limits before calling the model service.

## Important setup status

The repository contains the backend schema and Edge Function source, but the hosted Supabase project has not been connected or deployed. The Windows installer build needs the public Supabase project URL and publishable/anon key supplied as GitHub Actions secrets.

The shared model-routing key is not in the repository, frontend, build workflow, or Windows installer. A project administrator must add a newly rotated key to Supabase Edge Function Secrets as MATRIX_AI_ROUTER_KEY. Never reuse a key that has been pasted into a chat or screenshot.

See docs/SUPABASE_SETUP.md for the deployment checklist.

## Credit rules

- A newly created Auth account receives 300 CRD once via a Postgres trigger.
- The account balance and append-only ledger are stored server-side.
- Each successful AI reply costs 1 CRD.
- Failed model requests are refunded.
- The client cannot directly edit a credit balance or create ledger entries.
- Starter credits are a MATRIX LABS accounting unit, not model tokens or cash.
- The shared free-model service has separate rate limits; a 300 CRD balance does not promise 300 requests per day.

## Model and data privacy

Chat requests send the selected model ID, agent name/personality/purpose, and recent conversation messages to the server, which forwards them to the selected model service. No local files, email, screenshots, or other Windows content are sent in V0.4.

The AGOORA model listing states that prompts and outputs may be retained and used to train Liquid models. Do not send passwords, private keys, or sensitive personal information. Model availability and provider limits can change.

## Not enabled in V0.4

- No Windows file access or file modification.
- No email or other account integrations.
- No shell, PowerShell, script execution, or general computer-control tools.
- No microphone or voice calling.
- No model tool-calling capabilities are passed to the chat service.
- Agent profiles and conversation history are stored locally per signed-in account on the device; cloud sync is not implemented.

## Technology

- **Tauri 2 + Rust** — Windows desktop shell.
- **React + TypeScript** — UI.
- **Supabase Auth + Postgres + Edge Functions** — accounts, credits, server authorization, and chat gateway.
- **Server-only provider secret** — stored in Supabase Edge Function Secrets.

## Development

See docs/DEVELOPMENT.md for local build instructions and docs/SUPABASE_SETUP.md for hosted backend setup.

The goal is a standalone Windows installer. The current NSIS setup executable is an installer package, not a single portable application binary.
