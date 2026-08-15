import fs from "fs";
import path from "path";

// ============================================================================
// Ecosystem env fallback — Global Lens uses the same LLM lineup as the rest of
// the Overlay365 fleet. When this outlet's own `.env` does not set a provider
// key, inherit it from the ecosystem's Draymond-Orchestrator `.env.local` so the
// outlet works with the fleet's existing keys (opencode / gemini / deepseek /
// anthropic / openai / qwen / ollama). Own keys always win; standalone deploys
// just set their keys normally and this loader is a no-op.
// ============================================================================

const PROVIDER_VARS = [
  "OPENCODE_API_KEY",
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

function draymondEnvCandidates(): string[] {
  const explicit = process.env.DRAPMOND_DIR;
  if (explicit) {
    return [path.join(explicit, ".env.local"), path.join(explicit, ".env")];
  }
  return [
    path.resolve(process.cwd(), "..", "Draymond-Orchestrator", ".env.local"),
    path.resolve(process.cwd(), "..", "Draymond-Orchestrator", ".env"),
  ];
}

export function loadEcosystemEnv(): void {
  if (loaded) return;
  loaded = true;

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
    break;
  }
}
