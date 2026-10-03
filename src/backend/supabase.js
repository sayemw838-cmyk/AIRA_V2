const SUPABASE_URL = "https://klscmvszuizpolxiunzk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bVzb2X6QSJe3PrK0Asdffg_XI8GFDv8";
const SESSION_KEY = "aira_supabase_session_v1";

function endpoint(path) { return `${SUPABASE_URL}${path}`; }
async function request(path, options = {}, session = null) {
  const authHeaders = { apikey: SUPABASE_ANON_KEY, ...(options.headers || {}) };
  if (!options.skipAuthorization) authHeaders.Authorization = `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`;
  const response = await fetch(endpoint(path), {
    ...options,
    headers: authHeaders,
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message = body?.msg || body?.message || body?.error_description || body?.error || `Supabase request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export function supabaseConfig() {
  return { url: SUPABASE_URL, configured: !!SUPABASE_URL && !!SUPABASE_ANON_KEY };
}
export function readSupabaseSession(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
export function writeSupabaseSession(session, storage = globalThis.localStorage) {
  if (session) storage?.setItem(SESSION_KEY, JSON.stringify(session));
  else storage?.removeItem(SESSION_KEY);
  return session;
}
export function currentSupabaseUser(storage = globalThis.localStorage) {
  return readSupabaseSession(storage)?.user || null;
}
export async function signInSupabase(email, password, storage = globalThis.localStorage) {
  if (!String(email || "").trim() || !password) throw new Error("Supabase email and password are required.");
  const session = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    skipAuthorization: true,
    body: JSON.stringify({ email: String(email).trim(), password }),
  });
  writeSupabaseSession(session, storage);
  return session;
}
export async function signOutSupabase(storage = globalThis.localStorage) {
  const session = readSupabaseSession(storage);
  if (session?.access_token) await request("/auth/v1/logout", { method: "POST" }, session);
  writeSupabaseSession(null, storage);
}
function requireSession(session) {
  if (!session?.access_token || !session?.user?.id) throw new Error("Sign in to Supabase before syncing AIRA data.");
}
export function skillToSupabaseRow(skill, userId) {
  requireSession({ access_token: "present", user: { id: userId } });
  return {
    id: skill.id,
    owner_id: userId,
    name: skill.name,
    description: skill.description || "",
    instructions: skill.instructions || "",
    operator_workflow: skill.operatorWorkflow || [],
    knowledge: skill.knowledge || [],
    examples: skill.examples || [],
    enabled: skill.enabled !== false,
    version: Number(skill.version) || 1,
    created_at: skill.createdAt || new Date().toISOString(),
    updated_at: skill.updatedAt || new Date().toISOString(),
  };
}
export function supabaseRowToSkill(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    instructions: row.instructions || "",
    operatorWorkflow: Array.isArray(row.operator_workflow) ? row.operator_workflow : [],
    knowledge: Array.isArray(row.knowledge) ? row.knowledge : [],
    examples: Array.isArray(row.examples) ? row.examples : [],
    enabled: row.enabled !== false,
    version: Number(row.version) || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export async function listRemoteSkills(session = readSupabaseSession()) {
  requireSession(session);
  const rows = await request("/rest/v1/skills?select=*&order=updated_at.desc", {}, session);
  return (Array.isArray(rows) ? rows : []).map(supabaseRowToSkill);
}
export async function upsertRemoteSkill(skill, session = readSupabaseSession()) {
  requireSession(session);
  const row = skillToSupabaseRow(skill, session.user.id);
  await request("/rest/v1/skills?on_conflict=id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  }, session);
  return skill;
}
export async function syncSkills(localSkills, session = readSupabaseSession()) {
  requireSession(session);
  const remote = await listRemoteSkills(session);
  const byId = new Map(remote.map((skill) => [skill.id, skill]));
  for (const local of Array.isArray(localSkills) ? localSkills : []) {
    const existing = byId.get(local.id);
    const localTime = Date.parse(local.updatedAt || local.createdAt || 0) || 0;
    const remoteTime = Date.parse(existing?.updatedAt || existing?.createdAt || 0) || 0;
    if (!existing || localTime >= remoteTime) {
      await upsertRemoteSkill(local, session);
      byId.set(local.id, local);
    }
  }
  return [...byId.values()].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export { SUPABASE_URL, SUPABASE_ANON_KEY, SESSION_KEY };
