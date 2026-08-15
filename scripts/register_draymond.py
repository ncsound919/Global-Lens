"""Register Overlay Global Lens in Draymond's local SQLite registry.

Upserts a `service` entity (slug: overlay-global-lens) into the
draymond_entities table of every Draymond DB it can find (dev + standalone),
so the outlet shows up in the fleet registry and OPS-CATALOG for strategy work.

Usage:
    python scripts/register_draymond.py [--db PATH]...
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]  # Overlay-Global-Lens -> Uplift root

DEFAULT_DBS = [
    _ROOT / "Draymond-Orchestrator" / "data" / "draymond.db",
    _ROOT / "Draymond-Orchestrator" / ".next" / "standalone" / "data" / "draymond.db",
]

ENTITY = {
    "id": str(uuid.uuid4()),
    "name": "Overlay Global Lens",
    "slug": "overlay-global-lens",
    "kind": "service",
    "description": (
        "Overlay365 news & research publication (Express/React, Global-Lens fork). "
        "Aggregates global news and publishes evidence-tiered research papers "
        "(OpenAlex/PubMed), trends, discoveries, and comic-metaphor storylines. "
        "Public-facing outlet for the ecosystem."
    ),
    "version": "0.1.0",
    "tags": json.dumps(["news", "research", "publication", "overlay365", "express"]),
    "category": "media",
    "sector": "research",
    "invocation_method": "http_api",
    "invocation_config": json.dumps(
        {
            "base_url": "http://localhost:3090",
            "health_path": "/api/health",
            "endpoints": {
                "sync_research": "/api/sync/research",
                "sync_trends": "/api/sync/trends",
                "papers": "/api/papers",
                "trends": "/api/trends",
                "discoveries": "/api/discoveries",
                "feed": "/api/insights/feed",
                "metaphors": "/api/metaphors/topic",
                "health": "/api/health",
            },
        }
    ),
    "capabilities": json.dumps(
        [
            "news_aggregation",
            "research_publishing",
            "trend_intelligence",
            "discovery_reporting",
            "metaphor_storylines",
        ]
    ),
    "input_schema": json.dumps({}),
    "output_schema": json.dumps({"articles": "array", "papers": "array", "trends": "array", "discoveries": "array"}),
    "depends_on": json.dumps([]),
    "source_type": "github",
    "source_url": "https://github.com/ncsound919/Global-Lens",
    "is_integrated": 1,
    "risk_level_default": "low",
    "max_retries": 2,
    "timeout_seconds": 120,
    "is_active": 1,
    "health_status": "online",
}


def register(db_path: Path) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    con = sqlite3.connect(str(db_path))
    try:
        cur = con.execute("SELECT id FROM draymond_entities WHERE slug = ?", (ENTITY["slug"],))
        row = cur.fetchone()
        if row:
            fields = {
                "name": ENTITY["name"],
                "description": ENTITY["description"],
                "version": ENTITY["version"],
                "tags": ENTITY["tags"],
                "category": ENTITY["category"],
                "sector": ENTITY["sector"],
                "invocation_method": ENTITY["invocation_method"],
                "invocation_config": ENTITY["invocation_config"],
                "capabilities": ENTITY["capabilities"],
                "input_schema": ENTITY["input_schema"],
                "output_schema": ENTITY["output_schema"],
                "source_url": ENTITY["source_url"],
                "is_integrated": ENTITY["is_integrated"],
                "timeout_seconds": ENTITY["timeout_seconds"],
                "is_active": ENTITY["is_active"],
                "health_status": ENTITY["health_status"],
                "updated_at": now,
            }
            sets = ", ".join(f"{k} = ?" for k in fields)
            con.execute(
                f"UPDATE draymond_entities SET {sets} WHERE slug = ?",
                (*fields.values(), ENTITY["slug"]),
            )
            action = "updated"
        else:
            cols = list(ENTITY.keys()) + ["created_at", "updated_at"]
            con.execute(
                f"INSERT INTO draymond_entities ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                (*ENTITY.values(), now, now),
            )
            action = "inserted"
        con.commit()
        print(f"[{db_path.name}] {action} entity '{ENTITY['slug']}'")
        return True
    except sqlite3.Error as e:
        print(f"[{db_path.name}] ERROR: {e}", file=sys.stderr)
        return False
    finally:
        con.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", action="append", default=[], help="extra draymond.db path")
    args = parser.parse_args()

    paths = [Path(p) for p in args.db]
    for p in DEFAULT_DBS:
        if p.exists() and p not in paths:
            paths.append(p)

    if not paths:
        print("No draymond.db found; pass --db PATH.", file=sys.stderr)
        return 1

    ok = all(register(p) for p in paths)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
