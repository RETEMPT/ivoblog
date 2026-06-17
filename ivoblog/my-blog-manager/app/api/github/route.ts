import { NextResponse } from "next/server";

const GITHUB_TIMEOUT_MS = 10000;

async function fetchGithubOAuth(body: string, contentType: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

  try {
    return await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const contentType = req.headers.get("content-type") || "application/json";
    const githubRes = await fetchGithubOAuth(body, contentType);
    const data = await githubRes.json().catch(() => ({}));

    if (!githubRes.ok) {
      return NextResponse.json({ error: "github-oauth-failed" }, { status: 401 });
    }

    return NextResponse.json({
      access_token: data.access_token,
      token_type: data.token_type,
      scope: data.scope,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      { error: isTimeout ? "github-oauth-timeout" : "github-network-unavailable" },
      { status: 503 }
    );
  }
}
