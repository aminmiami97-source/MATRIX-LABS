# MATRIX LABS — Development Guide

## Current milestone — V0.4.0

V0.4 uses a hosted Supabase project for accounts, server-side MATRIX Credits, and authenticated chat requests.

The desktop app includes:
- Email/password sign-up and sign-in.
- Two model choices: AGOORA 2.0 and MATRIX AI 1.0.
- A server-managed 300 CRD welcome grant per new account.
- One CRD charge per successful model response, with refunds for failed requests.
- Local agent and conversation data separated by signed-in account.

The app does not provide file access, email access, shell access, voice, microphone, or computer-use tools. The model only returns chat text.

## Windows prerequisites

Use a 64-bit Windows 10/11 development machine with:
1. Node.js 20.19+ or 22.12+.
2. Rust installed using rustup with the MSVC toolchain.
3. Microsoft C++ Build Tools with the Desktop development with C++ workload.
4. WebView2 Runtime.

Official Tauri prerequisites: https://v2.tauri.app/start/prerequisites/

## Configure the frontend

Copy the public values from the Supabase project into a local .env file, based on .env.example:

    VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY

These are public client configuration values. Row Level Security protects the database. Never put a Supabase secret/service key or the model-routing key in the frontend environment.

## Run the desktop app

    npm install
    npm run tauri:dev

## Build a Windows installer

    npm run tauri:build

The NSIS installer is written under:

    src-tauri/target/release/bundle/nsis/

## Backend

Read docs/SUPABASE_SETUP.md. The Supabase project administrator must:
- Apply the SQL migration.
- Deploy the matrix-chat Edge Function.
- Enable email confirmation.
- Set MATRIX_AI_ROUTER_KEY in Supabase Edge Function Secrets.
- Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to GitHub Actions secrets before building a configured installer.

The model-routing key is server-only. It is never required by the Windows build and must never be committed to GitHub.

## Safe development rules

- Never add a generic shell or PowerShell command tool to the agent.
- Do not enable filesystem or email access to make a demo appear functional.
- Do not commit .env files, API keys, OAuth tokens, or local databases.
- Do not trust local credit values; the server ledger is authoritative.
- Keep the model allowlist fixed to the two free model IDs until a separate reviewed release updates the server policy.
- Treat model output as untrusted text. It must not be executed.
