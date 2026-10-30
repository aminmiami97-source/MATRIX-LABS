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
- Shared model-routing secrets must never be committed to Git or bundled into the Windows installer.

## V0.4 server boundaries

- Supabase Auth issues the user session. The Edge Function validates the bearer session before processing chat.
- The desktop app contains only the public Supabase project URL and publishable/anon key.
- The shared model API key is stored only as a Supabase Edge Function secret named MATRIX_AI_ROUTER_KEY.
- The model endpoint is fixed in server code. The client cannot supply an arbitrary URL.
- The server allowlists exactly two free model IDs. It does not accept arbitrary model strings or paid models.
- The Edge Function passes no computer tools, file tools, email tools, shell tools, or function-call definitions to the model.
- The model receives agent instructions and recent chat messages only. No local files or Windows content are uploaded.
- The shared server enforces user and global request limits before forwarding chat requests.
- A one-time 300 CRD welcome grant is created by a Postgres trigger. The client cannot insert credit ledger rows or update account balances.
- One CRD is reserved per request and refunded if the upstream model request fails.
- Free-model endpoints can still be rate-limited or unavailable. The starter balance is not a guaranteed daily request count.

## Account and credit model

- Credit account rows are created from new Supabase Auth user records.
- The welcome grant is protected by a unique ledger index so a trigger retry does not duplicate the grant.
- Row Level Security permits users to read only their own account and ledger.
- Only the server-side service role can call the credit reservation/refund functions.
- Do not use localStorage or a client-side value as the authority for a credit balance.
- Add anti-abuse controls such as email verification, CAPTCHA, per-user rate limits, and monitoring before a public launch.

## Model data handling

Chat requests include the agent's name, purpose, personality instructions, recent messages, and selected model ID. The server sends those values to the external model-routing service and selected model provider. Their privacy, retention, and training policies apply. Liquid's current AGOORA listing states prompts and outputs may be retained and used to train Liquid models. The UI and docs must warn users not to send passwords or sensitive information.

## Existing device safety boundary

The V0.4 model request is chat-only. Model output is displayed as text and is never executed. The app does not have filesystem, shell, email, microphone, or other computer-control capabilities enabled.

When future computer actions are introduced, every action must pass through a typed native policy layer that validates capability, resource scope, arguments, permission status, and confirmation requirements. The model must never be the authority that grants permissions.

## Release requirements

Before public distribution:
- Rotate any exposed API keys and verify that no secrets exist in repository history, logs, screenshots, or release artifacts.
- Verify that only the Edge Function can read the shared model key.
- Test email verification, RLS, credit grants, reservation, and refunds.
- Test concurrent requests to ensure credit balances cannot become negative.
- Test shared rate limits and failed upstream responses.
- Review dependency and installer permissions.
- Publish privacy, data-retention, support, and account-deletion documentation.
