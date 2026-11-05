# MATRIX LABS 8.1.0 — Development Plan

## Release direction

**Theme:** The Evolution Update  
**Primary objective:** Refine the existing MATRIX LABS 8.0 visual identity and make the dashboard a more useful command center.  
**Visual direction:** Preserve the dark futuristic interface and violet accent system. Improve hierarchy, spacing, responsiveness, and interaction clarity rather than replacing the design.

## Workstreams

### 1. Dashboard 2.0 — first implementation
- [x] Replace the basic overview layout with a command-center dashboard.
- [x] Add a conversation continuation panel using existing agent and message data.
- [x] Add functional quick-launch actions for chat, agent creation, settings, plugins, and permissions.
- [x] Add a workspace pulse panel for session, model, quota/credits, and app version.
- [x] Add responsive dashboard layout rules for narrower windows.
- [ ] Validate empty, guest, and signed-in states in the desktop app.
- [ ] Verify all dashboard actions navigate to the intended screens.

### 2. AGOORA and chat experience
- [x] Review the chat experience and identify functional defects.
- [ ] Improve conversation navigation.
- [x] Improve failed-send feedback: announce errors accessibly, remove failed optimistic messages, and restore the user's draft and attachments for retry.
- [x] Preserve existing model routing and server-side credit/quota rules.

### 3. Guest and account experience
- [ ] Audit guest onboarding, quota messaging, and account conversion.
- [ ] Improve account state clarity without changing server-side security rules.
- [ ] Test sign-in, sign-up, recovery, and guest flows.

### 4. Settings 2.0
- [ ] Organize settings into clear sections.
- [ ] Improve preference discoverability and feedback.
- [ ] Keep updater behavior and signing configuration unchanged.

### 5. Update Center
- [ ] Improve release-note presentation and update status clarity.
- [ ] Preserve the verified Tauri updater flow.
- [ ] Test an in-app upgrade from the previous stable release.

## Release gates
- [ ] TypeScript and Vite production build pass.
- [ ] Windows installer workflow passes.
- [ ] Dashboard tested with no agents, multiple agents, guest mode, and signed-in account.
- [ ] All navigation and quick actions verified.
- [ ] Chat, credits, guest quota, and account flows regression-tested.
- [ ] In-app update to 8.1.0 verified before public release.

## Versioning rule

The application/package/Tauri version markers are currently aligned to 8.1.0. Before publication, verify that the updater manifest, installer filename, signature, and latest.json all reference the same 8.1.0 release. Do not publish until the installer, signature, and manifest are verified.
