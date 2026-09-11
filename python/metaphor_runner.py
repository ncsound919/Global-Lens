"""
Stateless runner for the Comic Metaphor Engine. Global Lens spawns this
process, writes ONE JSON command to stdin, and reads ONE JSON result from
stdout. The result is a real metaphor mapping (protocol archetype, core
tension, target emotion, narrative seed) computed by the engine's FAISS
protocol index — never fabricated.

The Codex (LLM) scoring adapter is intentionally DISABLED so the mapping is
fast and deterministic. tqdm progress bars go to stderr; only the JSON line
goes to stdout.
"""

import json
import sys
from pathlib import Path

ROOT = Path(r"C:\Users\User\Downloads\Uplift\02_Pillars\Overlay Writing\Comic Metaphor Engine\Comic Metaphor Logic")
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "engine"))

from engine.index import MetaphorIndex
from engine.metaphor_engine import MetaphorEngine
from engine.schema import FormatType, ToneType


def main() -> None:
    raw = sys.stdin.read()
    try:
        cmd = json.loads(raw)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"bad command: {e}"}))
        return
    try:
        topic = str(cmd.get("topic", "")).strip()
        if not topic:
            print(json.dumps({"ok": False, "error": "topic is required"}))
            return
        fmt = FormatType(cmd.get("format", "blog_post"))
        tone = ToneType(cmd.get("tone", "philosophical"))

        index = MetaphorIndex(processed_dir=str(ROOT / "processed"), lazy=True)
        engine = MetaphorEngine(index, codex_adapter=None)  # deterministic, no LLM
        mapping = engine.generate_mapping(topic=topic, target_format=fmt, target_tone=tone)
        protocol = index.get_protocol_by_id(mapping.protocol_id)

        print(json.dumps({
            "ok": True,
            "topic": topic,
            "protocol_id": mapping.protocol_id,
            "archetype": (protocol.archetype if protocol else mapping.protocol_id),
            "core_tension": mapping.core_tension,
            "target_emotion": mapping.target_emotion,
            "trueness": round(mapping.trueness_score, 3),
            "flow": round(mapping.flow_score, 3),
            "narrative": (protocol.narrative[:400] if protocol and protocol.narrative else ""),
            "business_logic": (protocol.business_logic[:300] if protocol and protocol.business_logic else ""),
        }))
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(e)}))


if __name__ == "__main__":
    main()