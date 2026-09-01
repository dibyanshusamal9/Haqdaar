"""Thin DB access — psycopg for the ranker (needs raw SQL function call),
supabase-py for typed table ops."""
from __future__ import annotations
import hashlib, json, uuid, datetime, decimal
from typing import Any, Iterable
import psycopg
from psycopg.rows import dict_row
from .settings import settings


class CustomEncoder(json.JSONEncoder):
    def default(self, o: Any) -> Any:
        if isinstance(o, (uuid.UUID, datetime.date, datetime.datetime)):
            return str(o)
        if isinstance(o, decimal.Decimal):
            return float(o)
        return super().default(o)


def dumps(obj: Any) -> str:
    return json.dumps(obj, cls=CustomEncoder)


def phone_hash(phone: str) -> str:
    return hashlib.sha256(phone.strip().encode()).hexdigest()


def conn() -> psycopg.Connection:
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL not set")
    return psycopg.connect(settings.database_url, row_factory=dict_row, autocommit=True)


def q(sql: str, params: Iterable[Any] | None = None) -> list[dict]:
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, params or ())
        try:
            return cur.fetchall()
        except psycopg.ProgrammingError:
            return []


def exec_(sql: str, params: Iterable[Any] | None = None) -> None:
    with conn() as c, c.cursor() as cur:
        cur.execute(sql, params or ())


# ---- beneficiary upsert (idempotent by phone_hash) ----
def upsert_beneficiary(phash: str, language: str) -> dict:
    rows = q(
        """
        insert into beneficiaries (phone_hash, language)
        values (%s, %s)
        on conflict (phone_hash) do update set language = excluded.language,
                                               updated_at = now()
        returning *
        """,
        (phash, language),
    )
    return rows[0]


def patch_beneficiary(bid: str, patch: dict) -> dict:
    if not patch:
        return q("select * from beneficiaries where id=%s", (bid,))[0]
    cols = ", ".join(f"{k}=%s" for k in patch.keys())
    vals = list(patch.values()) + [bid]
    return q(
        f"update beneficiaries set {cols}, updated_at=now() where id=%s returning *",
        vals,
    )[0]


def start_session(bid: str, transport: str) -> dict:
    return q(
        "insert into sessions (beneficiary_id, transport) values (%s,%s) returning *",
        (bid, transport),
    )[0]


def record_turn(session_id: str, turn_no: int, **fields) -> None:
    keys = ["session_id", "turn_no"] + list(fields.keys())
    vals = [session_id, turn_no] + list(fields.values())
    placeholders = ", ".join(["%s"] * len(vals))
    exec_(
        f"insert into voice_turns ({', '.join(keys)}) values ({placeholders}) "
        f"on conflict (session_id, turn_no) do nothing",
        vals,
    )


def bump_session(sid: str, top3: list[dict], stable: bool) -> dict:
    return q(
        """
        update sessions
           set turn_count = turn_count + 1,
               last_top3 = %s::jsonb,
               stable_streak = case when %s then stable_streak + 1 else 0 end
         where id = %s
       returning *
        """,
        (dumps(top3), stable, sid),
    )[0]


def close_session(sid: str, status: str) -> None:
    exec_(
        "update sessions set status=%s::session_status, ended_at=now() where id=%s",
        (status, sid),
    )


def freeze_recommendation(session_id: str, bid: str, profile: dict, top3: list[dict],
                          signals: dict, composer_text: str) -> dict:
    return q(
        """
        insert into recommendations
            (session_id, beneficiary_id, profile_snapshot, top3, signals_used, composer_text)
        values (%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s)
        returning *
        """,
        (session_id, bid, dumps(profile), dumps(top3),
         dumps(signals), composer_text),
    )[0]

