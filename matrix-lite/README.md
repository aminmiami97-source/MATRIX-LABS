# MATRIX LITE — v1.0.0

A standalone, responsive AI chat website with two OpenRouter free-model choices. It uses one owner-managed OpenRouter key on a Supabase Edge Function, so visitors never need to enter their own key.

## Models

- **MATRIX SIMPLE** — `nvidia/nemotron-3.5-lightning:free`
- **MATRIX LITE** — `nvidia/nemotron-3.5-super-vl:free`

Both currently show $0 model pricing on OpenRouter. Free provider capacity and rate limits can change; availability is not guaranteed.

## Architecture

- `index.html` is a static browser app. Conversation history and preferences stay in each visitor's browser local storage.
- `matrix-lite-chat` is deployed as a separate Supabase Edge Function. It only accepts the two allowlisted model IDs and sends requests to OpenRouter.
- The OpenRouter key is read only from the server-side Supabase Function Secret named `MATRIX_LITE_OPENROUTER_KEY`. It is not part of this repository or the browser bundle.
- A Supabase database function enforces a shared daily allowance of 40 requests and a per-IP hourly allowance of 10 requests. If the rate-limit database check fails, chat fails closed.

## One-time owner setup

1. Create an OpenRouter API key in your OpenRouter account. **Do not paste it into this repository, the website, or a chat message.**
2. Open the Supabase project used by MATRIX LITE: `ndpgjqowvqabozvfgeab`.
3. Go to **Edge Functions → Secrets** and add:
   - Name: `MATRIX_LITE_OPENROUTER_KEY`
   - Value: your OpenRouter API key
4. The separate `matrix-lite-chat` Edge Function is already deployed. It is configured for public requests and validates the request body, model allowlist, request size, and rate limits on the server.
5. To publish the website, enable **GitHub Pages → Build and deployment → GitHub Actions** for this repository. The workflow in `.github/workflows/matrix-lite-pages.yml` publishes the `matrix-lite` folder.
6. After the first successful Pages deployment, open the Pages URL and send a test message with each model.

## Usage limits and privacy

- This is a shared key: all visitors use the same OpenRouter account and its free capacity.
- MATRIX LITE applies a site-wide maximum of 40 successful rate-limit reservations per UTC day, plus 10 requests per IP per hour. Provider-side limits may be lower.
- Do not promise unlimited use. The service can be busy, unavailable, or temporarily paused after the shared allowance is reached.
- The free NVIDIA model pages state that free-endpoint use is logged for service/security and model-improvement purposes. Do not enter confidential or personal information.
- Chat history is stored locally in the browser, not in the MATRIX LITE database.

## Project files

- `index.html` — complete frontend
- Supabase Edge Function `matrix-lite-chat` — server-side OpenRouter proxy
- Supabase migration `matrix_lite_public_chat_limits` — server-side request counters

## Version

`v1.0.0` — initial release.
