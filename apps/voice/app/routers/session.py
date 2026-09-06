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
from ..services.i18n import localize, to_english, seed as i18n_seed
from ..services.next_question import SEED as _QUESTION_SEED
from ..settings import settings
from ..logging import log

router = APIRouter(prefix="/session", tags=["session"])

# Load the human translations of the fixed questions into the translation
# cache so the core languages are instant and idiomatic.
i18n_seed(_QUESTION_SEED)

# Spoken "let me check" line before the result, so it feels like a real person
# pausing to look things up rather than answering instantly. Authored in
# English and localised like everything else.
# A warm, human "let me check" line spoken just before the results. Native for
# the core languages (no network); other languages get the English one
# translated at send time. Keep it conversational — it should sound like a real
# counsellor thinking, not a system message.
_FILLER = {
    "en": "Thank you. Just give me a moment — let me look through the training options and find the three best paths for you.",
    "hi": "धन्यवाद। ज़रा एक पल रुकिए — मैं आपके लिए प्रशिक्षण के विकल्प देखकर तीन सबसे अच्छे रास्ते ढूंढती हूँ।",
    "bn": "ধন্যবাদ। একটু অপেক্ষা করুন — আমি প্রশিক্ষণের বিকল্পগুলো দেখে আপনার জন্য তিনটি সেরা পথ খুঁজে বের করছি।",
    "ta": "நன்றி. ஒரு நிமிடம் பொறுங்கள் — உங்களுக்கான பயிற்சி வாய்ப்புகளைப் பார்த்து மூன்று சிறந்த வழிகளைத் தேடுகிறேன்.",
    "mr": "धन्यवाद. जरा एक क्षण थांबा — मी तुमच्यासाठी प्रशिक्षणाचे पर्याय पाहून तीन सर्वोत्तम मार्ग शोधते.",
}
_FILLER_EN = _FILLER["en"]


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

    # Monotonic per-session turn number. Do NOT derive this from
    # sessions.turn_count: that only advances once consent is obtained, so the
    # greeting / consent / name turns would all reuse turn_no=1 and be dropped
    # by voice_turns' ON CONFLICT DO NOTHING — losing them from the transcript.
    _row = q("select coalesce(max(turn_no), 0) + 1 as n from voice_turns where session_id=%s::uuid",
             (s["id"],))
    turn_no = _row[0]["n"] if _row else 1
    heard = (inp.text or "").strip()
    # For languages the rule-based extractor doesn't natively cover (everything
    # outside en/hi/bn/ta/mr) translate the answer to English first, so the same
    # rules and keyword tables apply. Native languages pass through unchanged.
    heard_en = await to_english(heard, b["language"]) if heard else heard

    # Extract every field the message mentions — not just the last asked one.
    # A beneficiary who volunteers "I live in Delhi and I studied till 12th"
    # should have both district and education captured in one go.
    patch_dict: dict = {}
    last_q = _LAST_Q.get(s["id"])
    if heard:
        question_ctx = last_q[1] if last_q else "Please tell me about yourself."
        patch = await extract(question=question_ctx, answer=heard_en, language=b["language"])
        if patch is None and last_q:
            q_text = _rephrase(last_q[1])
            q_local = await localize(q_text, b["language"])
            record_turn(s["id"], turn_no, asked=q_text, asked_local=q_local,
                        heard_text=heard, heard_en=heard_en, extractor_patch=json.dumps({}),
                        latency_ms=int((time.perf_counter() - t0) * 1000))
            return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                           done=False, next_question=q_local)
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
                positive = _is_affirmative(heard) or _is_affirmative(heard_en)
                if positive:
                    _ASKED[s["id"]].add("consent")
                    useful["__consented__"] = True

            reask_marker = f"__reasked__{asked_field}"
            if not useful and asked_field != "consent" and reask_marker not in _ASKED[s["id"]]:
                _ASKED[s["id"]].add(reask_marker)
                q_text = _reask(last_q[1], asked_field, b["language"])
                q_local = await localize(q_text, b["language"])
                # keep _LAST_Q pointing at the same field so we know what to score next turn
                record_turn(s["id"], turn_no, asked=q_text, asked_local=q_local,
                            heard_text=heard, heard_en=heard_en,
                            extractor_patch=json.dumps(patch_dict),
                            latency_ms=int((time.perf_counter() - t0) * 1000))
                return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                               done=False, next_question=q_local)

            # Progress: only mark the ASKED field as satisfied when the answer
            # actually filled it, OR when we've already re-asked once. Otherwise
            # a caller who answers "smartphone" to the category question would
            # cause the category slot to be silently marked done.
            if asked_field in useful or reask_marker in _ASKED[s["id"]]:
                _ASKED[s["id"]].add(asked_field)

    # If we haven't yet obtained consent, gate.
    if "consent" not in _ASKED[s["id"]]:
        field, question = pick_next({}, _ASKED[s["id"]], b["language"])   # will return consent
        _LAST_Q[s["id"]] = (field, question)   # keep ENGLISH for extraction context
        q_local = await localize(question, b["language"])
        record_turn(s["id"], turn_no, asked=question, asked_local=q_local,
                    heard_text=heard, heard_en=heard_en,
                    extractor_patch=json.dumps(patch_dict),
                    latency_ms=int((time.perf_counter() - t0) * 1000))
        return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                       done=False, next_question=q_local)

    # Otherwise rank now to see if top-3 is stable.
    ranked = recommend(b["id"], top=10)
    top3 = ranked[:3]
    prev_key = (s.get("last_top3") or [])
    prev = [row["qp_code"] for row in (json.loads(prev_key) if isinstance(prev_key, str) else prev_key)] if prev_key else []
    key = stability_key(top3)
    stable = (key == prev and len(top3) == 3)
    s = bump_session(s["id"], top3, stable)

    reached_max = s["turn_count"] >= settings.interview_max_turns
    # Cover EVERY question the interview asks — the panel says "STILL NEEDED"
    # for these until they're filled, so the interview should not end while
    # any of them is missing. Hard cap `interview_max_turns` still applies.
    all_filled = (
        bool(b.get("name"))
        and bool(b.get("home_district"))
        and b.get("age") is not None
        and b.get("education_class") is not None
        and bool(b.get("interests") or b.get("aspiration"))
        and b.get("mobility_km") is not None
        and b.get("has_smartphone") is not None
        and b.get("self_employ_ok") is not None
        and bool(b.get("social_category"))
    )
    if reached_max or (all_filled and len(top3) >= 1):
        return await _finish(b, s, top3, ranked, turn_no, t0, heard, heard_en, patch_dict)

    # Pick next question
    nxt = pick_next(b, _ASKED[s["id"]], b["language"])
    if not nxt:
        return await _finish(b, s, top3, ranked, turn_no, t0, heard, heard_en, patch_dict)

    field, question = nxt
    _LAST_Q[s["id"]] = (field, question)   # keep ENGLISH for extraction context
    q_local = await localize(question, b["language"])
    record_turn(s["id"], turn_no, asked=question, asked_local=q_local,
                heard_text=heard, heard_en=heard_en,
                extractor_patch=json.dumps(patch_dict),
                latency_ms=int((time.perf_counter() - t0) * 1000))
    return TurnOut(session_id=s["id"], beneficiary_id=b["id"],
                   done=False, next_question=q_local,
                   top3=[dict(r) for r in top3])


async def _finish(b, s, top3, ranked, turn_no, t0, heard, heard_en, patch_dict) -> TurnOut:
    lang = (b["language"] or "en").lower()
    # compose() returns native text for en/hi/bn/ta/mr and English otherwise.
    composed = await compose(top3, lang, b)
    filler = _FILLER.get(lang)
    if filler is not None:
        # native language: prepend the native filler, no translation needed
        composer_text = f"{filler} {composed}"
    else:
        # other scheduled language: translate the whole English utterance
        composer_text = await localize(f"{_FILLER['en']} {composed}", lang)
    composer_en = f"{_FILLER['en']} {await compose(top3, 'en', b)}"

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
    record_turn(s["id"], turn_no, asked=composer_en, asked_local=composer_text,
                heard_text=heard, heard_en=heard_en,
                extractor_patch=json.dumps(patch_dict),
                latency_ms=int((time.perf_counter() - t0) * 1000))
    _ASKED.pop(s["id"], None)
    _LAST_Q.pop(s["id"], None)
    return TurnOut(session_id=s["id"], beneficiary_id=b["id"], done=True,
                   next_question=None, top3=[dict(r) for r in top3],
                   composer_text=composer_text,
                   recommendation_id=rec["id"], pack_sent=sent)


@router.get("/{session_id}/transcript")
async def transcript(session_id: str):
    """Full saved conversation for one session — every question the system
    asked (in the caller's language and in English) and every answer the
    caller gave (native script + English gloss), in order, plus the frozen
    recommendation. This is the record an officer reads back."""
    srows = q("select * from sessions where id=%s::uuid", (session_id,))
    if not srows:
        raise HTTPException(404, "session not found")
    sess = srows[0]
    b = q("select * from beneficiaries where id=%s::uuid", (sess["beneficiary_id"],))
    ben = b[0] if b else {}

    turns = q("select turn_no, asked, asked_local, heard_text, heard_en, "
              "latency_ms, created_at from voice_turns "
              "where session_id=%s::uuid order by turn_no", (session_id,))
    # Within one stored turn, `heard_text` is the caller's reply to the PREVIOUS
    # question and `asked` is the NEXT question the system then posed — so the
    # true chronological order is heard first, then asked.
    convo = []
    for t in turns:
        if t.get("heard_text"):
            convo.append({"role": "beneficiary",
                          "text": t.get("heard_text"),
                          "text_en": t.get("heard_en"), "turn": t["turn_no"]})
        if t.get("asked") or t.get("asked_local"):
            convo.append({"role": "setu",
                          "text": t.get("asked_local") or t.get("asked"),
                          "text_en": t.get("asked"), "turn": t["turn_no"]})

    rec = q("select top3, composer_text, created_at from recommendations "
            "where session_id=%s::uuid order by created_at desc limit 1", (session_id,))

    return {
        "session_id": session_id,
        "status": sess.get("status"),
        "language": ben.get("language"),
        "beneficiary": {k: v for k, v in ben.items()
                        if k in ("name", "home_district", "age", "education_class",
                                 "education_note", "interests", "aspiration",
                                 "mobility_km", "has_smartphone", "self_employ_ok",
                                 "social_category")},
        "conversation": convo,
        "recommendation": (rec[0] if rec else None),
    }


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


# Affirmative words across the pilot languages. Indic entries are matched by
# containment, NOT by a \b-anchored regex: Python's \b sits between \w and \W,
# and Indic combining marks (virama, matras, chandrabindu) are Mn/Mc — not \w —
# so \bহ্যাঁ\b can never match. That bug used to strand Bengali and Tamil
# callers at the consent gate forever.
_AFFIRMATIVE_ASCII = ("yes", "yeah", "yep", "yup", "sure", "ok", "okay",
                      "haan", "han", "ha", "jee", "ji", "hoy", "aam", "aan")
_AFFIRMATIVE_NATIVE = ("हाँ", "हा", "जी", "हां", "होय",          # hi / mr
                       "হ্যাঁ", "হ্যা", "হাঁ", "জি",             # bn
                       "ஆம்", "ஆமாம்", "சரி")                    # ta


def _is_affirmative(text: str) -> bool:
    t = (text or "").lower()
    if any(re.search(rf"\b{w}\b", t) for w in _AFFIRMATIVE_ASCII):
        return True
    return any(w in text for w in _AFFIRMATIVE_NATIVE)


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
    "aspiration":      {"en": "Got it. And would you rather work close to home, or in the city?",
                        "hi": "ठीक है। और आप काम घर के पास करना चाहेंगी, या शहर में?"},
    "social_category": {"en": "Please say one: SC, ST, OBC, or General.",
                        "hi": "कृपया एक बताएँ: SC, ST, OBC, या सामान्य।"},
}


def _reask(original_question: str, field: str, language: str) -> str:
    """Return the ENGLISH re-ask hint. The router localises it via i18n, and
    the human hi/bn/ta/mr wordings are pre-seeded into the translation cache
    (see reask_seed) so they never touch the network."""
    return (_REASK_HINTS.get(field, {}).get("en")
            or f"Sorry, could you answer again? {original_question}")


def reask_seed() -> dict[str, dict[str, str]]:
    """Human translations of the re-ask hints + filler, shaped for i18n.seed:
    {english_text: {lang: translated}}."""
    out: dict[str, dict[str, str]] = {}
    for _field, langs in _REASK_HINTS.items():
        en = langs.get("en")
        if not en:
            continue
        out[en] = {lang: txt for lang, txt in langs.items() if lang != "en"}
    return out
