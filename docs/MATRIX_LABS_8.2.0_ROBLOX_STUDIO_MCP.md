# MATRIX LABS 8.2.0 — Roblox Studio MCP Integration

## Objective

Build a first-class Roblox Studio workspace into MATRIX LABS and connect AGOORA to the official Roblox Studio MCP server. The experience combines a visual editor/workspace with permissioned AI-assisted development.

Roblox Studio includes a local MCP server. On Windows, Roblox documents the launcher as:

    cmd.exe /c %LOCALAPPDATA%\\Roblox\\mcp.bat

The server uses stdio transport. It supports Studio discovery, DataModel hierarchy exploration, instance inspection, script search/read/edit, Luau execution, playtesting, Output retrieval, and viewport screenshots. The exact available tool set must be discovered from the running Studio version at connection time rather than hardcoded as guaranteed capabilities.

## Architecture

    React UI → typed Tauri commands → Rust MCP client/process manager → local Roblox Studio MCP stdio process → selected Studio instance

- **React workspace:** connection status, Studio selector, Explorer, script editor, inspector, Output, viewport, action preview, and activity history.
- **Tauri/Rust bridge:** owns process lifecycle, JSON-RPC request IDs, stdio framing, timeouts, cancellation, and response validation.
- **MCP client:** starts only the documented Roblox launcher; initializes the protocol; discovers tools dynamically; routes calls to a selected Studio ID.
- **Policy layer:** enforces read-only mode by default and gates every mutating capability behind a typed permission and a fresh confirmation.
- **AGOORA:** proposes structured actions; it never receives an unrestricted shell or raw process-control tool.

## Delivery sequence

### Phase 1 — Native connection foundation
- [ ] Add a fixed-path Windows MCP process manager in Rust.
- [ ] Implement MCP initialize/initialized handshake and JSON-RPC request correlation.
- [ ] Discover server capabilities and tool schemas dynamically.
- [ ] Implement list-Studios and clean disconnect/reconnect.
- [ ] Expose typed Tauri commands and connection events.
- [ ] Add process exit detection, request timeouts, and app-shutdown cleanup.

### Phase 2 — Visual read-only workspace
- [x] Add a dedicated Roblox Studio navigation item and initial connection workspace page.
- [x] Show connection state, dynamically discovered MCP tools, and the Studio discovery response.
- [x] Parse Studio instances into selectable targets with place IDs and selected target (with a manual Studio ID fallback).
- [x] Add a bounded-depth Explorer hierarchy query.
- [x] Add read-only instance property/attribute inspection.
- [x] Add script name search, content search, and read-only Luau viewer.
- [x] Add Output viewer and viewport screenshot panel.
- [x] Enforce a Rust-side allowlist and validate tool arguments before forwarding requests.
- [ ] Add loading, empty, disconnected, and error states.

### Phase 3 — Controlled editing
- [ ] Add an AI task planner that turns a request into a typed list of proposed Studio operations.
- [ ] Add editable Luau view with syntax-aware presentation.
- [ ] Read the current script immediately before preparing a write; reject stale previews if the source changed.
- [ ] Generate exact before/after diffs for every script edit.
- [ ] Validate each target path, script class, edit operation, and payload against the live MCP tool schema.
- [ ] Require one explicit user confirmation for the complete displayed batch; no hidden follow-up writes.
- [ ] Bind approval to a one-time plan ID and content hash so edits cannot be changed after approval.
- [ ] Record target, before/after content, timestamp, and result in local activity history.
- [ ] Add safe recovery/undo where Roblox MCP supports it; otherwise preserve a local backup and explain limits.
- [ ] Keep multi_edit isolated from execute_luau, asset insertion, and playtest permissions.

### Phase 4 — AGOORA orchestration
- [ ] Convert user requests into typed action plans.
- [ ] Validate tool names and arguments against discovered MCP schemas.
- [ ] Provide only the minimum relevant game context to the model.
- [ ] Require confirmation before script writes, Luau execution, asset insertion, or playtest state changes.
- [ ] Keep a visible action log and stop/cancel control.

### Phase 5 — Playtest and debugging
- [ ] Add explicit start/stop playtest controls.
- [ ] Display Output messages and errors for the selected Studio session.
- [ ] Capture viewport screenshots on request.
- [ ] Let AGOORA analyze errors and propose fixes without silently applying them.
- [ ] Validate behavior across multiple Studio windows.

### Phase 6 — Release hardening
- [ ] Test missing Studio, disabled MCP, malformed responses, timeouts, process crash, Studio shutdown, and reconnect.
- [ ] Verify app shutdown always terminates the owned MCP process.
- [ ] Test Windows installer on a clean Windows profile.
- [ ] Document local data handling, model context transfer, permissions, and limitations.

## Safety and permission model

1. **Read-only default:** only discovery, hierarchy, inspection, script read/search, Output, and screenshot tools are available initially.
2. **No arbitrary process execution:** the launcher path is fixed by the app. Model output cannot choose a command, executable, or arguments for process launch.
3. **No hidden mutations:** `multi_edit`, `execute_luau`, asset insertion, and playtest controls remain blocked until the policy/approval layer is complete.
4. **Preview then approve:** every future write displays the exact target and proposed change before the user confirms.
5. **Untrusted content:** scripts, Output, tool descriptions, and AI responses are data, not instructions to the host application.
6. **Local-first:** Studio content stays on the device unless the user explicitly requests an AI task that needs selected context. Show what context will be sent.
7. **No Roblox account secrets:** never request or store Roblox passwords, cookies, or session tokens.

## Technical decisions

- Target platform for the first release: Windows desktop (Tauri 2).
- Use Roblox's built-in MCP server rather than a custom Roblox plugin or unofficial reverse-engineered API.
- Use stdio through a native Rust process manager; do not try to connect the browser frontend directly to the local process.
- Discover tools at runtime because the installed Studio version determines the available tool set.
- Keep MCP transport and tool policy in the Rust layer; frontend visibility is not a security boundary.
- Keep this integration separate from MATRIX Credits, model routing, guest quotas, and updater behavior.

## Official references

- Roblox Studio MCP setup and tool reference: https://create.roblox.com/docs/studio/mcp
- Roblox AI accelerated workflows: https://create.roblox.com/docs/ai/accelerated-workflows
- Roblox Script Sync: https://create.roblox.com/docs/scripting/sync

## Status

The native connection foundation and initial workspace are merged. The next read-only workspace pass adds a target Studio selector, Explorer hierarchy queries, script search/read, instance inspection, Output retrieval, and viewport capture through a fixed Rust-side allowlist. The next editing milestone is a typed AI plan + exact diff + one-time approval token + audit/recovery record. Script writes, Luau execution, asset insertion, and playtesting remain disabled until their separate permission gates are implemented. No Roblox Studio connection is active until the user installs an updated Windows app and enables Studio's MCP server.
