# MATRIX LABS 0.2 — AI Provider Setup

## What V0.2 adds

MATRIX LABS can now send text-chat requests to one of two fixed provider endpoints:

- Google Gemini — native Generate Content API.
- OpenAI — Chat Completions API.

This version is chat-only. The model has no tools and cannot access Windows files, email, the shell, the microphone, or other applications.

## Connect a provider

1. Open MATRIX LABS.
2. Open Settings.
3. Choose Google Gemini or OpenAI.
4. Enter the model ID supported by that provider.
5. Paste the provider API key into the password field and choose Save API key.
6. Open an agent chat and send a message.

The app stores the key through the native Rust layer using the Windows Credential Manager. It does not store the key in localStorage, agent profiles, conversation history, or this Git repository.

You can remove a saved key from the same Settings screen.

## Privacy and usage

When you send a chat message, MATRIX LABS sends the selected provider:
- The agent's name, purpose, and personality instructions.
- The recent conversation history (up to 24 messages).
- The selected model ID.

The message is sent over HTTPS to the provider's fixed official API endpoint. The app does not send local files, email, or other computer content in V0.2.

The provider processes the request under its own account terms, data controls, usage limits, and billing rules. MATRIX Credits are separate in-app demo points; they do not pay for provider usage or represent API tokens. Review the provider's account and usage settings before connecting a key. Use only an account you are permitted to use, and ask a parent or guardian before connecting an account that could incur charges.

A ChatGPT subscription is not an OpenAI API key. MATRIX LABS does not read a user's ChatGPT login or subscription; OpenAI API usage is configured separately.

## Supported model IDs

The model field is editable. Default suggestions in this build:
- Gemini: `gemini-3.8-flash`
- OpenAI: `gpt-6-luna`

Model availability can change. Use a model ID currently supported by the provider account you connected.

## Troubleshooting

- **Invalid API key:** verify that the key belongs to the selected provider.
- **Model not found:** check the model ID spelling and whether the account has access to it.
- **Quota or rate limit:** check the provider's usage dashboard and retry later.
- **Credential Manager error:** confirm that the Windows user profile is available, then restart MATRIX LABS.
- **No secure storage in browser preview:** use the installed Windows desktop application, not a plain browser tab.

Never paste API keys into GitHub Issues, chat messages, screenshots, or source files.
