# MATRIX LITE — v1.3.0

MATRIX LITE is a responsive AI chat workspace with two model choices. Visitors do not enter or provide an API key. Every chat request is routed through a Supabase Edge Function that uses the owner's server-side OpenRouter key.

## Live websites

- Supabase-hosted site: https://ndpgjqowvqabozvfgeab.supabase.co/functions/v1/matrix-lite-site
- GitHub Pages site: https://aminmiami97-source.github.io/MATRIX-LABS/

## Models

- **MATRIX SIMPLE** — `nvidia/nemotron-3.5-lightning:free`
- **MATRIX LITE** — `nvidia/nemotron-3.5-super-vl:free`

Free provider availability and capacity are not guaranteed and may change.

## MATRIX LITE v1.3.0

### Conversation management
- Search conversations by title or message content.
- Rename, star/unstar, archive/restore, and delete individual chats.
- Filter the sidebar to All, Starred, or Archived conversations.
- Edit a previous user message. Editing removes that message and the later replies, fills the composer with the original text, and lets the visitor send the revision.

### Export
- Export the open conversation as Markdown.
- Export all conversations as a JSON file.

### Prompt library
- Includes starter prompts for learning, project planning, debugging and brainstorming.
- Save up to 50 custom prompt templates in this browser.
- Insert a saved prompt into the composer or delete a custom template.

### Personalization
- Default model.
- Creativity/temperature control.
- Short, Standard or Long response-length preference.
- Dark or Light theme.
- Sage, Ice Blue, Violet or Amber accent.
- Small, Medium or Large message text.
- Compact chat spacing.

### Retained from previous releases
- Token streaming through Server-Sent Events.
- Stop Generation and Regenerate Response.
- Markdown headings, paragraphs, lists, blockquotes, links, emphasis, inline code and copyable fenced code blocks.
- Independently scrollable conversation area, mobile layout, and local conversation history.

## Architecture

- `matrix-lite/index.html` — self-contained static frontend; CSS and JavaScript are in the same file.
- Supabase Edge Function `matrix-lite-site` — serves the website over HTTPS.
- Supabase Edge Function `matrix-lite-chat` — validates requests, applies shared limits, and streams OpenRouter responses to the browser.
- Supabase migration `202611020001_matrix_lite_public_chat_limits.sql` — shared usage-limit table and RPC function.
- Chat history, saved prompts, and appearance preferences are stored in each visitor's browser local storage. No chat history or prompt library is stored in the shared database.

## Owner setup: one shared OpenRouter key

1. Create an OpenRouter API key in your OpenRouter account.
2. Open Supabase project **ndpgjqowvqabozvfgeab**.
3. Navigate to **Edge Functions → Secrets**.
4. Add a secret named `MATRIX_LITE_OPENROUTER_KEY` with your OpenRouter API key as its value.
5. Save. The Edge Function reads the key on the server; it is not committed to this repository or sent to visitors.

The backend also supports the existing `MATRIX_AI_ROUTER_KEY` fallback if it is already configured.

Never paste an OpenRouter key into source code, GitHub, a public website setting, or a chat message.

## Shared limits and safeguards

- Global maximum: 40 allowed chat requests per UTC day.
- Per-IP maximum: 10 requests per UTC hour bucket.
- Only the two listed model IDs are accepted.
- Message count, request size, per-message length and output tokens are bounded.
- If the database-backed rate limiter is unavailable, chat fails closed.
- Browser cancellation is propagated to the upstream model request.

OpenRouter and its providers may apply lower or different limits. A shared key means all visitors consume the same free-model capacity, so unlimited availability cannot be guaranteed.

## Privacy

Messages are sent to OpenRouter and the selected model provider, where provider policies may apply. Visitors should not send passwords, personal information, confidential files, or other sensitive content. Conversation history, prompt templates and personal display preferences remain in the visitor's browser. Clearing browser storage removes that local data.

## Version history

- `v1.3.0` — conversation search and organization, edit/resend, exports, prompt library, response controls and personalization.
- `v1.2.0` — streaming responses, Stop Generation, Regenerate Response, Markdown and copyable code blocks.
- `v1.1.0` — independently scrollable chat workspace, visual refresh and improved small-screen scrolling.
- `v1.0.0` — first MATRIX LITE release.
