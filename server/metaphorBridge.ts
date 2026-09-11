/**
 * Comic Metaphor Engine bridge — runs the REAL Overlay Writing metaphor engine
 * (FAISS protocol index over comic-book narrative structures) as a stateless
 * Python subprocess. Global Lens sends a research topic and gets back a real
 * metaphor mapping (archetype, core tension, target emotion, narrative seed)
 * that the article forge uses as creative input.
 *
 * Nothing is fabricated: the mapping comes from the engine's real protocol
 * index. The LLM scoring adapter is disabled (deterministic, fast). A failed
 * spawn/mapping reports ok:false honestly.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

export interface MetaphorMapping {
  topic: string;
  protocol_id: string;
  archetype: string;
  core_tension: string;
  target_emotion: string;
  trueness: number;
  flow: number;
  narrative: string;
  business_logic: string;
}

export interface MetaphorResult {
  ok: boolean;
  mapping?: MetaphorMapping;
  error?: string;
}

export function metaphorPythonBin(): string {
  return process.env.METAPHOR_PYTHON || 'python';
}

export function metaphorRunnerPath(): string {
  return process.env.METAPHOR_RUNNER || path.join(process.cwd(), 'python', 'metaphor_runner.py');
}

export interface RunOptions {
  timeoutMs?: number;
  python?: string;
  runner?: string;
}

/** Spawn the runner, send a topic, parse the engine's real JSON mapping. */
export function runMetaphorMapping(
  topic: string,
  opts: RunOptions = {},
): Promise<MetaphorResult> {
  const python = opts.python ?? metaphorPythonBin();
  const runner = opts.runner ?? metaphorRunnerPath();
  const timeoutMs = opts.timeoutMs ?? 90_000; // index build on first call is slow

  return new Promise((resolve) => {
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(python, [runner], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ ok: false, error: `metaphor spawn failed: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { proc.kill(); } catch { /* already dead */ }
      resolve({ ok: false, error: `metaphor engine timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    let out = '';
    let errOut = '';
    proc.stdout.on('data', (d: Buffer) => { out += d.toString('utf-8'); });
    proc.stderr.on('data', (d: Buffer) => { errOut += d.toString('utf-8'); });
    proc.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, error: `metaphor engine error: ${e.message}` });
    });
    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const line = out.trim().split('\n').pop() || '{}';
        const parsed = JSON.parse(line) as { ok?: boolean; error?: string };
        if (parsed.ok === false) {
          resolve({ ok: false, error: parsed.error || 'metaphor mapping failed' });
          return;
        }
        resolve({ ok: true, mapping: parsed as unknown as MetaphorMapping });
      } catch {
        resolve({
          ok: false,
          error: `metaphor engine returned non-JSON (exit ${code ?? '?'}): ${(errOut || out).slice(0, 200)}`,
        });
      }
    });

    proc.stdin.write(JSON.stringify({ topic }) + '\n');
    proc.stdin.end();
  });
}