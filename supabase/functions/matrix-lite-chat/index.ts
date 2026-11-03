import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_ALLOWLIST = new Set([
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3.5-super-vl:free",
]);
const MAX_BODY_BYTES = 72 * 1024;
const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_TOTAL_CHARS = 28_000;

type ChatMessage = { role: "user" | "assistant"; content: string };

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders,
  });
}

function readSupabaseServerKey(): string {
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysJson) {
    try {
      const keys = JSON.parse(secretKeysJson) as Record<string, string>;
      if (typeof keys.default === "string" && keys.default.length > 20) {
        return keys.default;
      }
    } catch {
      // Try the legacy service-role environment variable below.
    }
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  throw new Error("Supabase server key is not configured.");
}

function clientIp(request: Request): string {
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  const realIp = request.headers.get("x-real-ip");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return cloudflareIp || realIp || forwarded || "unknown";
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(ip + "|" + salt);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function validateMessages(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) {
    return false;
  }

  let total = 0;
  for (const message of value) {
    if (message === null || typeof message !== "object") return false;
    const item = message as Record<string, unknown>;
    if (
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.content !== "string" ||
      item.content.trim().length === 0 ||
      item.content.length > MAX_MESSAGE_CHARS
    ) {
      return false;
    }
    total += item.content.length;
    if (total > MAX_TOTAL_CHARS) return false;
  }

  return true;
}

async function consumeRateLimit(
  ip: string,
  serverSalt: string,
  supabaseUrl: string,
  supabaseServerKey: string,
): Promise<{ allowed: boolean; reason: string; remainingToday: number; resetAt: string }> {
  const ipHash = await hashIp(ip, serverSalt);
  const response = await fetch(
    supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/matrix_lite_consume_request",
    {
      method: "POST",
      headers: {
        "apikey": supabaseServerKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_ip_hash: ipHash }),
      signal: AbortSignal.timeout(8_000),
    },
  );

  if (!response.ok) {
    throw new Error("Rate limiter unavailable.");
  }

  const raw: unknown = await response.json();
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (row === null || typeof row !== "object") {
    throw new Error("Invalid rate limiter response.");
  }

  const result = row as Record<string, unknown>;
  return {
    allowed: result.allowed === true,
    reason: typeof result.reason === "string" ? result.reason : "limited",
    remainingToday: Number.isFinite(Number(result.remaining_today))
      ? Number(result.remaining_today)
      : 0,
    resetAt: typeof result.reset_at === "string" ? result.reset_at : "",
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return reply(405, { error: "Only POST requests are supported." });
  }

  const routerKey = Deno.env.get("MATRIX_LITE_OPENROUTER_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!routerKey || !supabaseUrl) {
    return reply(503, {
      error: "MATRIX LITE is waiting for its owner to configure the server key.",
      code: "SERVER_NOT_CONFIGURED",
    });
  }

  let supabaseServerKey = "";
  try {
    supabaseServerKey = readSupabaseServerKey();
  } catch {
    return reply(503, {
      error: "MATRIX LITE rate protection is not configured yet.",
      code: "RATE_LIMITER_NOT_CONFIGURED",
    });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return reply(413, { error: "That conversation is too large. Start a new chat." });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return reply(400, { error: "Invalid chat request." });
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return reply(400, { error: "The chat request was not valid JSON." });
  }

  const modelId = payload.modelId;
  const messages = payload.messages;
  if (typeof modelId !== "string" || !MODEL_ALLOWLIST.has(modelId)) {
    return reply(400, { error: "Select one of the two MATRIX LITE models." });
  }
  if (!validateMessages(messages)) {
    return reply(400, { error: "The conversation is empty or too long." });
  }

  const temperature = Number(payload.temperature);
  const maxTokens = Number(payload.maxTokens);
  const safeTemperature = Number.isFinite(temperature)
    ? Math.min(1.2, Math.max(0, temperature))
    : 0.7;
  const safeMaxTokens = Number.isInteger(maxTokens)
    ? Math.min(1200, Math.max(256, maxTokens))
    : 900;

  let limit: { allowed: boolean; reason: string; remainingToday: number; resetAt: string };
  try {
    limit = await consumeRateLimit(
      clientIp(request),
      routerKey,
      supabaseUrl,
      supabaseServerKey,
    );
  } catch {
    console.error("MATRIX LITE rate-limit check failed.");
    return reply(503, {
      error: "The usage protection service is temporarily unavailable. Try again shortly.",
    });
  }

  if (!limit.allowed) {
    if (limit.reason === "daily_limit") {
      return reply(429, {
        error: "MATRIX LITE has reached today's shared message allowance. It resets at midnight UTC.",
        resetAt: limit.resetAt,
        remainingToday: 0,
      });
    }
    return reply(429, {
      error: "This connection has reached its hourly limit. Please try again later.",
      resetAt: limit.resetAt,
      remainingToday: limit.remainingToday,
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + routerKey,
        "Content-Type": "application/json",
        "X-Title": "MATRIX LITE",
        "HTTP-Referer": "https://github.com/aminmiami97-source/MATRIX-LABS",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content: "You are MATRIX LITE, a clear, practical, and friendly AI assistant. Be accurate, explain things in accessible language, and say when you are unsure. Keep responses age-appropriate.",
          },
          ...messages,
        ],
        temperature: safeTemperature,
        max_tokens: safeMaxTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(40_000),
    });
  } catch {
    return reply(502, { error: "The model service could not be reached. Please try again." });
  }

  if (!upstream.ok) {
    if (upstream.status === 429) {
      return reply(429, {
        error: "The selected free model is busy or its provider limit has been reached. Try again later.",
        remainingToday: limit.remainingToday,
      });
    }
    if (upstream.status === 401 || upstream.status === 403) {
      console.error("OpenRouter rejected the MATRIX LITE server key.", upstream.status);
      return reply(503, {
        error: "The server's OpenRouter key was rejected. The site owner needs to check its secret setting.",
      });
    }
    console.error("OpenRouter request failed.", upstream.status);
    return reply(502, { error: "The selected model is temporarily unavailable." });
  }

  let data: Record<string, unknown>;
  try {
    const responseText = await upstream.text();
    if (new TextEncoder().encode(responseText).length > 1_000_000) {
      return reply(502, { error: "The model response was too large." });
    }
    const parsed: unknown = JSON.parse(responseText);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid response.");
    }
    data = parsed as Record<string, unknown>;
  } catch {
    return reply(502, { error: "The model returned an unreadable response." });
  }

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const responseMessage = firstChoice?.message as Record<string, unknown> | undefined;
  const content = responseMessage?.content;

  if (typeof content !== "string" || !content.trim()) {
    return reply(502, { error: "The model did not return a text response." });
  }

  return reply(200, {
    content,
    requestedModel: modelId,
    actualModel: typeof data.model === "string" ? data.model : modelId,
    remainingToday: limit.remainingToday,
    dailyLimit: 40,
  });
});
