# MATRIX LABS Security Baseline

Security is a core product feature, not a final polish task.

## Non-negotiable rules

- No unrestricted shell, PowerShell, Command Prompt, or arbitrary code execution for agents.
- No silent sending of emails, messages, or posts.
- No silent deletion, bulk modification, upload, purchase, or sharing of user data.
- No file access outside folders explicitly selected by the user.
- No hidden monitoring, keylogging, screen recording, or credential collection.
- An agent cannot grant itself permissions or expand its own scope.
- Users can inspect, pause, and revoke permissions.
- Secrets and provider keys must never be committed to Git or written to logs.

## Action pipeline

Every computer action must pass through this sequence:

1. The model proposes a typed, structured action.
2. The local policy layer checks that the capability is supported.
3. The scope checker verifies that the target is inside the user's grant.
4. The risk classifier determines the required confirmation level.
5. The UI displays the action and meaningful consequences.
6. The user approves or rejects the proposal where required.
7. The executor performs only the validated, approved operation.
8. An audit record stores the action type, target scope, result, and timestamp.

The model is never the authority that grants permissions. The native executor must independently validate every action; UI-only checks are insufficient.

## Permission model

Permissions must be narrow and independently revocable. Examples:

- Read files in one selected folder.
- Create files in one selected folder.
- Propose edits to a specific document.
- Apply a reviewed edit to a specific document.
- Create an email draft in a connected account.

Do not combine unrelated capabilities into a vague permission such as "control my PC". A grant should record the capability, resource scope, time granted, and status.

## Confirmation levels

- **Read-only:** May run under a persistent, clearly displayed permission within an approved scope.
- **Create or edit:** Show a preview and require approval before applying changes in the MVP.
- **High impact:** Sending, deleting, publishing, sharing, account/security changes, and external transactions require immediate confirmation for each action.

The user must see what will happen, which resource is affected, and whether the action can be undone.

## Data handling

- Store agent profiles and local history locally by default.
- Use OS-protected credential storage for API keys and OAuth tokens.
- Never embed a shared API key in a distributed executable or installer. A distributed key can be extracted and abused.
- Never ask for or store raw account passwords.
- Explain which conversation content or files are sent to an external model provider.
- Do not upload files unless the user explicitly approves that specific operation.
- Minimize retained content and provide controls to clear local conversations and history.
- Redact secrets from diagnostics and crash reports.
- V0.3 stores the MATRIX AI access key through the native Rust layer in Windows Credential Manager. It is not saved in localStorage, agent profiles, conversations, logs, or Git.
- V0.3 uses one fixed HTTPS chat-completions endpoint with redirects disabled; bearer credentials must never be forwarded to another host.
- V0.3 sends agent instructions and recent chat messages only. No local files or computer-control tools are sent to the model.
- In V0.2, store provider API keys through the native Rust layer in Windows Credential Manager. Never put keys in localStorage, agent profiles, conversation history, logs, or Git.
- Only allow the fixed HTTPS endpoints for the configured Gemini and OpenAI providers in V0.2. Redirects are disabled to avoid forwarding credentials to another host.
- Show a clear notice that the selected provider receives the agent's instructions and recent conversation history. Do not upload local files in V0.2.
- Keep the V0.2 model request chat-only: do not provide function tools, computer-control tools, shell access, or native action executors to the model.
- Treat all model responses as untrusted text. They are displayed in chat and are not executed.

## MATRIX Credits

MATRIX Credits are application-level points, not authentication credentials, cryptocurrency, cash, or AI provider tokens.

- Use an auditable local ledger rather than a single editable balance.
- Prevent duplicate rewards for the same task completion.
- Publish clear reward criteria.
- Do not reward invasive monitoring, spam, unnecessary personal-data collection, or unsafe actions.
- Never imply that earning credits pays an AI provider's bill.

## Release requirements

Before distributing a public build:

- Review native permission boundaries.
- Test path traversal and symlink edge cases in file operations.
- Test revocation while an agent session is active.
- Verify that destructive operations cannot bypass confirmation.
- Scan dependencies and avoid shipping unnecessary privileges.
- Sign release artifacts where practical and publish checksums.
- Provide clear privacy, data-retention, and security documentation.
