"""Core turn endpoint — transport-agnostic.
IVR and WhatsApp routers call this after they've handled STT."""
from __future__ import annotations
import time, json, re
from fastapi import APIRouter, HTTPException
from ..models.session import TurnIn, TurnOut
from ..models.beneficiary import BeneficiaryPatch
from ..db import (phone_hash, upsert_beneficiary, patch_beneficiary,
                  start_session, record_turn, bump_session, close_session,
                  freeze_recommendation, q)
from ..services.extractor import extract
from ..services.next_question import pick_next
from ..services.ranker import recommend, stability_key
from ..services.composer import compose
from ..services.pack import send_pack
from ..services.lifecycle import create_counselled
from ..settings import settings
from ..logging import log

router = APIRouter(prefix="/session", tags=["session"])


# In-memory turn context per session (asked fields, last question).
_ASKED: dict[str, set[str]] = {}
_LAST_Q: dict[str, tuple[str, str]] = {}    # session_id → (field, text)


def _get_or_create_session(inp: TurnIn) -> tuple[dict, dict]:
    phash = inp.phone_hash or (phone_hash(inp.phone) if inp.phone else None)
    if not phash:
        raise HTTPException(400, "phone or phone_hash required")
    b = upsert_beneficiary(phash, inp.language)

    # Resume the most recent active session for this beneficiary, if any.
    rows = q("select * from sessions where beneficiary_id=%s::uuid and status='active' "
             "order by started_at desc limit 1", (b["id"],))
    if rows:
        s = rows[0]
    else:
        s = start_session(b["id"], inp.transport)
        _ASKED[s["id"]] = set()
    _ASKED.setdefault(s["id"], set())
    return b, s


@router.post("/turn", response_model=TurnOut)
async def turn(inp: TurnIn) -> TurnOut:
    t0 = time.perf_counter()
    b, s = _get_or_create_session(inp)

    turn_no = s["turn_count"] + 1
    heard = (inp.text or "").strip()

    # Extract every field the message mentions — not just the last asked one.
    # A beneficiary who volunteers "I live in Delhi and I studied till 12th"
    # should have both district and education captured in one go.
    patch_dict: dict = {}
    last_q = _LAST_Q.get(s["id"])
    if heard:
        question_ctx = last_q[1] if last_q else "Please tell me about yourself."
        patch = await extract(question=question_ctx, answer=heard, language=b["language"])
        if patch is None and last_q:
            q_text = _rephrase(last_q[1])
            record_turn(s["id"], turn_no, heard_text=heard, extractor_patch=json.dumps({}),
                        latency_ms=int((time.perf_counter() - t0) * 1000))
            return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                           done=False, next_question=q_text)
        if patch is not None:
            patch_dict = patch.model_dump(exclude_none=True)
            if patch_dict:
                b = patch_beneficiary(b["id"], patch_dict)
                for field in patch_dict.keys():
                    _ASKED[s["id"]].add(field)

        # Re-ask ONCE if the answer produced no useful fields at all.
        # A "useful field" = anything other than the language echo. If the
        # extractor got even one real field (age from "22" or education from
        # "class 12"), we move on to the next question.
        if last_q:
            asked_field = last_q[0]
            useful = {k: v for k, v in patch_dict.items()
                      if k != "language" and v not in (None, "", [])}

            if asked_field == "consent":
                positive = re.search(
                    r"\b(yes|yeah|yep|sure|ok|okay|haan|ha|jee|हाँ|हा|जी|হ্যাঁ|ஆம்|होय)\b",
                    heard.lower(),
                )
                if positive:
                    _ASKED[s["id"]].add("consent")
                    useful["__consented__"] = True

            reask_marker = f"__reasked__{asked_field}"
            if not useful and asked_field != "consent" and reask_marker not in _ASKED[s["id"]]:
                _ASKED[s["id"]].add(reask_marker)
                q_text = _reask(last_q[1], asked_field, b["language"])
                # keep _LAST_Q pointing at the same field so we know what to score next turn
                record_turn(s["id"], turn_no, asked=q_text, heard_text=heard,
                            extractor_patch=json.dumps(patch_dict),
                            latency_ms=int((time.perf_counter() - t0) * 1000))
                return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                               done=False, next_question=q_text)

            # Progress: mark the asked field satisfied so pick_next won't loop on it.
            _ASKED[s["id"]].add(asked_field)

    # If we haven't yet obtained consent, gate.
    if "consent" not in _ASKED[s["id"]]:
        field, question = pick_next({}, _ASKED[s["id"]], b["language"])   # will return consent
        _LAST_Q[s["id"]] = (field, question)
        record_turn(s["id"], turn_no, asked=question, heard_text=heard,
                    extractor_patch=json.dumps(patch_dict),
                    latency_ms=int((time.perf_counter() - t0) * 1000))
        return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                       done=False, next_question=question)

    # Otherwise rank now to see if top-3 is stable.
    ranked = recommend(b["id"], top=10)
    top3 = ranked[:3]
    prev_key = (s.get("last_top3") or [])
    prev = [row["qp_code"] for row in (json.loads(prev_key) if isinstance(prev_key, str) else prev_key)] if prev_key else []
    key = stability_key(top3)
    stable = (key == prev and len(top3) == 3)
    s = bump_session(s["id"], top3, stable)

    reached_max = s["turn_count"] >= settings.interview_max_turns
    # Don't converge early until we have at least district + interests/aspiration
    has_min_profile = bool(b.get("home_district")) and bool(b.get("interests") or b.get("aspiration"))
    if reached_max or (s["stable_streak"] >= settings.interview_stable_turns and has_min_profile and len(top3) >= 1):
        return await _finish(b, s, top3, ranked, turn_no, t0, heard, patch_dict)

    # Pick next question
    nxt = pick_next(b, _ASKED[s["id"]], b["language"])
    if not nxt:
        return await _finish(b, s, top3, ranked, turn_no, t0, heard, patch_dict)

    field, question = nxt
    _LAST_Q[s["id"]] = (field, question)
    record_turn(s["id"], turn_no, asked=question, heard_text=heard,
                extractor_patch=json.dumps(patch_dict),
                latency_ms=int((time.perf_counter() - t0) * 1000))
    return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                   done=False, next_question=question,
                   top3=[dict(r) for r in top3])


async def _finish(b, s, top3, ranked, turn_no, t0, heard, patch_dict) -> TurnOut:
    composer_text = await compose(top3, b["language"], b)
    signals_used = {"demand_row_ids": _demand_ids_used(b["home_district"], top3)}
    profile_snap = {k: v for k, v in b.items() if not k.startswith("_")}
    rec = freeze_recommendation(s["id"], b["id"], profile_snap,
                                [dict(r) for r in top3],
                                signals_used, composer_text)
    # Create the counselled enrollment on the top pick — mobiliser can flip it
    if top3[0].get("qualification_id"):
        create_counselled(b["id"], top3[0]["qualification_id"],
                          top3[0].get("centre_id"), owner="system")
    sent = False
    if b.get("phone_hash"):
        # No plaintext phone here in dev; real IVR path passes phone via inp.phone.
        sent = False
    close_session(s["id"], "completed")
    record_turn(s["id"], turn_no, asked=composer_text[:200], heard_text=heard,
                extractor_patch=json.dumps(patch_dict),
                latency_ms=int((time.perf_counter() - t0) * 1000))
    _ASKED.pop(s["id"], None)
    _LAST_Q.pop(s["id"], None)
    return TurnOut(session_id=s["id"], beneficiary_id=b["id"], done=True,
                   next_question=None, top3=[dict(r) for r in top3],
                   composer_text=composer_text,
                   recommendation_id=rec["id"], pack_sent=sent)


def _demand_ids_used(district: str | None, top3: list[dict]) -> list[str]:
    if not district or not top3:
        return []
    codes = [t["qp_code"] for t in top3 if t.get("qp_code")]
    if not codes:
        return []
    rows = q(
        "select id from demand_signals where district=%s and qp_code = any(%s) "
        "and evidence_date >= current_date - interval '180 days'",
        (district, codes),
    )
    return [str(r["id"]) for r in rows]


def _rephrase(question: str) -> str:
    return "क्षमा करें, फिर से कहेंगे? " + question


_REASK_HINTS = {
    "name":            {"en": "Sorry, I didn't catch your name. Please tell me your name.",
                        "hi": "क्षमा करें, नाम समझ नहीं आया। कृपया अपना नाम बताएं।"},
    "home_district":   {"en": "Sorry, which district or city do you live in?",
                        "hi": "क्षमा करें, आप किस ज़िले या शहर में रहते हैं?"},
    "age":             {"en": "I need your age in years — for example, 22.",
                        "hi": "कृपया अपनी उम्र सालों में बताएँ — जैसे 22।"},
    "education_class": {"en": "Up to which class did you finish? For example, 10th or 12th.",
                        "hi": "आपने कौन सी कक्षा तक पढ़ाई की — जैसे 10वीं या 12वीं?"},
    "interests":       {"en": "Any specific work you enjoy? For example: tailoring, mobile repair, dairy, mason.",
                        "hi": "कोई विशेष काम जो आपको पसंद हो? जैसे — सिलाई, मोबाइल रिपेयर, डेयरी, मिस्त्री।"},
    "mobility_km":     {"en": "About how many kilometres can you travel — 5, 20, or into the city?",
                        "hi": "आप कितने किलोमीटर तक जा सकती हैं — 5, 20, या शहर तक?"},
    "has_smartphone":  {"en": "Do you have a smartphone (like Android) or a basic phone?",
                        "hi": "क्या आपके पास स्मार्टफोन है या साधारण फोन?"},
    "self_employ_ok":  {"en": "Would you prefer your own work / shop, or a salaried job?",
                        "hi": "आप अपना काम / दुकान चाहेंगे, या नौकरी?"},
    "aspiration":      {"en": "What kind of work would you like — close to home, or in the city?",
                        "hi": "आप कैसा काम चाहेंगे — घर के पास, या शहर में?"},
    "social_category": {"en": "Please say one: SC, ST, OBC, or General.",
                        "hi": "कृपया एक बताएँ: SC, ST, OBC, या सामान्य।"},
}


def _reask(original_question: str, field: str, language: str) -> str:
    hint = _REASK_HINTS.get(field, {}).get(language) \
        or _REASK_HINTS.get(field, {}).get("en") \
        or f"Sorry, could you answer again? {original_question}"
    return hint
