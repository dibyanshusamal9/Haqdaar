"""FR-04 · Deterministic pathway ranker — thin wrapper over the SQL function.
No LLM in this path."""
from __future__ import annotations
import uuid, datetime, decimal
from ..db import q


def recommend(beneficiary_id: str, top: int = 3) -> list[dict]:
    rows = q("select * from recommend_pathways(%s::uuid)", (beneficiary_id,))
    cleaned = []
    for r in rows[:top]:
        d = {}
        for k, v in r.items():
            if isinstance(v, (uuid.UUID, datetime.date, datetime.datetime)):
                d[k] = str(v)
            elif isinstance(v, decimal.Decimal):
                d[k] = float(v)
            else:
                d[k] = v
        cleaned.append(d)
    return cleaned


def stability_key(top3: list[dict]) -> list[str]:
    return [r["qp_code"] for r in top3]

