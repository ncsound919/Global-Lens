// cloudflareBridge.ts — Lens <-> Cloudflare edge (Oct-2026).
// Vec-memory (D1+Vectorize edge cache) + py-ai (Workers AI lanes) + R2 paper artifacts.
// Degrades gracefully: every helper returns {ok:false, reason} when env is unset.
const VEC = process.env.VEC_MEMORY_URL?.replace(/\/+$/, "");
const PYAI = process.env.PY_AI_URL?.replace(/\/+$/, "");
const TIMEOUT_MS = Number(process.env.CF_BRIDGE_TIMEOUT_MS || 8000);

async function jfetch(url: string, init?: RequestInit, ms = TIMEOUT_MS): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    return await r.json().catch(() => ({}));
  } finally { clearTimeout(t); }
}

export async function cfHealth(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { vec: null, pyai: null };
  if (VEC) { try { out.vec = await jfetch(`${VEC}/health`, undefined, 4000); } catch (e: any) { out.vec = { ok: false, error: String(e?.message || e) }; } }
  if (PYAI) { try { out.pyai = await jfetch(`${PYAI}/health`, undefined, 4000); } catch (e: any) { out.pyai = { ok: false, error: String(e?.message || e) }; } }
  return out;
}

/** Embed + upsert oncology finding/paper chunks to edge memory (dual-writes Vectorize). */
export async function cfRemember(collection: string, items: { id?: string; text: string; meta?: Record<string, unknown> }[]) {
  if (!VEC) return { ok: false, reason: "VEC_MEMORY_URL not configured" };
  return jfetch(`${VEC}/upsert`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: items.map(i => ({ ...i, collection })) }) });
}

/** Edge recall — Vectorize fast path, D1 fallback inside the Worker. */
export async function cfRecall(query: string, topK = 5, collection?: string) {
  if (!VEC) return { ok: false, reason: "VEC_MEMORY_URL not configured" };
  return jfetch(`${VEC}/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, topK, collection }) });
}

/** Workers AI chat — model lanes: default llama-3.1-8b-fast, longctx deepseek-v4-flash (1M), agentic glm-5.3. */
export async function cfChat(prompt: string, model?: string) {
  if (!PYAI) return { ok: false, reason: "PY_AI_URL not configured" };
  const q = new URLSearchParams({ prompt, ...(model ? { model } : {}) });
  return jfetch(`${PYAI}/chat?${q.toString()}`);
}

export const CF_MODELS = {
  def: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
  longctx: "@cf/deepseek/deepseek-v4-flash",
  agentic: "@cf/zai-org/glm-5.3",
} as const;
