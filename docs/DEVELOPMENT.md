# MATRIX LABS — Local Development

## Current milestone

The repository contains the first Tauri + React desktop scaffold and a local-only interface preview.

The preview supports:
- Creating and deleting local agent profiles.
- Choosing a purpose and personality for each profile.
- Sending messages to a local preview chat. No AI response is generated.
- Completing three onboarding tasks and earning demo MATRIX Credits.
- Viewing the permission center and settings.

The preview does not connect to an AI provider, read or write Windows files, connect to email, use the microphone, or execute computer actions. Agent profiles, task progress, credits, and preview chat state are stored in the webview local storage. This is prototype persistence, not a hardened production data store.

## Windows prerequisites

Use a 64-bit Windows 10/11 development machine with:

1. Node.js 20.19+ or 22.12+. A current Node.js LTS release is recommended.
2. Rust installed using rustup, with the MSVC toolchain.
3. Microsoft C++ Build Tools or Visual Studio Build Tools with the Desktop development with C++ workload.
4. WebView2 Runtime. It is included with current Windows 10/11 installations in most cases.

Official setup guide: https://v2.tauri.app/start/prerequisites/

## Run the desktop preview

Open PowerShell in the repository root and run:

    npm install
    npm run tauri:dev

The first run downloads and compiles dependencies. The Tauri window should open after the frontend dev server and Rust backend are ready.

## Create a Windows installer

On a Windows development machine, run:

    npm run tauri:build

The configured NSIS setup executable is written under:

    src-tauri/target/release/bundle/nsis/

This is an installer executable. It installs the application, including its app executable and required web assets. Do not confuse the setup executable with the installed application binary.

Official installer guide: https://v2.tauri.app/distribute/windows-installer/

## Safe development rules

- Never add a generic shell or PowerShell execution command for the agent.
- Do not enable filesystem or email access just to make a demo appear functional.
- Do not commit .env files, API keys, OAuth tokens, or local databases.
- Provider secrets must be handled by a native secure credential store in a later milestone.
- Keep the default Tauri capability list minimal and review every plugin permission before adding it.
- Treat model output as untrusted data and validate all proposed actions inside Rust.
