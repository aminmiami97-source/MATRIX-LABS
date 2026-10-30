# MATRIX LABS — MATRIX AI Connection

## V0.3 connection overview

The app presents one generic connection branded **MATRIX AI**. The external routing provider is OpenRouter, which exposes an OpenAI-compatible chat-completions API.

The app sends requests to:

    https://openrouter.ai/api/v1/chat/completions

The native Rust layer attaches the user's private key as a Bearer token and sends the selected model ID plus chat messages. The desktop UI does not display the routing provider's brand name, but this documentation identifies the service so users can understand the data path.

## Connect a key

1. Revoke any key that has been pasted into a chat, screenshot, issue, source file, or public repository.
2. Create a replacement key in the provider's official account dashboard.
3. Open MATRIX LABS Settings.
4. Enter a model ID available to your account.
5. Paste the replacement key into the Private access key field and choose Connect MATRIX AI.
6. Open an agent chat and send a message.

The application stores the key through the native Rust layer using Windows Credential Manager. It does not write the key to localStorage, conversation history, agent profiles, source code, or GitHub. A saved key can be removed from Settings.

## Why keys are not embedded in the installer

A shared API key inside a distributed executable can be extracted by anyone who receives the installer. That would let other people consume the account's quota or credits. MATRIX LABS therefore uses a per-user key entered on the device, stored using the Windows credential vault.

Do not commit a key or place it in a source file, build variable that gets bundled into the frontend, or installer resource.

## Model selection

Model IDs use the routing service's model identifier format, generally including an organization or provider prefix. The default in this preview is:

    openai/gpt-5.2

The field is editable. Use a model ID that is currently available to the connected account. Model availability, pricing, and rate limits can change; check the provider's model catalogue and usage dashboard.

## What gets sent

When you submit a chat message, MATRIX LABS sends:
- The selected model ID.
- The agent's name, purpose, and personality instructions.
- Up to the most recent 24 chat messages.
- The new message.

No local files, email contents, browser data, screenshots, or other Windows content are sent by this chat-only milestone. No tools or computer-control functions are passed to the model.

The external routing service processes the request and routes it to a model provider. The selected model provider may also process the prompt. Review the external service and model provider's privacy policies, retention rules, and account terms before using the application. Do not send passwords or sensitive personal information.

## Usage and credits

Provider usage or charges are separate from MATRIX Credits. MATRIX Credits are local demo points in this preview and do not pay for API usage. Configure appropriate account spending limits and ask a parent or guardian before connecting any account that may incur charges.

## Troubleshooting

- **401 or 403:** revoke an exposed key and save a valid replacement.
- **404:** the selected model ID may not be available.
- **429:** the account quota or rate limit may have been reached.
- **Network error:** check internet access and the external service status.
- **Credential Manager error:** confirm the Windows user profile is available, then restart MATRIX LABS.

Official API documentation: https://openrouter.ai/docs/api-reference/overview
Official authentication guidance: https://openrouter.ai/docs/api-reference/authentication
