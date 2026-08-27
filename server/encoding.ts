// ============================================================================
// Mojibake repair — UTF-8 text that was mis-decoded as Windows-1252.
//
// Some upstream RSS feeds serve UTF-8 bytes but mislabel the charset, so the
// feed parser decodes the bytes as Windows-1252. The result is text like
//   â€œFunerals...â€     (should be "Funerals...")
//   E1â€"E4             (should be E1–E4)
//   Ã©                  (should be é)
//   Â©                  (should be ©)
// These strings are stored literally. Rather than re-ingesting or re-running
// the AI pipeline, we repair at read/write boundaries: re-encode the string as
// Windows-1252 (recovering the original UTF-8 bytes) and decode as UTF-8.
// ============================================================================

// Windows-1252 printable characters in the 0x80–0x9F range (the C1 controls
// that CP1252 remaps). Anything outside this map falls back to its low byte.
const CP1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201c: 0x93, // "
  0x201d: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

function encodeWindows1252(str: string): number[] {
  const bytes: number[] = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0xff) {
      bytes.push(cp);
    } else if (CP1252_HIGH[cp] !== undefined) {
      bytes.push(CP1252_HIGH[cp]);
    } else {
      bytes.push(0x3f); // '?' — not representable in CP1252
    }
  }
  return bytes;
}

// Marker sequences produced when UTF-8 bytes are decoded as Windows-1252:
//   â + € + <CP1252 high char>  (â€œ â€ â€™ â€“ â€” …)
//   Ã + <0x80–0xBF>             (Ã© Ã¨ Ã± …)
//   Â + <0x80–0xBF>             (Â© Â° Â® …)
const MOJIBAKE_MARKER =
  /\u00e2\u20ac[\u0080-\u02ff\u2010-\u2122]|\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]/;

/**
 * Repair a string that was UTF-8-encoded but decoded as Windows-1252.
 * Strings without mojibake markers pass through untouched.
 */
export function repairMojibake(value: string): string {
  if (!value || typeof value !== 'string') return value || '';
  if (!MOJIBAKE_MARKER.test(value)) return value;
  try {
    const bytes = encodeWindows1252(value);
    const repaired = Buffer.from(bytes).toString('utf8');
    // A replacement char means the source wasn't pure CP1252 mojibake.
    if (repaired.includes('\uFFFD')) return value;
    // Require the repair to have actually cleared the markers.
    if (MOJIBAKE_MARKER.test(repaired)) return value;
    return repaired;
  } catch {
    return value;
  }
}

export function repairMojibakeDeep(value: unknown): unknown {
  if (typeof value === 'string') return repairMojibake(value);
  if (Array.isArray(value)) return value.map(repairMojibakeDeep);
  return value;
}