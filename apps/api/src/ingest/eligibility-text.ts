/**
 * Deterministic parsing of myscheme eligibility prose (FR-08). No language model: these
 * are regular expressions, so the same text always yields the same predicates. Anything
 * that looks like a condition but does not parse cleanly is reported so the scheme can
 * be flagged for the curator instead of being guessed at.
 */

export function cleanMarkdown(md: string | null | undefined): string {
  if (!md) return '';
  return decodeEntities(
    md
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s*>+/gm, ' '),
  )
    .replace(/[*_#`|]/g, ' ')
    .replace(/ /g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** myscheme text is sometimes double-escaped ("&amp;amp;"), so &amp; is undone repeatedly. */
function decodeEntities(s: string): string {
  let out = s;
  for (let i = 0; i < 3 && /&amp;/.test(out); i++) out = out.replace(/&amp;/g, '&');
  return out
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&le;/g, '≤')
    .replace(/&ge;/g, '≥')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

const UNIT = String.raw`(lakhs?|lacs?|lakh|crores?|cr\b|thousand|k\b|l\b)`;
// "₹ 2,50,000", "Rs. 2.5 lakh", "INR 100000", "2.5 lakh", "₹2.5L"
const MONEY = new RegExp(
  String.raw`(?:(?:₹|rs\.?|inr|rupees)\s*([\d,]+(?:\.\d+)?)\s*(?:/-)?\s*${UNIT}?)|(?:\b([\d,]+(?:\.\d+)?)\s*${UNIT})`,
  'gi',
);

export function moneyValue(num: string, unit: string | undefined): number | null {
  const n = Number(num.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = (unit ?? '').toLowerCase();
  if (/^(lakh|lac|l$)/.test(u)) return Math.round(n * 100_000);
  if (/^(crore|cr)/.test(u)) return Math.round(n * 10_000_000);
  if (/^(thousand|k)/.test(u)) return Math.round(n * 1000);
  return Math.round(n);
}

export interface IncomeParse {
  /** Annual ceilings found, in rupees, ascending and de-duplicated. */
  ceilings: number[];
  /** Income mentioned with a limit-ish phrase that we could not turn into a number. */
  unparsed: boolean;
}

const CEILING_CUE = /(not\s+exceed|not\s+be\s+more\s+than|not\s+more\s+than|should\s+be\s+less\s+than|less\s+than|lower\s+than|below|under|up\s*to|upto|within|maximum|max\.?|does\s+not\s+exceed|doesn't\s+exceed|or\s+less|ceiling|limit|capped|≤|<)/i;
const FLOOR_CUE = /(more\s+than|above|at\s+least|minimum|exceeds?|exceeding|greater\s+than|higher\s+than|over|≥|>)\s*$/i;
// "should not be more than ₹X", "not above ₹X", "must not exceed ₹X": a ceiling, despite the floor word.
const NEGATED_FLOOR = /\b(?:not|n't|never)\s+(?:be\s+)?(?:more|greater|higher)\s+than\s*$|\b(?:not|n't)\s+(?:be\s+)?(?:above|over)\s*$|\bnot\s+exceed(?:ing|s)?\s*$/i;
// "...is not eligible if the family income exceeds ₹X": an exclusion above X, i.e. a ceiling.
const EXCLUSION = /\b(?:not\s+eligible|ineligible|excluded|disqualified|will\s+not\s+be|shall\s+not\s+be|cannot\s+apply|can\s*not\s+apply)\b/i;
const NO_LIMIT = /\bno\s+(?:upper\s+)?(?:income\s+)?(?:limit|ceiling|bar|criteria|restriction)\b|\bno\s+(?:upper\s+)?limit\s+on\s+(?:the\s+)?(?:annual\s+|family\s+)?income/i;

export function parseIncome(text: string): IncomeParse {
  const ceilings = new Set<number>();
  let unparsed = false;
  const lines = cleanMarkdown(text).split(/\n|(?<=[a-z0-9)])\.\s+(?=[A-Z])/);
  for (const line of lines) {
    const lower = line.toLowerCase();
    const at = lower.search(/\bincome\b/);
    if (at < 0) continue;
    if (/income\s*tax/.test(lower) && !/(family|annual|household)\s+income/.test(lower)) continue;
    if (NO_LIMIT.test(line)) continue;
    const window = line.slice(Math.max(0, at - 80), at + 220);
    const monthly = /(per\s+month|monthly|a\s+month|p\.\s*m\.)/i.test(window);
    let found = false;
    MONEY.lastIndex = 0;
    for (const m of window.matchAll(MONEY)) {
      const amount = moneyValue(m[1] ?? m[3], m[2] ?? m[4]);
      if (amount === null) continue;
      const value = monthly ? amount * 12 : amount;
      if (value < 1000) continue;
      const before = window.slice(Math.max(0, (m.index ?? 0) - 60), m.index).trim();
      const floorCue = FLOOR_CUE.test(before) && !NEGATED_FLOOR.test(before);
      const ceilingCue = !floorCue && (CEILING_CUE.test(before) || NEGATED_FLOOR.test(before));
      // In an exclusion ("not eligible if income exceeds X") the comparison flips.
      const isCeiling = EXCLUSION.test(line) ? floorCue : ceilingCue || (!floorCue && CEILING_CUE.test(window));
      if (!isCeiling) {
        unparsed = true;
        continue;
      }
      ceilings.add(value);
      found = true;
    }
    if (!found && /(limit|ceiling|not\s+exceed|less\s+than|below|upto|up\s+to)/.test(lower) && /\bincome\b/.test(lower)) {
      unparsed = true;
    }
  }
  return { ceilings: [...ceilings].sort((a, b) => a - b), unparsed: unparsed && ceilings.size === 0 };
}

export interface AgeParse {
  lower: number | null;
  upper: number | null;
  /** Several different values for the same bound: left to the curator. */
  ambiguous: boolean;
}

export function parseAge(text: string): AgeParse {
  const t = cleanMarkdown(text).toLowerCase();
  const lowers = new Set<number>();
  const uppers = new Set<number>();
  const ok = (n: number) => n >= 0 && n <= 110;

  // "aged between 18 years (completed) and 70 years", "between 18-40 years of age"
  const between = /(?:between|from)\s+(\d{1,3})\s*(?:years?|yrs)?[^\d.\n]{0,25}?(?:\band\b|\bto\b|-)\s*(\d{1,3})\s*(?:years?|yrs)/g;
  for (const m of t.matchAll(between)) {
    const before = t.slice(Math.max(0, (m.index ?? 0) - 45), m.index);
    const after = t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12);
    if (!/\b(?:age|aged)\b/.test(before) && !/^\s*(?:of\s+age|old)/.test(after)) continue;
    const [lo, hi] = [Number(m[1]), Number(m[2])];
    if (ok(lo) && ok(hi) && lo < hi) {
      lowers.add(lo);
      uppers.add(hi);
    }
  }
  for (const m of t.matchAll(/\b(?:age|aged)\b[^.\n]{0,30}?\b(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\s*(?:years?|yrs)/g)) {
    const [lo, hi] = [Number(m[1]), Number(m[2])];
    if (ok(lo) && ok(hi) && lo < hi) {
      lowers.add(lo);
      uppers.add(hi);
    }
  }
  for (const m of t.matchAll(/(?:minimum\s+age|min\.?\s+age|lower\s+age\s+limit)\s*(?:of|is|should\s+be|:|-)?\s*(\d{1,3})/g)) {
    if (ok(Number(m[1]))) lowers.add(Number(m[1]));
  }
  for (const m of t.matchAll(/(?:maximum\s+age|max\.?\s+age|upper\s+age\s+limit)\s*(?:of|is|should\s+be|:|-)?\s*(\d{1,3})/g)) {
    if (ok(Number(m[1]))) uppers.add(Number(m[1]));
  }
  for (const m of t.matchAll(/\b(?:age|aged)\b[^.\n]{0,25}?(?:at\s+least|not\s+less\s+than|above|over|more\s+than|minimum\s+of)\s+(\d{1,3})\s*(?:years?|yrs)/g)) {
    if (ok(Number(m[1]))) lowers.add(Number(m[1]));
  }
  for (const m of t.matchAll(/\b(?:age|aged)\b[^.\n]{0,15}?\b(\d{1,3})\s*(?:years?|yrs)\s*(?:of\s+age\s*)?(?:and|or)\s+(?:above|more|older)/g)) {
    if (ok(Number(m[1]))) lowers.add(Number(m[1]));
  }
  for (const m of t.matchAll(/\b(?:age|aged)\b[^.\n]{0,25}?(?:not\s+more\s+than|not\s+exceed(?:ing)?|up\s*to|upto|maximum\s+of)\s+(\d{1,3})\s*(?:years?|yrs)/g)) {
    if (ok(Number(m[1]))) uppers.add(Number(m[1]));
  }
  for (const m of t.matchAll(/\b(?:age|aged)\b[^.\n]{0,25}?(?:below|under|less\s+than)\s+(\d{1,3})\s*(?:years?|yrs)/g)) {
    const n = Number(m[1]);
    if (ok(n) && n > 0) uppers.add(n - 1);
  }

  const ambiguous = lowers.size > 1 || uppers.size > 1;
  return {
    lower: lowers.size === 1 ? [...lowers][0] : null,
    upper: uppers.size === 1 ? [...uppers][0] : null,
    ambiguous,
  };
}
