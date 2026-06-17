const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[\\/]/;

export function sanitizeLocalAssetInput(value: unknown): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return "";
  if (trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("uploads/")) return `/${trimmed}`;
  if (ABSOLUTE_URL_RE.test(trimmed)) return "";
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return "";
  if (WINDOWS_DRIVE_RE.test(trimmed)) return "";
  return "";
}

export function normalizeLocalAssetPath(value: unknown, fallback = ""): string {
  return sanitizeLocalAssetInput(value) || fallback;
}

export function normalizeLocalAssetList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return [...fallback];

  const next = value
    .map((item) => sanitizeLocalAssetInput(item))
    .filter((item): item is string => Boolean(item));

  return next.length > 0 ? next : [...fallback];
}
