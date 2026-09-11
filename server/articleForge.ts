/**
 * Article Forge — turns real research into public-facing articles that earn
 * attention, healthy controversy, and credibility.
 *
 * Three inputs, all real:
 *  1. A verified research claim (from Recourse-published findings/papers).
 *  2. A Comic Metaphor Engine mapping (real protocol archetype + core tension)
 *     — the narrative spine.
 *  3. The marketing-team writing craft (distilled from the Draymond agency
 *     skills: copywriting, marketing-psychology, public-relations) — the hook,
 *     stakes, and authority structure.
 *
 * Honesty contract (harder than the hype):
 *  - Controversy = the REAL scientific tension in the finding, named plainly
 *    (e.g. "the field believes X, our data says Y") — NEVER manufactured
 *    outrage, NEVER attacking real people, NEVER inventing a dispute.
 *  - Every number must come from the finding's own claims. No invented stats.
 *  - Caveats are surfaced, not buried. The article says what it does NOT show.
 *  - Output is machine-validated: the JSON must round-trip before publishing.
 */

import crypto from 'node:crypto';
import OpenAI from 'openai';
import db from './db.js';
import { callAIQueued } from './aiService.js';
import { runMetaphorMapping, type MetaphorMapping } from './metaphorBridge.js';

/**
 * Direct Phoenix (PGS Grove) completion — the forge's OWN fast path. The shared
 * AI chain burns minutes cycling dead opencode free/Go keys before reaching
 * phoenix (30s per key timeout × 5 keys), and its global queue is contended by
 * RSS ingestion. The forge writes its articles through a direct call instead:
 * same key/model the chain uses, but fast + isolated. Falls back to the chain
 * when Phoenix is not configured.
 */
async function callPhoenixForge(prompt: string, timeoutMs = 120_000): Promise<string> {
  const apiKey = process.env.PHOENIX_API_KEY || '';
  const baseURL = (process.env.PHOENIX_BASE_URL || 'https://api.pgsgrove.com/v1').replace(/\/$/, '');
  const model = process.env.PHOENIX_DEFAULT_MODEL || 'deepseek-v4-flash-0731';
  if (!apiKey || apiKey.includes('API_KEY') || apiKey.length < 20) {
    return callAIQueued(prompt); // honest fallback to the shared chain
  }
  const client = new OpenAI({ apiKey, baseURL, maxRetries: 0, timeout: timeoutMs });
  const res = await client.chat.completions.create({
    model,
    temperature: 0.4,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });
  const content = res.choices?.[0]?.message?.content;
  if (!content) throw new Error('Phoenix returned empty content');
  return content;
}

// ---------------------------------------------------------------------------
// Writing craft distilled from the marketing team's skills.
// ---------------------------------------------------------------------------

export interface WritingCraftSpec {
  /** How to open: curiosity gap, specific number, or contrast. */
  hook: string;
  /** Why it matters now — real stakes from the finding, not hype. */
  stakes: string;
  /** How to handle disagreement — name the gap, invite debate, stay fair. */
  controversy: string;
  /** Authority signals — real sources, evidence tier, what was actually run. */
  credibility: string;
  /** Structure: hook → stakes → evidence → implication → honest caveat. */
  structure: string;
  /** Hard prohibitions (never do these). */
  prohibitions: string;
}

export const WRITING_CRAFT: WritingCraftSpec = {
  hook:
    'Open on the curiosity gap: a specific number, a real contradiction, or the stakes in one line. ' +
    'Clarity beats cleverness — if the reader has to decode the line, rewrite it.',
  stakes:
    'Make it matter: who is affected, what changes, what is at risk — grounded in the finding. ' +
    'Specific beats vague ("cut weekly reporting from 4h to 15min", not "save time").',
  controversy:
    'Surface the REAL scientific tension: what the field believes vs what the evidence shows, ' +
    'the gap the researchers admit, or a claim the data does not support. Name it plainly and ' +
    'invite debate. NEVER manufacture outrage, NEVER attack real people or institutions, ' +
    'NEVER invent a dispute or a rival position.',
  credibility:
    'Cite the real source and evidence tier. Say exactly what was run and measured. ' +
    'Acknowledge limits up front — an honest caveat earns more trust than a bold claim. ' +
    'No invented statistics, no overclaiming, no "experts say" without a real citation.',
  structure:
    'hook → stakes → evidence (what was actually run/measured) → what it implies → honest caveat. ' +
    'One idea per section. End with the reader knowing both the finding AND its limits.',
  prohibitions:
    'NEVER invent numbers, sources, quotes, studies, or experts. NEVER claim causation without it. ' +
    'NEVER present a model estimate as a measurement. NEVER hide a caveat. ' +
    'No emojis, no exclamation-point clickbait, no "you won\'t believe".',
};

/** The metaphor's role: a narrative lens, never a claim of fact. */
const METAPHOR_ROLE =
  'The metaphor below is a NARRATIVE LENS (a comic-book archetype mapped by the Comic Metaphor Engine) — ' +
  'use its tension and emotion to structure the article and make it vivid. It is NOT a factual claim; ' +
  'do not present the metaphor as real. The science stays from the finding.';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface ForgeFinding {
  title: string;
  claim: string;
  category: string;
  pillar: string;
  evidenceTier?: string;
  source?: string;
}

export interface ForgedArticle {
  headline: string;
  standfirst: string;
  body: string;
  tags: string[];
  controversy_note?: string;
  credibility_note?: string;
}

export interface ForgeResult {
  ok: boolean;
  article?: ForgedArticle;
  metaphor?: MetaphorMapping;
  error?: string;
}

function buildPrompt(finding: ForgeFinding, metaphor: MetaphorMapping): string {
  const tier = finding.evidenceTier ? `Evidence tier: ${finding.evidenceTier}` : '';
  return `You are the editorial desk of Overlay Global Lens, a premium research publication that reports real findings honestly — and writes them so people care.

WRITING CRAFT:
${WRITING_CRAFT.hook}
${WRITING_CRAFT.stakes}
${WRITING_CRAFT.controversy}
${WRITING_CRAFT.credibility}
${WRITING_CRAFT.structure}
${WRITING_CRAFT.prohibitions}

${METAPHOR_ROLE}
Metaphor archetype: ${metaphor.archetype}
Core tension: ${metaphor.core_tension}
Target emotion: ${metaphor.target_emotion}
Narrative seed: ${metaphor.narrative}

THE FINDING (the ONLY source of facts — do not add any others):
Title: ${finding.title}
Claim: ${finding.claim}
Category: ${finding.category}
${tier}

Write a public-facing research article (220-320 words). Make it attention-worthy and intellectually honest. Use the metaphor's tension to structure it, but every factual claim must trace to the finding above.

Output strictly valid JSON with no markdown fences:
{
  "headline": "headline under 90 chars, specific + curiosity-driving",
  "standfirst": "one-sentence summary that names the real tension",
  "body": "3-5 short paragraphs: hook, stakes, evidence, implication, caveat",
  "tags": ["research", "${finding.category}"],
  "controversy_note": "the real scientific tension this article surfaces (1 sentence)",
  "credibility_note": "what limits this article honestly discloses (1 sentence)"
}`;
}

function parseArticle(text: string): ForgedArticle | null {
  const match = (text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const a = JSON.parse(match[0]) as ForgedArticle;
    if (!a?.headline || !a?.body) return null;
    return {
      headline: String(a.headline).slice(0, 200),
      standfirst: String(a.standfirst || '').slice(0, 400),
      body: String(a.body).slice(0, 4000),
      tags: Array.isArray(a.tags) ? a.tags.map(String).slice(0, 8) : ['research'],
      controversy_note: a.controversy_note ? String(a.controversy_note).slice(0, 400) : undefined,
      credibility_note: a.credibility_note ? String(a.credibility_note).slice(0, 400) : undefined,
    };
  } catch {
    return null;
  }
}

/** Forge one article from a real finding + a real metaphor (via Phoenix chain). */
export async function forgeArticle(
  finding: ForgeFinding,
  opts: { metaphor?: MetaphorMapping | null } = {},
): Promise<ForgeResult> {
  let metaphor = opts.metaphor ?? null;
  if (!metaphor) {
    const topic = `${finding.title}. ${finding.claim}`;
    const m = await runMetaphorMapping(topic);
    if (m.ok && m.mapping) metaphor = m.mapping;
    else if (!m.ok) {
      // Honest degradation: forge without a metaphor rather than fake one.
      metaphor = null;
    }
  }
  const fallbackMetaphor: MetaphorMapping = metaphor ?? {
    topic: finding.title,
    protocol_id: 'none',
    archetype: 'the investigator',
    core_tension: `What the field believes vs what the evidence (${finding.title}) shows`,
    target_emotion: 'insight',
    trueness: 0,
    flow: 0,
    narrative: 'A patient observer tests a claim against the evidence and reports what holds up.',
    business_logic: '',
  };

  try {
    const prompt = buildPrompt(finding, fallbackMetaphor);
    const text = await callPhoenixForge(prompt);
    if (!text) return { ok: false, metaphor, error: 'AI returned no content' };
    const article = parseArticle(text);
    if (!article) return { ok: false, metaphor, error: 'AI output was not valid JSON article' };
    return { ok: true, article, metaphor };
  } catch (err) {
    return { ok: false, metaphor, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Insert a forged article into the GL articles table (idempotent on url_hash). */
export async function publishForgedArticle(
  article: ForgedArticle,
  category: string,
  sourceName = 'Overlay Research Desk',
): Promise<{ ok: boolean; inserted?: boolean; urlHash?: string; error?: string }> {
  if (!article?.headline || !article?.body) return { ok: false, error: 'article missing headline/body' };
  const body = `${article.standfirst || ''}\n\n${article.body}`;
  const urlHash = crypto
    .createHash('sha256')
    .update(`Overlay Research Desk:${article.headline}`)
    .digest('hex');
  const pubDate = new Date().toISOString();
  try {
    const info = await db.prepare(
      'INSERT OR IGNORE INTO articles (url_hash, category, source_name, original_title, original_url, image_url, original_text_dump, pub_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      urlHash,
      category,
      sourceName,
      String(article.headline).slice(0, 500),
      `global-lens://${urlHash}`,
      '',
      body,
      pubDate,
    );
    return { ok: true, inserted: info.changes > 0, urlHash };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}