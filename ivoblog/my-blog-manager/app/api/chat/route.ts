import { siteConfig } from "../../../siteConfig";

export const runtime = "edge";

const thinkingHints: Record<string, string> = {
  light: "Use a fast, direct answer. Keep it concise.",
  balanced: "Check the user's intent and answer clearly without unnecessary detail.",
  deep: "Be more careful with context, constraints, and edge cases, but do not reveal hidden reasoning.",
};

const MODEL_TIMEOUT_MS = 12000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fallbackReply(reason: string, details: Record<string, unknown> = {}) {
  return json({
    reply: "AI assistant is in local fallback mode. Add an API key in settings to enable live model replies.",
    status: "fallback",
    reason,
    ...details,
  });
}

async function fetchModelJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getChatCompletionUrl(rawBaseUrl?: string) {
  const baseUrl = (rawBaseUrl || "https://api.deepseek.com/v1").trim().replace(/\/+$/, "");
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  return `${baseUrl}/chat/completions`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return json({ error: "Message is required" }, 400);
    }

    const config = siteConfig.deepseekConfig;
    const envKeyName = config.apiKeyEnvName || "DEEPSEEK_API_KEY";
    const apiKey = (process.env[envKeyName] || "").trim();

    if (!apiKey) {
      return fallbackReply("missing-api-key", { missingEnv: envKeyName });
    }

    const modelId = config.modelId || "deepseek-chat";
    const thinkingStrength = config.thinkingStrength || "balanced";
    const thinkingHint = thinkingHints[thinkingStrength] || thinkingHints.balanced;

    const { response, data } = await fetchModelJson(getChatCompletionUrl(config.apiBaseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: config.systemPrompt || "You are a helpful blog assistant." },
          { role: "system", content: thinkingHint },
          { role: "user", content: message },
        ],
        max_tokens: config.maxOutputTokens ?? 150,
        temperature: config.temperature ?? 0.85,
      }),
    });

    if (!response.ok) {
      return fallbackReply("model-request-failed", {
        providerStatus: response.status,
        message: data?.error?.message || "No details returned by model provider",
      });
    }

    const reply = data?.choices?.[0]?.message?.content;
    return json({ reply: typeof reply === "string" && reply.trim() ? reply : "No reply returned." });
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? "model-request-timeout"
      : "model-network-error";
    return fallbackReply(reason);
  }
}

export async function GET() {
  return json({
    status: "ready",
    model: siteConfig.deepseekConfig.modelId || "deepseek-chat",
  });
}
