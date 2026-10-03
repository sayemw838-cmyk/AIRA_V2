const SUPABASE_URL = "https://klscmvszuizpolxiunzk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bVzb2X6QSJe3PrK0Asdffg_XI8GFDv8";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "apikey,authorization,content-type,prefer",
  "Access-Control-Max-Age": "86400",
};

function withCors(response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function forwardToSupabase(request, prefix, path) {
  const target = `${SUPABASE_URL}/${prefix}/${path}`;
  const headers = new Headers(request.headers);
  headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  headers.delete("host");
  const response = await fetch(new Request(target, { method: request.method, headers, body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body }));
  return withCors(response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method === "GET" && url.pathname === "/health") return withCors(Response.json({ ok: true, service: "aira-api", database: env.AIRA_DB ? "bound" : "unbound", supabaseProxy: true }));
    if (request.method === "GET" && url.pathname === "/api/v1/status") return withCors(Response.json({ ok: true, service: "aira-api", version: "0.2.0", storage: "d1", supabaseProxy: true }));
    if (url.pathname.startsWith("/api/supabase/auth/")) return forwardToSupabase(request, "auth", url.pathname.slice("/api/supabase/auth/".length) + url.search);
    if (url.pathname.startsWith("/api/supabase/rest/")) return forwardToSupabase(request, "rest/v1", url.pathname.slice("/api/supabase/rest/".length) + url.search);
    return withCors(new Response("AIRA API", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } }));
  },
};
