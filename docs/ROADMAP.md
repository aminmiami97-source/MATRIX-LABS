# MATRIX LABS Roadmap

## Phase 0 — Project foundation
- [x] Confirm product direction.
- [x] Locate the MATRIX-LABS GitHub repository.
- [x] Initialize the default branch.
- [x] Add architecture and security documentation.
- [ ] Pin the development toolchain.
- [x] Add local development instructions.

## Phase 1 — Windows desktop shell
- [x] Create Tauri 2 + React + TypeScript application scaffold.
- [x] Build the first MATRIX LABS navigation and visual interface preview.
- [ ] Add first-run setup and local profile.
- [x] Add Windows development and installer instructions.
- [x] Produce the first locally runnable Windows build.

## Phase 2 — Agent Workshop
- [x] Create and delete agent profiles.
- [x] Configure agent name, purpose, and personality presets.
- [ ] Persist agent profiles locally.
- [x] Add provider-backed text chat UI and native request bridge (requires provider API key).
- [x] Add Gemini and OpenAI provider adapters.
- [x] Store provider credentials using Windows Credential Manager.
- [ ] Display provider usage separately from MATRIX Credits.

## Phase 3 — MATRIX Credits
- [ ] Implement a local append-only credit ledger.
- [ ] Add safe onboarding and productivity tasks.
- [ ] Prevent duplicate task rewards.
- [ ] Explain reward criteria and balances.
- [ ] Keep credits separate from AI provider billing and model tokens.

## Phase 4 — Permission Center
- [ ] Implement explicit capability grants.
- [ ] Add user-selected folder scopes.
- [ ] Add permission review and revocation.
- [ ] Add typed action proposals and native validation.
- [ ] Add confirmation dialogs and action history.

## Phase 5 — Document Assistant
- [ ] Read files only inside approved folders.
- [ ] Create a new document after confirmation.
- [ ] Preview edits before applying them.
- [ ] Add safe rollback or versioned backups where possible.
- [ ] Test revocation, path traversal, and filesystem edge cases.

## Phase 6 — Communication and voice
- [ ] Add email account connection through a supported authorization flow.
- [ ] Start with draft creation, not automatic sending.
- [ ] Require immediate confirmation before sending any external message.
- [ ] Add voice input and text-to-speech.
- [ ] Add clear indicators when the microphone is active.

## Phase 7 — Release
- [ ] Test on clean Windows 10/11 environments.
- [ ] Add installer metadata and code signing where available.
- [ ] Add verified update delivery and rollback strategy.
- [ ] Publish privacy, data-retention, and security documentation.
- [ ] Create release checksums and a reproducible build process.


## V0.2 verification still required
- [ ] Run the Windows installer workflow against the V0.2 code.
- [ ] Smoke-test Gemini and OpenAI with user-provided, valid API keys.
- [ ] Verify key save, app restart, chat request, and key removal on a clean Windows user profile.
- [ ] Add provider usage reporting. Provider usage remains separate from MATRIX Credits.
