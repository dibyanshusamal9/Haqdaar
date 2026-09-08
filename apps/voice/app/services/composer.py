"""FR-06 · Spoken result with reason per recommendation.

Composer LLM (Sarvam-M) reads the top-3 back in the beneficiary's language.
Guarantee: names, distances and centres are quoted from input rows — the
LLM only paraphrases the reason. If the LLM output drops or renames a
recommendation, we fall back to a deterministic template.
"""
from __future__ import annotations
import httpx, json
from ..settings import settings
from ..logging import log


def _reason_from_scores(row: dict) -> str:
    scores = {
        "aspiration": row.get("score_aspiration", 0),
        "demand": row.get("score_demand", 0),
        "mobility": row.get("score_mobility", 0),
        "gap": row.get("score_gap", 0),
        "history": row.get("score_history", 0),
    }
    top = max(scores, key=scores.get)
    return top


TEMPLATES = {
    "hi": {
        "intro": "आपके लिए तीन रास्ते हैं।",
        "line": "{ord} — {name}, {sector} में, स्तर {level}। नज़दीकी केंद्र {centre}, लगभग {km} किलोमीटर। कारण: {reason}।",
        "reason_words": {"aspiration": "आपकी रुचि से मेल खाता है",
                         "demand": "आपके ज़िले में इसकी माँग है",
                         "mobility": "आपकी पहुँच के अंदर है",
                         "gap": "यहाँ प्रशिक्षण कम है",
                         "history": "पिछले बैच सफल रहे हैं"},
        "ordinals": ["पहला", "दूसरा", "तीसरा"],
        "outro": "आपको एसएमएस और व्हाट्सएप पर पूरा विवरण मिल जाएगा।",
    },
    "en": {
        "intro": "Here are three pathways for you.",
        "line": "{ord}: {name} in {sector}, NSQF level {level}. Nearest centre {centre}, about {km} kilometres away. Reason: {reason}.",
        "reason_words": {"aspiration": "it matches your interest",
                         "demand": "there is demand in your district",
                         "mobility": "it is within your reach",
                         "gap": "training here is limited",
                         "history": "past batches did well"},
        "ordinals": ["First", "Second", "Third"],
        "outro": "You will receive the full details on SMS and WhatsApp.",
    },
    "bn": {
        "intro": "আপনার জন্য তিনটি পথ আছে।",
        "line": "{ord} — {name}, {sector} খাতে, NSQF স্তর {level}। কাছের কেন্দ্র {centre}, প্রায় {km} কিলোমিটার। কারণ: {reason}।",
        "reason_words": {"aspiration": "আপনার আগ্রহের সাথে মিলে যায়",
                         "demand": "আপনার জেলায় এর চাহিদা আছে",
                         "mobility": "আপনার নাগালে আছে",
                         "gap": "এখানে প্রশিক্ষণ কম",
                         "history": "গত ব্যাচগুলি সফল হয়েছে"},
        "ordinals": ["প্রথম", "দ্বিতীয়", "তৃতীয়"],
        "outro": "সম্পূর্ণ বিবরণ আপনি SMS ও WhatsApp-এ পেয়ে যাবেন।",
    },
    "ta": {
        "intro": "உங்களுக்கு மூன்று வழிகள் உள்ளன.",
        "line": "{ord} — {name}, {sector} துறையில், NSQF நிலை {level}. அருகிலுள்ள மையம் {centre}, சுமார் {km} கிலோமீட்டர். காரணம்: {reason}.",
        "reason_words": {"aspiration": "உங்கள் ஆர்வத்துடன் பொருந்துகிறது",
                         "demand": "உங்கள் மாவட்டத்தில் தேவை உள்ளது",
                         "mobility": "உங்கள் அணுகலுக்குள் உள்ளது",
                         "gap": "இங்கே பயிற்சி குறைவு",
                         "history": "முந்தைய தொகுதிகள் வெற்றி பெற்றன"},
        "ordinals": ["முதல்", "இரண்டாவது", "மூன்றாவது"],
        "outro": "முழு விவரங்கள் SMS மற்றும் WhatsApp-இல் கிடைக்கும்.",
    },
    "mr": {
        "intro": "तुमच्यासाठी तीन मार्ग आहेत.",
        "line": "{ord} — {name}, {sector} क्षेत्रात, NSQF स्तर {level}. जवळचे केंद्र {centre}, सुमारे {km} किलोमीटर. कारण: {reason}.",
        "reason_words": {"aspiration": "तुमच्या आवडीशी जुळते",
                         "demand": "तुमच्या जिल्ह्यात मागणी आहे",
                         "mobility": "तुमच्या पोहोचात आहे",
                         "gap": "इथे प्रशिक्षण कमी आहे",
                         "history": "मागील तुकड्या यशस्वी झाल्या आहेत"},
        "ordinals": ["पहिला", "दुसरा", "तिसरा"],
        "outro": "पूर्ण तपशील तुम्हाला SMS आणि WhatsApp वर मिळतील.",
    },
}


def render_template(top3: list[dict], language: str = "hi",
                    beneficiary: dict | None = None) -> str:
    t = TEMPLATES.get(language) or TEMPLATES["en"]

    # If NONE of the top-3 has a known centre, tell the caller up front —
    # the "— about — kilometres" phrasing was confusing.
    have_any_centre = any(r.get("centre_name") for r in top3)
    lines = [t["intro"]]
    if not have_any_centre:
        district = (beneficiary or {}).get("home_district") or ""
        no_centre_notes = {
            "en": f"We don't have a training centre listed in your district ({district}) yet — these three are the best matches from the national NSQF catalogue, and a mobiliser will call to confirm the nearest option.",
            "hi": f"अभी आपके ज़िले ({district}) में कोई प्रशिक्षण केंद्र दर्ज नहीं है — ये तीन राष्ट्रीय NSQF सूची से सबसे उपयुक्त हैं, नज़दीकी केंद्र की पुष्टि के लिए एक साथी आपको फ़ोन करेगा।",
            "bn": f"আপনার জেলায় ({district}) এখনো কোনো প্রশিক্ষণ কেন্দ্র নথিভুক্ত নেই — জাতীয় NSQF তালিকা থেকে এই তিনটি সেরা মিল, নিকটতম কেন্দ্রের বিষয়ে একজন সমন্বয়ক ফোন করবেন।",
            "ta": f"உங்கள் மாவட்டத்தில் ({district}) இன்னும் பயிற்சி மையம் பதிவு செய்யப்படவில்லை — தேசிய NSQF பட்டியலிலிருந்து இந்த மூன்று சிறந்த பொருத்தங்கள்.",
            "mr": f"तुमच्या जिल्ह्यात ({district}) अजून प्रशिक्षण केंद्र नोंदलेले नाही — राष्ट्रीय NSQF सूचीतून हे तीन सर्वोत्तम पर्याय आहेत.",
        }
        lines.append(no_centre_notes.get(language, no_centre_notes["en"]))

    for i, r in enumerate(top3):
        reason_key = _reason_from_scores(r)
        centre = r.get("centre_name")
        km_val = r.get("distance_km")
        # Fold the centre's district into the centre label so all languages say
        # WHERE the centre is (it may be in a different district from the caller).
        cdist = r.get("centre_district")
        centre_label = f"{centre} ({cdist})" if (centre and cdist) else centre
        # Choose a per-row wording depending on whether we know a centre.
        if centre and km_val is not None:
            line = t["line"].format(
                ord=t["ordinals"][min(i, 2)],
                name=r.get("qualification_name") or r.get("qp_code") or "—",
                sector=r.get("sector") or "—",
                level=r.get("nsqf_level") or "—",
                centre=centre_label,
                km=km_val,
                reason=t["reason_words"][reason_key],
            )
        else:
            line_no_centre = {
                "en": "{ord}: {name} in {sector}, NSQF level {level}. Reason: {reason}.",
                "hi": "{ord} — {name}, {sector} में, स्तर {level}। कारण: {reason}।",
                "bn": "{ord} — {name}, {sector} খাতে, NSQF স্তর {level}। কারণ: {reason}।",
                "ta": "{ord} — {name}, {sector} துறையில், NSQF நிலை {level}. காரணம்: {reason}.",
                "mr": "{ord} — {name}, {sector} क्षेत्रात, NSQF स्तर {level}. कारण: {reason}.",
            }.get(language, "{ord}: {name} in {sector}, NSQF level {level}. Reason: {reason}.")
            line = line_no_centre.format(
                ord=t["ordinals"][min(i, 2)],
                name=r.get("qualification_name") or r.get("qp_code") or "—",
                sector=r.get("sector") or "—",
                level=r.get("nsqf_level") or "—",
                reason=t["reason_words"][reason_key],
            )
        lines.append(line)
    lines.append(t["outro"])
    return " ".join(lines)


async def compose(top3: list[dict], language: str, profile: dict) -> str:
    """Render the spoken result. For the languages with a native template
    (en/hi/bn/ta/mr) render directly — no network, fully offline. For any
    other scheduled language render English and let the router translate it
    via i18n (which needs Sarvam translate credits; without them it safely
    falls back to English)."""
    lang = (language or "en").lower()
    if lang in TEMPLATES:
        return render_template(top3, lang, beneficiary=profile)
    return render_template(top3, "en", beneficiary=profile)


def _mentions_all(text: str, top3: list[dict]) -> bool:
    if not text:
        return False
    t = text.lower()
    for r in top3:
        n = (r.get("qualification_name") or "").lower()
        if not n:
            continue
        first_two = " ".join(n.split()[:2])
        if first_two and first_two not in t:
            return False
    return True


async def _sarvam_compose(top3: list[dict], language: str, profile: dict) -> str:
    url = "https://api.sarvam.ai/v1/chat/completions"
    headers = {"api-subscription-key": settings.sarvam_api_key}
    lang_name = {"hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "mr": "Marathi",
                 "en": "English", "te": "Telugu", "gu": "Gujarati",
                 "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi"}.get(language, "Hindi")
    system = (f"You are a kind counsellor speaking to a beneficiary in {lang_name}. "
              f"Reply ONLY in {lang_name}. "
              "Read out THREE recommendations, in order, in 4-6 short sentences total. "
              "For each, mention the qualification NAME EXACTLY as given, the sector, "
              "the centre name and distance in km, and ONE reason from its scores. "
              "Do not add, drop, or rename recommendations.")
    user = "Recommendations:\n" + json.dumps(top3, ensure_ascii=False, default=str)
    body = {"model": settings.sarvam_llm_model,
            "messages": [{"role": "system", "content": system},
                         {"role": "user", "content": user}]}
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(url, headers=headers, json=body)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
