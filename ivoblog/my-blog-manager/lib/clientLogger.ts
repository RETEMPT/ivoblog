"use client";

type LogLevel = "info" | "warning" | "error";

let lastSentAt = new Map<string, number>();

function compact(value: unknown) {
  if (value == null) return "";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.split("\n").slice(0, 8).join("\n"),
    };
  }
  if (typeof value === "string") return value.slice(0, 2000);
  try {
    return JSON.stringify(value).slice(0, 2000);
  } catch {
    return String(value).slice(0, 2000);
  }
}

export function logClientEvent(level: LogLevel, source: string, message: string, detail?: unknown) {
  if (typeof window === "undefined") return;

  const key = `${level}:${source}:${message}`;
  const now = Date.now();
  // Errors always send immediately; info/warning are rate-limited to avoid spam
  if (level !== "error") {
    if (now - (lastSentAt.get(key) || 0) < 2500) return;
  }
  lastSentAt.set(key, now);
  if (lastSentAt.size > 120) lastSentAt = new Map(Array.from(lastSentAt.entries()).slice(-60));

  const body = JSON.stringify({
    level,
    source,
    message,
    detail: compact(detail),
    href: window.location.href,
    userAgent: navigator.userAgent,
  });

  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/logs/client", blob)) return;
  } catch {
    // Fall back to fetch below.
  }

  fetch("/api/logs/client", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Logging must never break the UI.
  });
}
