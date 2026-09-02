"""FR-03 · Typed profile extraction from speech.

Takes a natural-language answer + the last question and returns a
BeneficiaryPatch. A patch that fails validation returns None — the caller
then asks a rephrased question rather than silently writing bad data.

Providers: mock (deterministic rules), anthropic, openai, sarvam.
Swap via EXTRACTOR_PROVIDER env var."""
from __future__ import annotations
import json, re
from typing import Any
import httpx
from ..settings import settings
from ..logging import log
from ..models.beneficiary import BeneficiaryPatch


PROMPT_TEMPLATE = """You are a strict extractor. Read the speaker's short answer and
output ONLY facts that are EXPLICITLY present in that answer.

Emit ONE JSON object using ONLY these fields (OMIT any field the answer does not clearly state):

  {schema}

STRICT RULES — READ EVERY WORD:
1. NEVER GUESS. NEVER INFER. If the answer does not literally contain the fact, OMIT the field.
2. Do not use the "Last question asked" to invent a value. It is context only, not an answer.
3. Do not derive one field from another. Examples of things you MUST NOT do:
   - Mentioning a place name does NOT set mobility_km. Do NOT set mobility_km unless the
     speaker literally says how far they will travel ("5 km", "near home", "in the city").
   - Mentioning "smartphone" alone does NOT tell you their interests. Do NOT set interests.
   - Saying "own work" or "khud ka kaam" sets self_employ_ok=true and NOTHING ELSE.
   - Saying just "yes" / "haan" / "no" sets NOTHING (return {{}}).
   - Saying just a place name ("Delhi", "Nalanda", "Bhagalpur") sets ONLY home_district.
4. If unsure whether a field is stated, OMIT it. Missing is always safer than wrong.
5. Return {{}} if the answer is a greeting, confirmation, or contains no facts.

FIELD DEFINITIONS (only apply when the answer literally contains this info):
- home_district: district/place they LIVE in. Only from words like "I live in X", "I am from X", "mera ghar X mein", or a bare place name.
- age: integer years, ONLY when the answer says a number followed by year/saal/varsh/yrs.
- education_class: highest class passed as int. "12th pass"/"class 12"/"बारहवीं" → 12. "graduate" → 15.
- aspiration: short phrase, ONLY when the speaker describes what kind of work they want ("near home", "city job", "government job").
- interests: array of sector/skill keywords the speaker EXPLICITLY names ("tailoring", "weaving", "mobile repair", "beauty", "dairy", "mason", "retail", "electrical"). Do NOT infer.
- mobility_km: integer km, ONLY when the answer states a distance or clear distance phrase ("5 km", "20 km", "ghar ke paas"→5, "near home"→5, "10-20 km"→20, "shahar tak"/"in the city"→50). A district name alone does NOT set this.
- has_smartphone: true only if smartphone/android/स्मार्टफोन is said; false only if basic/keypad/फीचर फोन is said.
- self_employ_ok: true only if speaker mentions their own work/business/shop/apna kaam/khud ka kaam.
- social_category: one of SC | ST | OBC | GEN, only if stated. Do NOT extract from words like "namaste" that merely contain those letters.
- language: always set to "{language}".

Last question asked (context ONLY — do not treat as an answer): {question}
Speaker's answer: {answer}

Return ONLY the JSON object. No prose, no markdown, no explanation:"""


async def extract(question: str, answer: str, language: str) -> BeneficiaryPatch | None:
    provider = settings.extractor_provider
    llm_raw: dict = {}
    try:
        if provider == "anthropic" and settings.anthropic_api_key:
            llm_raw = await _anthropic(question, answer, language)
        elif provider == "openai" and settings.openai_api_key:
            llm_raw = await _openai(question, answer, language)
        elif provider == "groq" and settings.groq_api_key:
            llm_raw = await _groq(question, answer, language)
        elif provider == "gemini" and settings.gemini_api_key:
            llm_raw = await _gemini(question, answer, language)
        elif provider in ("grok", "xai") and (settings.grok_api_key or settings.xai_api_key):
            llm_raw = await _grok(question, answer, language)
        elif provider == "sarvam" and settings.sarvam_api_key:
            llm_raw = await _sarvam(question, answer, language)
    except Exception as e:
        log.warning("extractor.llm_failed_using_mock_only", err=str(e))

    # Always run deterministic rules too — they catch what the LLM misses.
    mock_raw = _mock(question, answer, language)

    # Sanitize each independently, then merge (mock wins on primitives).
    merged: dict = {}
    for src in (_sanitize(llm_raw or {}, answer), _sanitize(mock_raw, answer)):
        for k, v in src.items():
            if v in (None, "", []):
                continue
            if k == "interests":
                cur = merged.get("interests") or []
                merged["interests"] = list(dict.fromkeys([*cur, *v]))
            else:
                merged[k] = v  # last write wins → mock overrides LLM for primitives

    # Extract home_district from short place-name answers ONLY when the last
    # question was actually asking for the district (otherwise "weaving" or
    # "close to home" would masquerade as a place name).
    if "home_district" not in merged:
        d = _guess_district(answer, question)
        if d:
            merged["home_district"] = d

    try:
        return BeneficiaryPatch(**merged)
    except Exception:
        return None


_STOPWORDS = {"i", "am", "the", "a", "an", "in", "at", "from", "of", "is",
              "and", "or", "to", "my", "our", "we", "you", "he", "she", "they",
              "yes", "no", "haan", "nahi", "ok", "okay", "hello", "hi",
              "please", "thanks", "namaste", "namaskar", "vanakkam"}


def _guess_district(answer: str, question: str = "") -> str | None:
    """Pull a home district from 'I live in X' / 'I am from X' phrasings, or,
    when the last question was clearly about the district, from a bare short
    answer. Otherwise return None — a random short answer must NOT be treated
    as a place name."""
    a = (answer or "").strip()
    if not a:
        return None

    # Phrase forms — always accepted, wherever they appear
    for pat in (r"\blive[s]?\s+in\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]{1,40})",
                r"\bfrom\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]{1,40})",
                r"\brehti\s+hun\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]{1,40})",
                r"([A-Za-zऀ-ॿ][\wऀ-ॿ\s]{1,40})\s+mein\s+rehti"):
        m = re.search(pat, a, re.IGNORECASE)
        if m:
            place = _clean_place(m.group(1))
            if place:
                return place

    # Bare short answer only if the question was actually about district.
    q = (question or "").lower()
    was_district_q = any(k in q for k in ("district", "ज़िले", "जिले", "जिला",
                                          "জেলা", "மாவட்ட", "जिल्हा"))
    if not was_district_q:
        return None

    words = re.findall(r"[A-Za-zऀ-ॿ]+", a)
    if 1 <= len(words) <= 3 and not re.search(r"\d", a):
        keep = [w for w in words if w.lower() not in _STOPWORDS]
        if keep:
            return _clean_place(" ".join(keep))
    return None


def _extract_name(answer: str, was_name_q: bool = False) -> str | None:
    """Pull a personal name. Phrase forms ('my name is X') work anywhere;
    bare short answers ('Radha') are ONLY accepted when the last question was
    actually asking for the name — otherwise 'mobile repair' would masquerade."""
    a = (answer or "").strip().strip(".!?।")
    if not a:
        return None

    # Phrase forms — always accepted
    for pat in (r"my name is\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]{1,40})",
                r"i am\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]{1,40})",
                r"mera naam\s+([A-Za-zऀ-ॿ][\wऀ-ॿ\s]{1,40})",
                r"मेरा नाम\s+([\wऀ-ॿ\s]{1,40})",
                r"என் பெயர்\s+([\wऀ-ॿ\s]{1,40})",
                r"আমার নাম\s+([\wऀ-ॿ\s]{1,40})"):
        m = re.search(pat, a, re.IGNORECASE)
        if m:
            n = _clean_name(m.group(1))
            if n:
                return n

    if not was_name_q:
        return None

    # Bare short answer of 1–3 words with no digits → treat as a name
    words = re.findall(r"[A-Za-zऀ-ॿ]+", a)
    if 1 <= len(words) <= 3 and not re.search(r"\d", a):
        keep = [w for w in words if w.lower() not in _STOPWORDS]
        if keep:
            return _clean_name(" ".join(keep))
    return None


def _clean_name(s: str) -> str | None:
    s = re.sub(r"\b(is|hai|hu|hun|call me|me|my)\b", "", s, flags=re.IGNORECASE).strip()
    s = s.strip(" ,.!?।")
    if not s or len(s) < 2:
        return None
    parts = s.split()[:3]
    return " ".join(p.capitalize() if p.isascii() else p for p in parts)


def _clean_place(s: str) -> str | None:
    s = s.strip(" ,.!?।")
    if not s or len(s) < 2:
        return None
    # cap at 3 words to avoid grabbing a whole sentence
    parts = s.split()[:3]
    return " ".join(p.capitalize() if p.isascii() else p for p in parts)


# ----- Grounding guard: drop any field the LLM can't justify from the text -----
_DISTANCE_HINTS = ("km", "kilomet", "किमी", "किलोमीटर", "kilomit", "কিলোমিটার",
                   "கிலோ", "किलो", "near", "paas", "पास", "close", "nearby",
                   "ghar ke paas", "shahar", "शहर", "city", "in the city",
                   "gaon", "गांव", "गाँव", "home")
_SMARTPHONE_YES = ("smart", "स्मार्ट", "android", "एंड्रॉ", "iphone")
_SMARTPHONE_NO  = ("basic", "keypad", "feature phone", "फीचर", "सामान्य फोन", "साधा फोन")
_SELF_EMPLOY    = ("own work", "own business", "apna kaam", "khud ka", "अपना काम",
                   "स्वयं", "shop", "दुकान", "business", "व्यवसाय", "self")
_INTEREST_WORDS = {
    "tailor": "apparel", "silai": "apparel", "सिलाई": "apparel", "sewing": "apparel",
    "embroid": "apparel", "बुनाई": "handloom", "weav": "handloom", "handloom": "handloom",
    "mobile": "telecom", "phone repair": "telecom",
    "beauty": "beauty & wellness", "makeup": "beauty & wellness", "mehendi": "beauty & wellness",
    "dairy": "agriculture", "दूध": "agriculture", "poultry": "agriculture", "kheti": "agriculture",
    "mason": "construction", "mistri": "construction", "बिजली": "electronics",
    "electric": "electronics", "solar": "electronics",
    "retail": "retail", "shop": "retail", "दुकान": "retail",
    "welder": "construction", "plumber": "construction",
}
_CATEGORY_WORDS = {"sc": "SC", "st": "ST", "obc": "OBC", "gen": "GEN",
                   "general": "GEN", "अनुसूचित जाति": "SC", "अनुसूचित जनजाति": "ST"}


def _sanitize(patch: dict, answer: str) -> dict:
    """Drop any field the LLM invented — keep only those grounded in the answer."""
    if not patch:
        return {}
    a = (answer or "").lower()

    out = dict(patch)

    # mobility_km: only if the text contains a distance signal
    if "mobility_km" in out and not any(h in a for h in _DISTANCE_HINTS):
        out.pop("mobility_km", None)

    # age: only if a small integer is literally in the answer
    if "age" in out:
        m = re.search(r"\b(\d{1,2})\b", a)
        if not m or not (10 <= int(m.group(1)) <= 80):
            out.pop("age", None)

    # education_class: only if a class hint is present (digit OR word form OR bare number)
    if "education_class" in out:
        digit_ok = re.search(r"class\s*\d{1,2}|\b\d{1,2}\s*(th|वीं|कक्षा|pass|पास|standard|std)", a)
        word_ok  = re.search(r"\b(tenth|eleventh|twelfth|eighth|ninth|seventh|sixth|fifth|"
                             r"बारह|दस|आठ|graduate|स्नातक|diploma|डिप्लोमा|matric|inter)\b", a)
        bare_ok  = re.fullmatch(r"\s*\d{1,2}\s*", a)  # a lone number as an answer
        if not (digit_ok or word_ok or bare_ok):
            out.pop("education_class", None)

    # has_smartphone: only if the text talks about a phone
    if "has_smartphone" in out:
        if out["has_smartphone"] and not any(w in a for w in _SMARTPHONE_YES):
            out.pop("has_smartphone", None)
        elif out["has_smartphone"] is False and not any(w in a for w in _SMARTPHONE_NO):
            out.pop("has_smartphone", None)

    # self_employ_ok: needs a self-employment keyword
    if "self_employ_ok" in out and out["self_employ_ok"]:
        if not any(w in a for w in _SELF_EMPLOY):
            out.pop("self_employ_ok", None)

    # interests: drop items the speaker never said
    if "interests" in out and isinstance(out["interests"], list):
        kept = []
        for item in out["interests"]:
            item_l = str(item).lower()
            for kw, canonical in _INTEREST_WORDS.items():
                if kw in a and (canonical in item_l or kw in item_l):
                    kept.append(canonical)
                    break
        out["interests"] = list(dict.fromkeys(kept))  # dedupe, preserve order
        if not out["interests"]:
            out.pop("interests", None)

    # social_category: must be one of the codes AND literally mentioned as a word
    if "social_category" in out:
        cat = str(out["social_category"]).upper()
        if cat not in {"SC", "ST", "OBC", "GEN"}:
            out.pop("social_category", None)
        else:
            # ensure the text actually mentions it as a word (not just letters inside "namaste")
            hit = re.search(r"\b(sc|st|obc|gen|general)\b", a) or \
                  ("अनुसूचित जाति" in a) or ("अनुसूचित जनजाति" in a) or ("पिछड़ा" in a)
            if not hit:
                out.pop("social_category", None)

    # aspiration: keep only if the answer talks about wanting/preferring work
    if "aspiration" in out:
        if not re.search(r"want|would like|prefer|चाहती|चाहत|चाहूँ|kaam|काम|job|work|near|paas|shahar|city", a):
            out.pop("aspiration", None)

    # home_district: keep as-is (a place name is hard to hallucinate from typed input)
    return out


# ----- Mock extractor: deterministic heuristics good enough for demo -----
def _mock(question: str, answer: str, language: str) -> dict[str, Any]:
    a = answer.lower()
    p: dict[str, Any] = {"language": language}
    # name — only when the question was about the person's name
    q = (question or "").lower()
    if any(k in q for k in ("name?", "your name", "नाम क्या", "பெயர் என்ன", "নাম কী", "नाव काय")):
        name = _extract_name(answer, was_name_q=True)
        if name:
            p["name"] = name
    # age — accept "22 saal", "22 years", or a bare small integer when asked about age
    m = re.search(r"\b(\d{1,2})\s*(?:साल|साला|वर्ष|saal|varsh|years?|yrs?|yr|old)\b", a)
    if m:
        p["age"] = int(m.group(1))
    else:
        # Bare number in an "age" context — the question tells us the topic.
        q_low = (question or "").lower()
        if any(k in q_low for k in ("age", "how old", "उम्र", "वय", "বয়স", "வயது")):
            m2 = re.fullmatch(r"\s*(\d{1,2})\s*", a)
            if m2 and 10 <= int(m2.group(1)) <= 80:
                p["age"] = int(m2.group(1))
    # class
    m = re.search(r"class\s*(\d{1,2})|(\d{1,2})\s*(?:th|वीं|कक्षा|pass|पास|standard|std)", a)
    if m:
        p["education_class"] = int(next(g for g in m.groups() if g))
    word_class = {"fifth":5, "sixth":6, "seventh":7, "eighth":8, "ninth":9,
                  "tenth":10, "matric":10, "eleventh":11, "twelfth":12, "inter":12,
                  "graduate":15, "स्नातक":15, "diploma":13, "डिप्लोमा":13,
                  "बारह":12, "दस":10, "आठ":8}
    for w, cls in word_class.items():
        if re.search(rf"\b{w}\b", a):
            p.setdefault("education_class", cls)
            break
    # Bare number in an education context — the last question tells us
    if "education_class" not in p:
        q_low2 = (question or "").lower()
        if any(k in q_low2 for k in ("class", "studied", "education", "कक्षा", "पढ़ाई", "শ্রেণ", "வகுப்பு")):
            m3 = re.fullmatch(r"\s*(\d{1,2})\s*", a)
            if m3 and 1 <= int(m3.group(1)) <= 15:
                p["education_class"] = int(m3.group(1))
    # smartphone
    if any(w in a for w in ["smartphone", "स्मार्टफोन", "android"]):
        p["has_smartphone"] = True
    if any(w in a for w in ["basic phone", "फीचर फोन", "keypad"]):
        p["has_smartphone"] = False
    # mobility
    m = re.search(r"(\d{1,3})\s*km", a)
    if m:
        p["mobility_km"] = int(m.group(1))
    # mobility keywords only — a bare place/district name should NOT set travel range.
    if any(w in a for w in ["गाँव", "गांव", "near home", "close to home", "nearby",
                            "यहीं", "ghar ke paas", "paas hi", "close by"]):
        p.setdefault("mobility_km", 5)
        p.setdefault("aspiration", "close to home")
    if re.search(r"\b(city|shahar|शहर|in the city|in city)\b", a):
        p.setdefault("mobility_km", 50)
        p.setdefault("aspiration", "in the city")
    # aspirations & interests
    for kw, sector in [("weav", "handloom"), ("बुनाई", "handloom"), ("handloom", "handloom"),
                       ("phone repair", "telecom"), ("mobile repair", "telecom"),
                       ("electric", "electronics"), ("बिजली", "electronics"), ("solar", "electronics"),
                       ("beauty", "beauty & wellness"), ("makeup", "beauty & wellness"),
                       ("mehendi", "beauty & wellness"), ("hair", "beauty & wellness"),
                       ("dairy", "agriculture"), ("दूध", "agriculture"), ("poultry", "agriculture"),
                       ("sew", "apparel"), ("silai", "apparel"), ("सिलाई", "apparel"),
                       ("tailor", "apparel"), ("embroid", "apparel"),
                       ("retail", "retail"), ("shop", "retail"), ("दुकान", "retail"),
                       ("mason", "construction"), ("mistri", "construction"),
                       ("welder", "construction"), ("plumber", "construction")]:
        if kw in a:
            p.setdefault("interests", []).append(sector)
    if "own work" in a or "own business" in a or "self" in a or "अपना काम" in a \
       or "khud ka" in a or "व्यवसाय" in a or "business" in a:
        p["self_employ_ok"] = True
    if "job" in a or "naukri" in a or "salary" in a or "salaried" in a or "नौकरी" in a:
        p["self_employ_ok"] = False
    # category
    for cat in ["SC", "ST", "OBC", "GEN"]:
        if cat.lower() in a:
            p["social_category"] = cat
    if "अनुसूचित जाति" in a:
        p["social_category"] = "SC"
    return p


# ----- Real providers -----
def _prompt(question: str, answer: str, language: str) -> str:
    schema = ", ".join(BeneficiaryPatch.model_fields.keys())
    return PROMPT_TEMPLATE.format(schema=schema, question=question,
                                  answer=answer, language=language)


async def _anthropic(question: str, answer: str, language: str) -> dict:
    url = "https://api.anthropic.com/v1/messages"
    headers = {"x-api-key": settings.anthropic_api_key,
               "anthropic-version": "2023-06-01"}
    body = {"model": "claude-3-5-sonnet-20241022", "max_tokens": 400,
            "messages": [{"role": "user", "content": _prompt(question, answer, language)}]}
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        text = r.json()["content"][0]["text"]
        return json.loads(_first_json(text))


async def _openai(question: str, answer: str, language: str) -> dict:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
    body = {"model": "gpt-4o-mini",
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": _prompt(question, answer, language)}]}
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        return json.loads(r.json()["choices"][0]["message"]["content"])


async def _sarvam(question: str, answer: str, language: str) -> dict:
    url = "https://api.sarvam.ai/v1/chat/completions"
    headers = {"api-subscription-key": settings.sarvam_api_key}
    body = {"model": settings.sarvam_llm_model,
            "temperature": 0.0,
            "messages": [{"role": "user", "content": _prompt(question, answer, language)}]}
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        return json.loads(_first_json(r.json()["choices"][0]["message"]["content"]))


async def _groq(question: str, answer: str, language: str) -> dict:
    """Groq — free tier, ~200ms latency, Llama 3.3 70B."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
    body = {"model": settings.groq_model,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": _prompt(question, answer, language)}],
            "temperature": 0.1}
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        return json.loads(_first_json(r.json()["choices"][0]["message"]["content"]))


async def _gemini(question: str, answer: str, language: str) -> dict:
    """Google Gemini — generous free tier (Gemini 2.0 Flash)."""
    model = settings.gemini_model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.gemini_api_key}"
    body = {"contents": [{"parts": [{"text": _prompt(question, answer, language)}]}],
            "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}}
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.post(url, json=body)
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(_first_json(text))


async def _grok(question: str, answer: str, language: str) -> dict:
    url = "https://api.x.ai/v1/chat/completions"
    api_key = settings.grok_api_key or settings.xai_api_key
    headers = {"Authorization": f"Bearer {api_key}"}
    body = {
        "model": settings.grok_model,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": _prompt(question, answer, language)}],
        "temperature": 0.1,
    }
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        return json.loads(_first_json(text))


def _first_json(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    return text[start:end + 1] if start >= 0 and end > start else "{}"
