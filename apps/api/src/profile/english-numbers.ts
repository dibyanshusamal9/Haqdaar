/**
 * English number words -> digits ("forty-five" -> 45, "one lakh twenty thousand" -> 120000).
 * Speech-to-text and translation often spell numbers out; the keyword rules read digits.
 * Only whole, explicit phrases are converted; anything ambiguous is left as it was.
 */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = {
  hundred: 100, thousand: 1000, lakh: 100_000, lakhs: 100_000, lac: 100_000, lacs: 100_000,
  million: 1_000_000, crore: 10_000_000, crores: 10_000_000,
};

const WORD = `(?:${[...Object.keys(UNITS), ...Object.keys(SCALES)].sort((a, b) => b.length - a.length).join('|')})`;
const PHRASE = new RegExp(`\\b${WORD}(?:(?:\\s+and\\s+|[\\s-]+)${WORD})*\\b`, 'gi');

function value(phrase: string): number | null {
  const words = phrase.toLowerCase().split(/[\s-]+/).filter((w) => w && w !== 'and');
  if (!words.some((w) => w in UNITS)) return null; // "lakh" alone stays a word
  let total = 0;
  let current = 0;
  for (const w of words) {
    if (w in UNITS) current += UNITS[w];
    else if (w === 'hundred') current = (current || 1) * 100;
    else {
      // thousand / lakh / million / crore close a group
      total += (current || 1) * SCALES[w];
      current = 0;
    }
  }
  return total + current;
}

export function normaliseEnglishNumbers(text: string): string {
  return text.replace(PHRASE, (match) => {
    const n = value(match);
    return n === null ? match : String(n);
  });
}
