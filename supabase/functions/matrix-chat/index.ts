import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const MODEL_ALLOWLIST = new Set([
  "liquid/lfm-2.5-2.6b:free",
  "thinkingmachines/inkling-small:free",
]);

const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_SYSTEM_CHARS = 4_000;
const MAX_BODY_BYTES = 96 * 1024;
const UPSTREAM_URL = "https://openrouter.ai/api/v1/chat/completions";

type ChatMessage = { role: "user" | "assistant"; content: string };

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function getAdminKey(): string {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      // Fall through to the legacy environment variable.
    }
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  throw new Error("Supabase server secret is not configured.");
}

function validateMessages(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) return false;

  return value.every((message) => {
    if (message === null || typeof message !== "object") return false;
    const item = message as Record<string, unknown>;
    return (
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string" &&
      item.content.trim().length > 0 &&
      item.content.length <= MAX_MESSAGE_CHARS
    );
  });
}

function safeRequestId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return reply(405, { error: "Method not allowed." });
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    return reply(401, { error: "Sign in to use MATRIX AI." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const routerKey = Deno.env.get("MATRIX_AI_ROUTER_KEY");
  let adminKey: string;
  try {
    adminKey = getAdminKey();
  } catch {
    return reply(503, { error: "MATRIX Network is not configured on the server yet." });
  }
  if (!supabaseUrl || !routerKey) {
    return reply(503, { error: "MATRIX AI is not configured on the server yet." });
  }

  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(tokenMatch[1]);
  if (authError || !authData.user) {
    return reply(401, { error: "Your session expired. Sign in again." });
  }
  const isGuest = authData.user.is_anonymous === true;
  if (!isGuest && !authData.user.email_confirmed_at) {
    return reply(403, { error: "Verify your email before using MATRIX AI." });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return reply(413, { error: "The chat request is too large." });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return reply(400, { error: "Invalid chat request." });
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return reply(400, { error: "Invalid chat request." });
  }

  const modelId = payload.modelId;
  const requestId = payload.requestId;
  const systemPrompt = payload.systemPrompt;
  const messages = payload.messages;

  if (typeof modelId !== "string" || !MODEL_ALLOWLIST.has(modelId)) {
    return reply(400, { error: "Choose one of the two available MATRIX models." });
  }
  if (!safeRequestId(requestId)) {
    return reply(400, { error: "Invalid request identifier." });
  }
  if (typeof systemPrompt !== "string" || !systemPrompt.trim() || systemPrompt.length > MAX_SYSTEM_CHARS) {
    return reply(400, { error: "Agent instructions are empty or too long." });
  }
  if (!validateMessages(messages)) {
    return reply(400, { error: "The conversation is empty or too long." });
  }

  const { data: reservation, error: reserveError } = await admin.rpc(
    "matrix_reserve_chat_credit",
    {
      p_user_id: authData.user.id,
      p_request_id: requestId,
      p_model_id: modelId,
    },
  );

  if (reserveError) {
    const message = reserveError.message ?? "";
    if (message.includes("guest_daily_limit")) {
      return reply(429, { error: "You've used all 10 guest messages for the last 24 hours. Create an account for the full MATRIX experience." });
    }
    if (message.includes("insufficient_credits")) {
      return reply(402, { error: "You have used your available MATRIX Credits." });
    }
    if (message.includes("shared_daily_limit")) {
      return reply(429, { error: "The shared daily free-model limit has been reached. Try again tomorrow." });
    }
    if (message.includes("shared_rate_limit") || message.includes("user_rate_limit")) {
      return reply(429, { error: "MATRIX AI is receiving requests too quickly. Wait a moment and try again." });
    }
    return reply(503, { error: "MATRIX AI could not reserve a credit. Try again shortly." });
  }

  if (!reservation?.reserved) {
    return reply(409, { error: "This chat request has already been processed. Send a new message." });
  }

  const refund = async () => {
    if (isGuest) return;
    const { error } = await admin.rpc("matrix_refund_chat_credit", {
      p_user_id: authData.user.id,
      p_request_id: requestId,
      p_model_id: modelId,
    });
    if (error) {
      // Do not leak provider or credential details. The ledger keeps the reservation auditable.
      console.error("MATRIX credit refund failed for request", requestId);
    }
  };

  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${routerKey}`,
        "Content-Type": "application/json",
        "X-Title": "MATRIX LABS",
      },
      body: JSON.stringify({
        // MATRIX AI 1.0 is a product-level model identity. OpenRouter selects an available free model for each request.
        model: modelId === "thinkingmachines/inkling-small:free" ? "openrouter/free" : modelId,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 1200,
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    await refund();
    return reply(502, { error: "MATRIX AI could not reach its model service. Your credit has been returned." });
  }

  if (!upstream.ok) {
    // Capture only sanitized provider diagnostics. Never log request headers, credentials, or chat content.
    const upstreamErrorText = await upstream.text().catch(() => "");
    let providerCode = "";
    let providerMessage = "";
    try {
      const parsed = JSON.parse(upstreamErrorText) as Record<string, unknown>;
      const errorObject = (parsed.error && typeof parsed.error === "object")
        ? parsed.error as Record<string, unknown>
        : parsed;
      if (typeof errorObject.code === "string" || typeof errorObject.code === "number") {
        providerCode = String(errorObject.code).slice(0, 80);
      }
      if (typeof errorObject.message === "string") {
        providerMessage = errorObject.message
          .replace(/(Bearer\\s+|sk-or-v1-|sk-[A-Za-z0-9_-]{8,})[^\\s"']*/gi, "[REDACTED]")
          .replace(/[\\r\\n\\t]+/g, " ")
          .slice(0, 240);
      }
    } catch {
      // Keep diagnostics limited to the HTTP status when the provider response is not JSON.
    }
    console.error("MATRIX upstream rejected request", {
      status: upstream.status,
      code: providerCode,
      message: providerMessage,
    });

    await refund();
    if (upstream.status === 429) {
      return reply(429, { error: "The free model service is rate-limited right now. Your credit has been returned." });
    }
    if (upstream.status === 401) {
      return reply(503, { error: "OpenRouter rejected the server API key (401). Check MATRIX_AI_ROUTER_KEY in Supabase Function Secrets. Your credit has been returned." });
    }
    if (upstream.status === 403) {
      return reply(503, { error: "OpenRouter denied this request (403). Check account access and free-model availability. Your credit has been returned." });
    }
    return reply(502, { error: "The selected model is temporarily unavailable. Your credit has been returned." });
  }

  let data: Record<string, unknown>;
  try {
    const responseText = await upstream.text();
    if (new TextEncoder().encode(responseText).length > 1_000_000) {
      await refund();
      return reply(502, { error: "The model response was too large. Your credit has been returned." });
    }
    data = JSON.parse(responseText) as Record<string, unknown>;
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Invalid response shape.");
    }
  } catch {
    await refund();
    return reply(502, { error: "The model returned an unreadable response. Your credit has been returned." });
  }

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const content = message?.content;

  if (typeof content !== "string" || !content.trim()) {
    await refund();
    return reply(502, { error: "The model returned no text. Your credit has been returned." });
  }

  return reply(200, {
    content,
    modelId,
    isGuest,
    balance: isGuest ? null : reservation.balance,
    guestRemaining: isGuest ? reservation.guest_remaining : null,
  });
});
