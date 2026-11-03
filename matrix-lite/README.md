# MATRIX LITE — v1.2.0

MATRIX LITE is a responsive AI chat website with two model choices. Visitors do not enter or provide an API key. Every chat request is routed through a Supabase Edge Function that uses the owner's server-side OpenRouter key.

## Live websites

- Supabase-hosted site: https://ndpgjqowvqabozvfgeab.supabase.co/functions/v1/matrix-lite-site
- GitHub Pages site: https://aminmiami97-source.github.io/MATRIX-LABS/

## Models

- **MATRIX SIMPLE** — `nvidia/nemotron-3.5-lightning:free`
- **MATRIX LITE** — `nvidia/nemotron-3.5-super-vl:free`

Free provider capacity and availability are not guaranteed and may change.

## MATRIX LITE v1.2.0

- Server-Sent Events streaming: responses appear as tokens arrive instead of waiting for a complete answer.
- Stop Generation: cancels the browser request; the backend passes request cancellation upstream.
- Regenerate: retries the most recent assistant response using the preceding conversation.
- Safe, dependency-free Markdown rendering: headings, paragraphs, lists, blockquotes, links, emphasis, inline code and fenced code blocks.
- Copy response and Copy code actions.
- Retains the v1.1.0 independent chat scroll, visual refresh and mobile-friendly layout.

## Architecture

- `matrix-lite/index.html` — self-contained static frontend; CSS and JavaScript are in the same file.
- Supabase Edge Function `matrix-lite-site` — serves the website over HTTPS.
- Supabase Edge Function `matrix-lite-chat` — validates requests, applies shared limits, and streams OpenRouter responses to the browser.
- Supabase migration `202611020001_matrix_lite_public_chat_limits.sql` — shared usage-limit table and RPC function.
- Conversation history and model preference are stored in each visitor's browser local storage. No chat history table is used.

## Owner setup: one shared OpenRouter key

1. Create an OpenRouter API key in your OpenRouter account.
2. Open Supabase project **ndpgjqowvqabozvfgeab**.
3. Navigate to **Edge Functions → Secrets**.
4. Add a secret named `MATRIX_LITE_OPENROUTER_KEY` with your OpenRouter key as its value.
5. Save. The Edge Function reads this key on the server; it is not committed to this repository or sent to visitors.

The backend also supports the existing `MATRIX_AI_ROUTER_KEY` fallback if it is already configured.

Never paste an OpenRouter key into source code, GitHub, a public website setting, or a chat message.

## Shared limits and request safeguards

- Global maximum: 40 allowed chat requests per UTC day.
- Per-IP maximum: 10 requests per UTC hour bucket.
- Only the two listed model IDs are accepted.
- Message count, total request size, per-message length and output tokens are bounded.
- If the database-backed rate limiter is unavailable, chat fails closed.
- Browser cancellation is propagated to the upstream model request.

OpenRouter and its providers may apply lower or different limits. A shared key means all visitors consume the same free-model capacity, so unlimited availability cannot be guaranteed.

## Privacy

Messages are sent to OpenRouter and the selected model provider. Provider policies may apply. Visitors should not send passwords, personal information, confidential files, or other sensitive content. Conversation history remains local to the visitor's browser; clearing browser storage removes that local history.

## Version history

- `v1.2.0` — streaming responses, Stop Generation, Regenerate Response, Markdown and copyable code blocks.
- `v1.1.0` — independently scrollable chat workspace, visual refresh, and improved small-screen scrolling.
- `v1.0.0` — first MATRIX LITE release.
