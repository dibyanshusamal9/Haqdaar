"""Debug/administration endpoints — the officer dashboard talks to these."""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from ..services.ranker import recommend
from ..services.explain import trail
from ..services.lifecycle import stalled
from ..db import q

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/recommend/{bid}")
async def rec(bid: str, top: int = 3):
    return {"top": recommend(bid, top=top)}


@router.get("/explain/{rec_id}")
async def explain(rec_id: str):
    t = trail(rec_id)
    if not t:
        raise HTTPException(404, "recommendation not found")
    return t


@router.get("/leads")
async def leads(district: str | None = None):
    return {"leads": stalled(district)}


@router.get("/beneficiaries")
async def beneficiaries(district: str | None = None):
    """Every beneficiary counselled so far — the persistent record, current AND
    historical (never just the latest session). Each row carries their profile,
    the frozen top-3 from their most recent completed recommendation, and when
    they were seen. The dashboard groups these by job/domain and sorts by
    district then time."""
    where = "where b.home_district = %s" if district else ""
    params = (district,) if district else ()
    rows = q(
        f"""
        select
            b.id,
            coalesce(b.name, '—')                 as name,
            b.home_district                        as district,
            b.home_state                           as state,
            b.age,
            b.education_class,
            b.education_note,
            b.interests,
            b.aspiration,
            b.mobility_km,
            b.has_smartphone,
            b.self_employ_ok,
            b.social_category,
            b.language,
            b.created_at,
            b.updated_at,
            -- primary domain = first interest, else aspiration, else 'Unspecified'
            coalesce(
                case when array_length(b.interests,1) >= 1 then b.interests[1] end,
                nullif(b.aspiration,''),
                'Unspecified'
            )                                      as domain,
            (select r.top3 from recommendations r
              where r.beneficiary_id = b.id
              order by r.created_at desc limit 1)  as top3,
            (select r.created_at from recommendations r
              where r.beneficiary_id = b.id
              order by r.created_at desc limit 1)  as recommended_at
        from beneficiaries b
        {where}
        order by lower(coalesce(b.home_state, 'zzz')),
                 lower(coalesce(b.home_district, 'zzz')),
                 lower(coalesce(
                    case when array_length(b.interests,1) >= 1 then b.interests[1] end,
                    nullif(b.aspiration,''), 'zzz')),
                 b.updated_at desc
        """,
        params,
    )
    return {"beneficiaries": rows, "count": len(rows)}


@router.get("/districts/{district}/gap")
async def gap(district: str):
    return {
        "gaps": q(
            "select sector, demand_90d, supply_quarter, last_evidence "
            "from district_gaps where district=%s order by demand_90d desc nulls last",
            (district,),
        )
    }


@router.get("/districts/{district}/funnel")
async def funnel(district: str):
    return {
        "counts": q(
            """
            select e.state::text, count(*)::int as n
              from enrollments e
              join beneficiaries b on b.id = e.beneficiary_id
             where b.home_district = %s
             group by e.state
            """,
            (district,),
        )
    }


@router.post("/erase/{phone_hash}")
async def erase(phone_hash: str):
    """DPDP right-to-erase."""
    rows = q("delete from beneficiaries where phone_hash=%s returning id", (phone_hash,))
    return {"deleted": len(rows)}


@router.get("/qualifications")
async def qualifications(sector: str | None = None, q_str: str | None = None):
    sql = "select id, qp_code, name, sector, nsqf_level, duration_hours, mode, self_employment_track, source_url from qualifications where 1=1"
    params = []
    if sector:
        sql += " and lower(sector) = lower(%s)"
        params.append(sector)
    if q_str:
        sql += " and (lower(name) like lower(%s) or lower(qp_code) like lower(%s))"
        params.extend([f"%{q_str}%", f"%{q_str}%"])
    sql += " order by sector, nsqf_level, name limit 200"
    return {"qualifications": q(sql, params)}

