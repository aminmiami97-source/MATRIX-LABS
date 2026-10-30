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


## V0.3 — Chat-first MATRIX AI
- [x] Make Chat the default home screen.
- [x] Move agents into a compact conversation sidebar.
- [x] Apply a neutral black-and-grey visual theme and reduce icon sizes.
- [x] Add one generic MATRIX AI connection setting.
- [x] Use one fixed HTTPS chat-completions endpoint with a user-entered key.
- [x] Keep the key in Windows Credential Manager, not source code or frontend storage.
- [ ] Build and test the V0.3 Windows installer.
- [ ] Test with a newly rotated key and a model available to the account.
- [ ] Add visible provider usage reporting and configurable usage limits.


## V0.4 — MATRIX Network
- [x] Add Supabase Auth sign-up and sign-in screens.
- [x] Add a one-time 300 CRD welcome grant through a database trigger.
- [x] Add a server-side credit ledger, reservation, and refund functions.
- [x] Allow only AGOORA 2.0 and MATRIX AI 1.0 model IDs in the chat backend.
- [x] Move the shared model-routing key out of the desktop app and into an Edge Function secret.
- [x] Add a 1 CRD successful-response charge and server-side rate limits.
- [x] Separate local agent and conversation storage by signed-in account.
- [ ] Connect a hosted Supabase project and apply the migration.
- [ ] Configure the server-only model key with a newly rotated key.
- [ ] Add the public Supabase URL and publishable key to GitHub Actions secrets.
- [ ] Build and test the V0.4 Windows installer.
- [ ] Test email verification, model responses, credit refunds, and account separation.
- [ ] Add account deletion and privacy export controls.
