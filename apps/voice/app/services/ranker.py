"""FR-04 · Deterministic pathway ranker — thin wrapper over the SQL function.
No LLM in this path."""
from __future__ import annotations
import uuid, datetime, decimal
from ..db import q


def recommend(beneficiary_id: str, top: int = 3) -> list[dict]:
    rows = q("select * from recommend_pathways(%s::uuid)", (beneficiary_id,))
    cleaned = [_clean_row(r) for r in rows[:top]]

    # Safety net: if the ranker returned nothing (brand-new DB, hard-filter
    # eliminated every row, no matching sector, ...) fall back to the
    # highest-demand qualifications in the beneficiary's district, or, if
    # even that is empty, the highest-NSQF-level qualifications available.
    # We never hand back an empty top-3 — a caller always gets something.
    if not cleaned:
        cleaned = _fallback(beneficiary_id, top)
    return cleaned


def _clean_row(r: dict) -> dict:
    d = {}
    for k, v in r.items():
        if isinstance(v, (uuid.UUID, datetime.date, datetime.datetime)):
            d[k] = str(v)
        elif isinstance(v, decimal.Decimal):
            d[k] = float(v)
        else:
            d[k] = v
    return d


def _fallback(beneficiary_id: str, top: int) -> list[dict]:
    rows = q(
        """
        with b as (select * from beneficiaries where id = %s::uuid)
        select
            0 as rank,
            q.id as qualification_id,
            q.qp_code,
            q.name as qualification_name,
            q.sector,
            q.nsqf_level,
            q.duration_hours,
            null::uuid as centre_id,
            null::text as centre_name,
            null::text as centre_address,
            null::date as next_batch_date,
            null::numeric as distance_km,
            0.0 as total_score,
            0.0 as score_aspiration,
            coalesce(dem.vac_sum, 0)::numeric / 200.0 as score_demand,
            0.0 as score_mobility,
            0.0 as score_gap,
            0.5 as score_history,
            'UNKNOWN' as hard_filter
        from qualifications q
        left join (
            select d.sector, sum(d.vacancies_90d)::numeric as vac_sum
            from demand_signals d, b
            where d.district = b.home_district
              and d.evidence_date >= (current_date - interval '180 days')
            group by d.sector
        ) dem on lower(dem.sector) = lower(q.sector)
        order by coalesce(dem.vac_sum,0) desc,
                 q.nsqf_level desc,
                 q.qp_code
        limit %s
        """,
        (beneficiary_id, top),
    )
    return [_clean_row(r) for r in rows]


def stability_key(top3: list[dict]) -> list[str]:
    return [r["qp_code"] for r in top3]

