# MATRIX LABS — MATRIX AI Service

## V0.4 connection model

Users do not enter an API key. MATRIX LABS uses one shared model-routing service behind an authenticated Supabase Edge Function.

The shared key is stored as a server-side Edge Function secret named MATRIX_AI_ROUTER_KEY. It is not bundled into the desktop app, written to localStorage, or committed to GitHub.

The app offers two fixed model choices:

- AGOORA 2.0 — liquid/lfm-2.5-2.6b:free
- MATRIX AI 1.0 — thinkingmachines/inkling-small:free

The server accepts only these model IDs. The client cannot submit an arbitrary model ID or URL.

## Credit policy

- New Auth accounts receive 300 CRD once.
- One successful AI response costs 1 CRD.
- The server reserves a credit before sending the request.
- The server refunds the reserved credit if the model service fails.
- Credit balance and ledger are stored in Postgres, not browser storage.
- Free-model service limits apply separately from the user's credit balance.

## Privacy and data flow

For each chat request, the desktop app sends the selected model ID, agent name/purpose/personality, recent messages, and a unique request ID to the MATRIX chat Edge Function.

The Edge Function validates the Supabase user session and checks the credit balance and rate limits. It then sends only the agent instructions and chat messages to the selected model service.

No local files, email, screenshots, browser data, or other Windows content are sent in V0.4. No computer tools, file tools, or shell commands are provided to the model.

Model services may have their own prompt retention and training policies. The AGOORA model listing states prompts and outputs may be retained and used to train Liquid models. Users should not send passwords, private keys, or sensitive personal information.

## Admin setup

A responsible project administrator should configure the hosted project. See docs/SUPABASE_SETUP.md.

Never reuse an exposed API key. Revoke it, create a fresh key, and add it only in Supabase Dashboard → Edge Function Secrets as MATRIX_AI_ROUTER_KEY. Do not paste the replacement key into ChatGPT, GitHub, screenshots, or application settings.

The app UI uses the MATRIX AI name; the technical data-flow and service details are documented here for transparency.
