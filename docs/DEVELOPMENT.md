# MATRIX LABS — Local Development

## Current milestone — V0.3.0

The repository contains a Tauri + React desktop app with a native Rust AI bridge.

V0.2 supports:
- Creating and deleting local agent profiles.
- Choosing an agent purpose and personality.
- Connecting Gemini or OpenAI through an API key.
- Saving and removing the MATRIX AI key through Windows Credential Manager.
- Sending recent chat history to the selected fixed HTTPS provider endpoint.
- Completing the demo task board and viewing MATRIX Credits.

V0.2 does not provide file access, email access, shell access, computer-use tools, voice, or microphone access. The model only returns chat text. Agent profiles, local conversation history, and demo credit state still use webview local storage. This is prototype persistence, not a hardened production database.

Read [AI_PROVIDER_SETUP.md](AI_PROVIDER_SETUP.md) before connecting MATRIX AI. A provider processes the agent instructions and recent chat messages. Provider usage or charges are separate from MATRIX Credits.

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

## Configure an AI provider\n\nIn the installed Windows app, open Settings, choose Gemini or OpenAI, set a model ID, and save the provider API key. The key is sent through Tauri IPC to Rust and saved in Windows Credential Manager. See [AI_PROVIDER_SETUP.md](AI_PROVIDER_SETUP.md) for privacy and model details.\n\n## Create a Windows installer

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
- Provider secrets are handled by the native Rust layer through Windows Credential Manager. Never store them in frontend storage or commit them.
- Keep the default Tauri capability list minimal and review every plugin permission before adding it.
- Treat model output as untrusted data and validate all proposed actions inside Rust.


## Build using GitHub Actions

The repository also includes a manual Windows installer workflow. From the repository page:

1. Open the Actions tab.
2. Select Build Windows installer.
3. Choose Run workflow on the main branch.
4. When the run succeeds, open the run and download the MATRIX-LABS-Windows-Installer artifact.

The downloaded artifact is a ZIP containing the NSIS setup executable. The workflow is manual; it does not create a public release or sign the installer.
