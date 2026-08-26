import fs from "fs";
import path from "path";

// ============================================================================
// Ecosystem env fallback — Global Lens uses the same LLM lineup as the rest of
// the Overlay365 fleet. When this outlet's own `.env` does not set a provider
// key, inherit it from the ecosystem so the outlet works with the fleet's
// existing keys (opencode account pool / gemini / deepseek / anthropic / openai
// / qwen / ollama / openrouter). Own keys always win; standalone deploys just
// set their keys normally and this loader is a no-op.
//
// Sources, in priority order:
//   1. Keywire vault sync  — Draymond-Orchestrator/data/litellm.env (account pool)
//   2. Draymond .env.local — default OPENCODE_API_KEY + provider keys
//   3. model-routing.json  — assignedFreeModel / freeModelList (free-model catalog)
// ============================================================================

const PROVIDER_VARS = [
  "OPENCODE_API_KEY",
  "OPENCODE_KEY_JOHNREDD",
  "OPENCODE_KEY_TAP919BEATS",
  "OPENCODE_KEY_NCSOUND919",
  "OPENCODE_KEY_TAP4500",
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "DEEPSEEK_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "QWEN_API_KEY",
  "OLLAMA_ENABLED",
];

let loaded = false;

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(file, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let value = m[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      out[m[1]] = value;
    }
  } catch {
    /* file may not exist */
  }
  return out;
}

/** Read the free-model catalog (assignedFreeModel + freeModelList) if reachable. */
function freeCatalogFromDir(draymondDir: string): { assignedFreeModel?: string; freeModelList?: string[] } {
  try {
    const p = path.join(draymondDir, ".draymond", "model-routing.json");
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as {
      assignedFreeModel?: string;
      freeModelList?: string[];
    };
    return raw;
  } catch {
    return {};
  }
}

function draymondEnvCandidates(): string[] {
  const explicit = process.env.DRAPMOND_DIR;
  if (explicit) {
    return [
      path.join(explicit, "data", "litellm.env"),
      path.join(explicit, ".env.local"),
      path.join(explicit, ".env"),
    ];
  }
  return [
    path.resolve(process.cwd(), "..", "Draymond-Orchestrator", "data", "litellm.env"),
    path.resolve(process.cwd(), "..", "Draymond-Orchestrator", ".env.local"),
    path.resolve(process.cwd(), "..", "Draymond-Orchestrator", ".env"),
  ];
}

export function loadEcosystemEnv(): void {
  if (loaded) return;
  loaded = true;

  let draymondDir: string | undefined;
  if (process.env.DRAPMOND_DIR) {
    draymondDir = process.env.DRAPMOND_DIR;
  } else {
    const cwdCandidate = path.resolve(process.cwd(), "..", "Draymond-Orchestrator");
    if (fs.existsSync(cwdCandidate)) draymondDir = cwdCandidate;
  }

  for (const file of draymondEnvCandidates()) {
    if (!fs.existsSync(file)) continue;
    const parsed = parseEnvFile(file);
    let changed = 0;
    for (const key of PROVIDER_VARS) {
      if (!process.env[key] && parsed[key]) {
        process.env[key] = parsed[key];
        changed++;
      }
    }
    if (changed > 0) {
      console.log(`[env] Inherited ${changed} provider key(s) from ${file} (own .env wins when set).`);
    }
  }

  // Free-model catalog: mirror the fleet's assigned free model + fallback list
  // so the outlet cycles the same free models as the ecosystem.
  if (draymondDir && !process.env.ASSIGNED_FREE_MODEL) {
    const catalog = freeCatalogFromDir(draymondDir);
    if (catalog.assignedFreeModel) {
      process.env.ASSIGNED_FREE_MODEL = catalog.assignedFreeModel;
      console.log(`[env] Inherited assigned free model from Draymond catalog: ${catalog.assignedFreeModel}`);
    }
    if (catalog.freeModelList?.length && !process.env.FREE_MODEL_LIST) {
      process.env.FREE_MODEL_LIST = catalog.freeModelList.join(",");
      console.log(`[env] Inherited free model list from Draymond catalog (${catalog.freeModelList.length} models).`);
    }
  }
}