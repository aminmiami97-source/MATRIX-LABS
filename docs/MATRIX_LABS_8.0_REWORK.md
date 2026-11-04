# MATRIX LABS 8.0.0 — UI Rework

## Design direction
- Futuristic dark interface with violet as the primary accent.
- Graphite/navy surfaces, subtle violet lighting, restrained grid texture.
- Clear hierarchy, readable typography, consistent spacing and iconography.
- Responsive layouts for desktop, tablet and narrow mobile screens.

## Release approach
Develop on `feature/matrix-labs-8.0-ui-rework`. Keep the current stable release branch untouched until the redesign passes validation. Do not publish an 8.0.0 release until the acceptance checks below pass.

## Screen scope
1. **Overview** — workspace dashboard with live agent, message, credit and model data; shortcuts must navigate to real screens.
2. **Chat** — readable conversation history, responsive message layout, attachment flow, model selection, copy/regenerate actions, and clear sending/error states.
3. **Workspace / Agents** — create, open and delete agent profiles; preserve per-agent conversation history.
4. **Plugins** — show only working integrations. Gmail connect, status refresh, disconnect, compose and explicitly approved send must remain functional.
5. **Permissions** — accurately describe current access. Do not show planned controls as if they are available.
6. **Settings** — account, model preference, update check/download/install progress, and version information.
7. **Credits** — display server-backed account balance and guest quota accurately.

## Functional rules
- Every visible button must perform its stated action or be a clearly disabled status indicator.
- Remove fake/coming-soon integrations and inactive voice controls from the shipped UI.
- Preserve authentication, guest access, Supabase chat, credit enforcement, Gmail approval, local agent/message persistence, and Tauri updater behavior.
- Keep private credentials on the server or in GitHub Actions secrets; never put signing private keys in the app.
- Do not break the 7.2.0 updater while the 8.0.0 UI branch is in development.

## Acceptance checklist
- [ ] TypeScript and Vite production build pass.
- [ ] Windows Tauri build and signed updater artifacts pass.
- [ ] Overview metrics reflect live app state.
- [ ] Sidebar navigation, collapse controls and responsive layouts work.
- [ ] Create/open/delete agent and per-agent chat history work.
- [ ] Chat send, regenerate, copy, attachment and error states work.
- [ ] Model selection persists.
- [ ] Gmail connect/status/disconnect/send approval works.
- [ ] Account, guest quota and credit displays are accurate.
- [ ] Update check, signed download, install and relaunch are verified.
- [ ] No placeholder buttons, dead navigation or misleading capability claims.
- [ ] Manual test on Windows desktop and narrow mobile/tablet viewport.
