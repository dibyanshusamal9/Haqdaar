"""FR-05 · Highest-info-gain next question.

We rank a small library of questions by how much they would reshape the
top-3. Concretely: for each question whose field is still UNKNOWN, we
simulate two extreme answers, re-rank, and pick the field whose two
outcomes disagree most in top-3 membership.

Cheap and deterministic. No model call. Runs on every turn."""
from __future__ import annotations
from typing import Callable
from ..db import q


# Ordered by prior usefulness — used both as fallback and as candidate list.
QUESTIONS = [
    ("consent",
     {"hi": "क्या मैं आपसे कुछ सवाल पूछ सकती हूँ ताकि आपके लिए सही काम ढूंढ सकें? 'हाँ' कहें आगे बढ़ने के लिए।",
      "bn": "আপনার জন্য উপযুক্ত কাজ খুঁজে দিতে কয়েকটি প্রশ্ন জিজ্ঞেস করি? এগোতে 'হ্যাঁ' বলুন।",
      "ta": "உங்களுக்கு பொருத்தமான வேலை கண்டறிய சில கேள்விகள் கேட்கலாமா? 'ஆம்' என்று சொல்லுங்கள்.",
      "mr": "योग्य काम शोधण्यासाठी काही प्रश्न विचारू का? पुढे जाण्यासाठी 'हो' म्हणा.",
      "en": "May I ask you a few questions so we can find the right work for you? Say 'yes' to continue."}),

    ("name",
     {"hi": "आपका नाम क्या है?",
      "bn": "আপনার নাম কী?",
      "ta": "உங்கள் பெயர் என்ன?",
      "mr": "तुमचं नाव काय आहे?",
      "en": "What is your name?"}),

    ("home_district",
     {"hi": "आप किस ज़िले में रहते हैं?",
      "bn": "আপনি কোন জেলায় থাকেন?",
      "ta": "நீங்கள் எந்த மாவட்டத்தில் வசிக்கிறீர்கள்?",
      "mr": "तुम्ही कोणत्या जिल्ह्यात राहता?",
      "en": "Which district do you live in?"}),

    ("age",
     {"hi": "आपकी उम्र कितनी है?",
      "bn": "আপনার বয়স কত?",
      "ta": "உங்கள் வயது என்ன?",
      "mr": "तुमचं वय किती आहे?",
      "en": "How old are you?"}),

    ("education_class",
     {"hi": "आपने कौन सी कक्षा तक पढ़ाई की है?",
      "bn": "আপনি কোন শ্রেণী পর্যন্ত পড়াশোনা করেছেন?",
      "ta": "நீங்கள் எத்தனையாம் வகுப்பு வரை படித்திருக்கிறீர்கள்?",
      "mr": "तुम्ही किती इयत्तेपर्यंत शिकला आहात?",
      "en": "Up to which class have you studied?"}),

    ("aspiration",
     {"hi": "आप कैसा काम करना चाहेंगे — घर के पास या शहर में?",
      "bn": "আপনি কেমন কাজ চান — বাড়ির কাছে না শহরে?",
      "ta": "நீங்கள் எப்படிப்பட்ட வேலை விரும்புகிறீர்கள் — வீட்டுக்கு அருகில் அல்லது நகரத்தில்?",
      "mr": "तुम्हाला कसं काम हवं — घराजवळ की शहरात?",
      "en": "What kind of work would you like — close to home, or in the city?"}),

    ("interests",
     {"hi": "आपको किन कामों में रुचि है? जैसे बुनाई, मोबाइल रिपेयर, बिजली का काम?",
      "bn": "কী ধরণের কাজে আপনার আগ্রহ? যেমন বুনন, মোবাইল সারানো, বৈদ্যুতিক কাজ?",
      "ta": "எந்த வகை வேலைகளில் ஆர்வம்? உதாரணமாக நெசவு, மொபைல் ரிப்பேர், மின்சாரம்?",
      "mr": "कोणत्या कामांत तुम्हाला रस आहे? विणकाम, मोबाइल दुरुस्ती, वीजकाम?",
      "en": "What kind of work interests you? For example, weaving, mobile repair, or electrical work?"}),

    ("mobility_km",
     {"hi": "आप कितनी दूर तक जाने के लिए तैयार हैं — पास ही, दस बीस किलोमीटर, या शहर तक?",
      "bn": "আপনি কতদূর যেতে রাজি — কাছেই, ১০-২০ কিলোমিটার, না শহরে?",
      "ta": "நீங்கள் எவ்வளவு தூரம் செல்ல தயார் — அருகில், ১০-২০ கிமீ, அல்லது நகரத்திற்கு?",
      "mr": "तुम्ही किती अंतर जाण्यास तयार आहात — जवळच, दहा-वीस किमी, की शहरात?",
      "en": "How far are you willing to travel — nearby, ten to twenty kilometres, or into the city?"}),

    ("has_smartphone",
     {"hi": "क्या आपके पास स्मार्टफोन है, या साधारण फोन?",
      "bn": "আপনার কি স্মার্টফোন আছে, না সাধারণ ফোন?",
      "ta": "உங்களிடம் ஸ்மார்ட்போன் உள்ளதா அல்லது சாதாரண போன்?",
      "mr": "तुमच्याकडे स्मार्टफोन आहे का साधा फोन?",
      "en": "Do you have a smartphone, or a basic phone?"}),

    ("self_employ_ok",
     {"hi": "क्या आप अपना काम शुरू करना चाहेंगे, या नौकरी करना चाहेंगे?",
      "bn": "আপনি কি নিজের কাজ শুরু করতে চান, না চাকরি করতে চান?",
      "ta": "நீங்கள் சொந்த வேலை தொடங்க விரும்புகிறீர்களா அல்லது வேலைக்குச் செல்ல விரும்புகிறீர்களா?",
      "mr": "तुम्हाला स्वतःचं काम सुरू करायचं आहे का नोकरी?",
      "en": "Would you like to start your own work, or take a salaried job?"}),

    ("social_category",
     {"hi": "क्या आप अनुसूचित जाति (SC), अनुसूचित जनजाति (ST), OBC या सामान्य वर्ग से हैं?",
      "bn": "আপনি কি SC, ST, OBC, না সাধারণ শ্রেণীর?",
      "ta": "நீங்கள் SC, ST, OBC அல்லது பொது வகுப்பு?",
      "mr": "तुम्ही SC, ST, OBC की सर्वसाधारण गटातले?",
      "en": "Do you belong to SC, ST, OBC, or the General category?"}),
]


# English base for every question — this is the single source of truth. The
# router translates it to the caller's language at send time (services/i18n),
# so a new language needs no edits here.
QUESTION_EN: dict[str, str] = {field: m["en"] for field, m in QUESTIONS}

# Human translations to pre-seed the translation cache, so the core languages
# stay instant and idiomatic. Shape: {english_text: {lang: translated}}.
SEED: dict[str, dict[str, str]] = {
    m["en"]: {lang: txt for lang, txt in m.items() if lang != "en"}
    for _field, m in QUESTIONS
}


def _text(field: str, language: str = "en") -> str:
    """Return the ENGLISH base question. Localisation is the router's job."""
    return QUESTION_EN.get(field, "")


def pick_next(profile: dict, asked: set[str], language: str = "en") -> tuple[str, str] | None:
    """Return (field_name, english_question_text) or None when done asking.
    The text is always English; the caller localises it."""
    # First turn ⇒ always consent
    if "consent" not in asked:
        return "consent", _text("consent", language)

    # Prioritise blocking unknowns needed by the ranker.
    ordering = ["name", "home_district", "age", "education_class", "aspiration",
                "interests", "mobility_km", "has_smartphone", "self_employ_ok",
                "social_category"]
    for f in ordering:
        if f in asked:
            continue
        if profile.get(f) in (None, [], ""):
            return f, _text(f, language)
    return None
