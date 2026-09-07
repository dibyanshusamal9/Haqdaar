"""Deterministic normalisation of scraped free-text eligibility.

Turns messy entry-criteria text ("10th pass, age 18+") into the numeric
fields our qualifications table needs. Deterministic and dependency-free —
the original TS version had an LLM fallback (Anthropic); this port keeps the
regex layer and, when it can't parse, raises so the caller quarantines the
row rather than writing bad data.
"""
from __future__ import annotations
import re


class NormalizationError(Exception):
    pass


_CLASS_WORDS = {
    "no formal": 0, "below": 0, "illiterate": 0,
    "5th": 5, "fifth": 5, "8th": 8, "eighth": 8,
    "10th": 10, "tenth": 10, "matric": 10, "secondary": 10,
    "12th": 12, "twelfth": 12, "higher secondary": 12, "senior secondary": 12,
    "iti": 12, "diploma": 13, "graduate": 15, "graduation": 15, "degree": 15,
}


def parse_eligibility(free_text: str) -> dict:
    """Return {entry_min_class, entry_min_age, entry_max_age}. Raises
    NormalizationError if the text carries no usable signal at all."""
    t = (free_text or "").lower()
    out: dict = {"entry_min_class": None, "entry_min_age": 18, "entry_max_age": None}

    # highest class mentioned
    found_class = None
    for kw, cls in _CLASS_WORDS.items():
        if kw in t:
            found_class = cls if found_class is None else max(found_class, cls)
    if found_class is not None:
        out["entry_min_class"] = found_class

    # "age 18+", "18-35 years", "minimum age 18"
    m = re.search(r"(\d{2})\s*(?:-|to)\s*(\d{2})\s*(?:year|yr|saal|वर्ष)", t)
    if m:
        out["entry_min_age"] = int(m.group(1))
        out["entry_max_age"] = int(m.group(2))
    else:
        m = re.search(r"(?:age|minimum age|min age)\D{0,6}(\d{2})", t)
        if m:
            out["entry_min_age"] = int(m.group(1))
        else:
            m = re.search(r"(\d{2})\s*\+", t)
            if m:
                out["entry_min_age"] = int(m.group(1))

    if out["entry_min_class"] is None and "age" not in t and not re.search(r"\d{2}", t):
        raise NormalizationError(f"no eligibility signal in: {free_text[:80]!r}")
    return out


def infer_mode(job_roles: str, eligibility: str) -> str:
    blob = f"{job_roles} {eligibility}".lower()
    if any(w in blob for w in ("on the job", "on-the-job", "apprentice", "ojt")):
        return "on_the_job"
    if any(w in blob for w in ("self employ", "entrepreneur", "own")):
        return "self_employ"
    return "classroom"


def infer_self_employment(job_roles: str) -> bool:
    r = (job_roles or "").lower()
    return any(w in r for w in ("entrepreneur", "self-employ", "self employ", "own"))
