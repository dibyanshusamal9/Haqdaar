/** Convert supported, explicit Hindi number phrases without guessing unknown words. */
const units: Record<string, number> = {
  शून्य: 0, एक: 1, दो: 2, तीन: 3, चार: 4, पाँच: 5, पांच: 5, छह: 6, छः: 6,
  सात: 7, आठ: 8, नौ: 9, दस: 10, ग्यारह: 11, बारह: 12, तेरह: 13, चौदह: 14,
  पंद्रह: 15, पन्द्रह: 15, सोलह: 16, सत्रह: 17, अठारह: 18, उन्नीस: 19,
  बीस: 20, इक्कीस: 21, बाईस: 22, तेईस: 23, चौबीस: 24, पच्चीस: 25,
  छब्बीस: 26, सत्ताईस: 27, अट्ठाईस: 28, उनतीस: 29, तीस: 30,
  इकतीस: 31, बत्तीस: 32, तैंतीस: 33, चौंतीस: 34, पैंतीस: 35, छत्तीस: 36,
  सैंतीस: 37, अड़तीस: 38, उनतालीस: 39, चालीस: 40, इकतालीस: 41,
  बयालीस: 42, तैंतालीस: 43, चवालीस: 44, पैंतालीस: 45, छियालीस: 46,
  सैंतालीस: 47, अड़तालीस: 48, उनचास: 49, पचास: 50, इक्यावन: 51,
  बावन: 52, तिरपन: 53, चौवन: 54, पचपन: 55, छप्पन: 56, सत्तावन: 57,
  अट्ठावन: 58, उनसठ: 59, साठ: 60, इकसठ: 61, बासठ: 62, तिरसठ: 63,
  चौंसठ: 64, पैंसठ: 65, छियासठ: 66, सड़सठ: 67, अड़सठ: 68, उनहत्तर: 69,
  सत्तर: 70, इकहत्तर: 71, बहत्तर: 72, तिहत्तर: 73, चौहत्तर: 74,
  पचहत्तर: 75, छिहत्तर: 76, सतहत्तर: 77, अठहत्तर: 78, उनासी: 79,
  अस्सी: 80, इक्यासी: 81, बयासी: 82, तिरासी: 83, चौरासी: 84,
  पचासी: 85, छियासी: 86, सतासी: 87, अट्ठासी: 88, नवासी: 89,
  नब्बे: 90, इक्यानवे: 91, बानवे: 92, तिरानवे: 93, चौरानवे: 94,
  पचानवे: 95, छियानवे: 96, सत्तानवे: 97, अट्ठानवे: 98, निन्यानवे: 99,
};
const scales: Record<string, number> = { सौ: 100, हजार: 1000, हज़ार: 1000, लाख: 100000, करोड़: 10000000 };
const word = `(?:${Object.keys({ ...units, ...scales }).sort((a, b) => b.length - a.length).join('|')})`;
const phrase = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${word}(?:\\s+${word})*(?![\\p{L}\\p{M}\\p{N}])`, 'gu');

export function normaliseHindiNumbers(text: string): string {
  return text.replace(phrase, (match, offset: number) => {
    const tokens = match.split(/\s+/);
    if (!tokens.some((token) => token in units)) return match;
    // Fractional Hindi phrases need their own grammar; do not silently round them.
    if (/(?:सवा|साढ़े|डेढ़|ढाई|पौने)\s*$/.test(text.slice(0, offset))) return match;
    // Keep existing mixed digit/unit expressions ("2 लाख") for parseRupees.
    if (/\d\s*$/.test(text.slice(0, offset))) return match;
    let total = 0, group = 0, previousScale = Infinity;
    let hasUnit = false;
    for (const token of tokens) {
      if (token in units) {
        if (hasUnit) return match; // Ambiguous adjacent numbers are not added together.
        group += units[token];
        hasUnit = true;
      } else {
        const scale = scales[token];
        if (scale >= previousScale) return match;
        previousScale = scale;
        if (scale === 100) group = (group || 1) * scale;
        else { total += (group || 1) * scale; group = 0; }
        hasUnit = false;
      }
    }
    return String(total + group);
  });
}
