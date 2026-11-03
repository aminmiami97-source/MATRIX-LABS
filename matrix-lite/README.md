# MATRIX LITE — v1.0.0

MATRIX LITE is a responsive AI chat website with exactly two model choices. Visitors do not enter or provide an API key. Every chat request is routed through a Supabase Edge Function that uses the owner's server-side OpenRouter key.

## Live website

https://ndpgjqowvqabozvfgeab.supabase.co/functions/v1/matrix-lite-site

## Models

- **MATRIX SIMPLE** — \`nvidia/nemotron-3.5-lightning:free\`
- **MATRIX LITE** — \`nvidia/nemotron-3.5-super-vl:free\`

Both model variants currently display zero token pricing on OpenRouter. Free provider capacity and provider availability are not guaranteed and may change.

## Architecture

- \`matrix-lite/index.html\` — self-contained static frontend; CSS and JavaScript are in the same file.
- Supabase Edge Function \`matrix-lite-site\` — serves the website over HTTPS.
- Supabase Edge Function \`matrix-lite-chat\` — validates requests and sends them to OpenRouter using the server-only key.
- Supabase migration \`202611020001_matrix_lite_public_chat_limits.sql\` — creates the shared usage-limit table and RPC function.
- Conversation history and model preference are stored in each visitor's browser local storage. No chat history table is used.

## Owner setup: one shared OpenRouter key

1. Create an OpenRouter API key in your OpenRouter account.
2. Open the Supabase project **ndpgjqowvqabozvfgeab**.
3. Navigate to **Edge Functions → Secrets**.
4. Add a secret:
   - Name: \`MATRIX_LITE_OPENROUTER_KEY\`
   - Value: your OpenRouter API key
5. Save. The Edge Function reads the secret on the server; it is not committed to this repository or sent to visitors.

Do not paste the OpenRouter key into source code, GitHub, a website setting exposed to visitors, or a chat message.

## Shared limits

The backend enforces:
- A global maximum of 40 allowed chat requests per UTC day.
- A maximum of 10 requests per client IP per UTC hour bucket (hourly window).
- Only the two listed free model IDs are accepted.
- Message count, total size, per-message length, token output and request timeout are bounded.
- If the database-backed rate limiter is unavailable, chat fails closed.

These are MATRIX LITE's own protections. OpenRouter and its providers may apply lower or different limits. A shared key means all visitors consume the same free-model capacity, so unlimited availability cannot be guaranteed.

## Privacy

Messages are sent to OpenRouter and the selected model provider. The NVIDIA free model pages state that free endpoint requests are logged for security and product-improvement purposes. Visitors should not send passwords, personal information, confidential files, or other sensitive content. Conversation history remains local to the visitor's browser; clearing browser storage removes that local history.

## Version

\`v1.0.0\` — first MATRIX LITE release.
