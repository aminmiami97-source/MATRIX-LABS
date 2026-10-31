# ALEX SS — MATRIX LABS API Key Setup

Use this file as a setup note for your **private MATRIX LABS server**.

## 1. Put your API key here

Paste your **newly rotated API key** after the equals sign when preparing the server secret:

```text
MATRIX_AI_ROUTER_KEY=

```

Do not commit this file with a real key in it. Keep the value out of GitHub, chat messages, screenshots, and the Windows `.exe`.

## 2. Where the key actually belongs

Add the key as a **server-side secret** in your Supabase project:

- Secret name: `MATRIX_AI_ROUTER_KEY`
- Secret value: your newly generated API key

The desktop app should call the secured MATRIX LABS chat backend. It should never read this key from a bundled file or expose it in its settings.

## 3. Important

- Revoke the API key that was previously pasted into chat.
- Generate a replacement key before configuring the server.
- Do not put a real key in this Markdown file if you plan to upload or commit it.
- Keep AGOORA 2.0 and MATRIX AI 1.0 selectable in the app; the server uses the selected model for chat requests.
