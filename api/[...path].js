// Same-origin proxy to the AskPanditJi astrology API.
//
// The page cannot call api.askpanditji.co.in directly: that service sets no
// CORS headers, so the browser blocks the request before it leaves. Proxying
// here keeps the demo self-contained and means the production API needs no
// changes for a hackathon entry.
//
// The path allowlist matters. Without it this is an open proxy that anyone can
// point at any upstream path.

const UPSTREAM = "https://api.askpanditji.co.in";

const ALLOWED = {
  places: "GET",
  "moon-sign": "POST",
  "mangal-dosh": "POST",
  "sade-sati": "POST",
};

export default async function handler(request, response) {
  // Parsed from the URL rather than a framework-specific catch-all param, so
  // this behaves the same locally, on Vercel, and anywhere else it is hosted.
  const requestUrl = new URL(request.url, "http://localhost");
  const path = requestUrl.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
  const expected = ALLOWED[path];

  if (!expected) {
    return response.status(404).json({ error: `Unknown path: ${path}` });
  }
  if (request.method !== expected) {
    return response.status(405).json({ error: `${path} expects ${expected}` });
  }

  const url = new URL(`${UPSTREAM}/${path}`);
  if (expected === "GET") {
    const q = requestUrl.searchParams.get("q");
    if (q) url.searchParams.set("q", q);
  }

  try {
    const upstream = await fetch(url, {
      method: expected,
      headers: { "Content-Type": "application/json" },
      body: expected === "POST" ? JSON.stringify(request.body ?? {}) : undefined,
    });
    const text = await upstream.text();
    response.status(upstream.status);
    response.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") ?? "application/json",
    );
    return response.send(text);
  } catch (error) {
    return response.status(502).json({ error: "Upstream unavailable" });
  }
}
