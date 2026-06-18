const DEFAULT_BACKEND_BASE = "http://127.0.0.1:52560";
const BACKEND_BASE_TTL = 30_000;
const CMS_API_KEY = process.env.NEXT_PUBLIC_CMS_API_KEY || "";

let cachedBackendBase = DEFAULT_BACKEND_BASE;
let backendBaseExpiresAt = 0;
let backendBaseRequest: Promise<string> | null = null;

async function reportBackendIssue(source: string, message: string, detail?: unknown) {
  if (typeof window === "undefined") return;
  try {
    const { logClientEvent } = await import("./clientLogger");
    logClientEvent("error", source, message, detail);
  } catch {
    // Logging must never break API calls.
  }
}

function normalizeBackendBase(value: string) {
  return (value || DEFAULT_BACKEND_BASE).replace(/\/+$/, "");
}

export function resetBackendBaseCache() {
  backendBaseExpiresAt = 0;
  backendBaseRequest = null;
}

export async function getBackendBase() {
  const now = Date.now();

  if (now < backendBaseExpiresAt) {
    return cachedBackendBase;
  }

  if (backendBaseRequest) {
    return backendBaseRequest;
  }

  backendBaseRequest = readBackendBase(now);
  return backendBaseRequest;
}

async function readBackendBase(now: number) {
  try {
    const configRes = await fetch(`/backend_config.json?t=${now}`, { cache: "no-store" });
    if (!configRes.ok) throw new Error(`backend_config ${configRes.status}`);

    const configData = await configRes.json();
    cachedBackendBase = normalizeBackendBase(configData.api_base || `http://127.0.0.1:${configData.api_port || 52560}`);
  } catch {
    cachedBackendBase = DEFAULT_BACKEND_BASE;
  } finally {
    backendBaseExpiresAt = Date.now() + BACKEND_BASE_TTL;
    backendBaseRequest = null;
  }

  return cachedBackendBase;
}

export async function fetchBackend(path: string, init?: RequestInit, timeoutMs = 5000) {
  const apiBase = await getBackendBase();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init?.headers);
  if (CMS_API_KEY && !headers.has("X-CMS-API-Key")) {
    headers.set("X-CMS-API-Key", CMS_API_KEY);
  }

  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers,
      cache: init?.cache || "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      void reportBackendIssue("fetchBackend", `HTTP ${response.status} ${path}`, {
        status: response.status,
        statusText: response.statusText,
        method: init?.method || "GET",
      });
    }
    return response;
  } catch (error) {
    void reportBackendIssue("fetchBackend", `Request failed: ${path}`, {
      method: init?.method || "GET",
      timeoutMs,
      error,
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

let backendOnline = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_TTL = 15_000;

export function isBackendOnline() {
  return backendOnline;
}

export async function checkBackendHealth(options?: { force?: boolean; timeoutMs?: number }): Promise<boolean> {
  const now = Date.now();
  if (!options?.force && now - lastHealthCheck < HEALTH_CHECK_TTL) {
    return backendOnline;
  }

  const timeoutMs = options?.timeoutMs ?? 1500;

  try {
    const apiBase = await getBackendBase();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${apiBase}/api/status`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);
    backendOnline = response.ok;
  } catch {
    backendOnline = false;
  }

  lastHealthCheck = Date.now();
  return backendOnline;
}

export async function fetchBackendJson<T = any>(path: string, init?: RequestInit, timeoutMs = 5000) {
  try {
    const response = await fetchBackend(path, init, timeoutMs);
    if (!response.ok) return null;
    try {
      return (await response.json()) as T;
    } catch (error) {
      void reportBackendIssue("fetchBackendJson", `Invalid JSON: ${path}`, error);
      return null;
    }
  } catch (error) {
    void reportBackendIssue("fetchBackendJson", `Backend JSON request failed: ${path}`, error);
    return null;
  }
}
