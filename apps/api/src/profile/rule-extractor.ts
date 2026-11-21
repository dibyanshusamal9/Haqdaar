import { normaliseProfileInput, parseRupees, Profile, STATES } from '../domain/profile';
import { normaliseEnglishNumbers } from './english-numbers';
import { normaliseHindiNumbers } from './hindi-numbers';

/**
 * Keyword/regex extraction of profile fields from a transcript. Used when no LLM key is
 * configured or the LLM call fails (NFR-03), so voice and free-text input keep working.
 * Understands English, romanised Hindi and Devanagari. Like the LLM path, it only fills
 * what the text states; the citizen reviews every field before matching.
 */

const DEVANAGARI_DIGITS = '०१२३४५६७८९';
export const HINDI_STATES: Record<string, string> = {
  'उत्तर प्रदेश': 'Uttar Pradesh', 'मध्य प्रदेश': 'Madhya Pradesh', 'आंध्र प्रदेश': 'Andhra Pradesh',
  'हिमाचल प्रदेश': 'Himachal Pradesh', 'अरुणाचल प्रदेश': 'Arunachal Pradesh', 'पश्चिम बंगाल': 'West Bengal',
  'जम्मू कश्मीर': 'Jammu and Kashmir', 'जम्मू और कश्मीर': 'Jammu and Kashmir', 'तमिलनाडु': 'Tamil Nadu',
  'बिहार': 'Bihar', 'राजस्थान': 'Rajasthan', 'महाराष्ट्र': 'Maharashtra', 'गुजरात': 'Gujarat', 'पंजाब': 'Punjab',
  'हरियाणा': 'Haryana', 'दिल्ली': 'Delhi', 'झारखंड': 'Jharkhand', 'झारखण्ड': 'Jharkhand', 'छत्तीसगढ़': 'Chhattisgarh',
  'ओडिशा': 'Odisha', 'उड़ीसा': 'Odisha', 'केरल': 'Kerala', 'कर्नाटक': 'Karnataka', 'असम': 'Assam',
  'उत्तराखंड': 'Uttarakhand', 'उत्तराखण्ड': 'Uttarakhand', 'तेलंगाना': 'Telangana', 'गोवा': 'Goa',
  'मणिपुर': 'Manipur', 'मेघालय': 'Meghalaya', 'मिजोरम': 'Mizoram', 'नागालैंड': 'Nagaland', 'सिक्किम': 'Sikkim',
  'त्रिपुरा': 'Tripura', 'लद्दाख': 'Ladakh', 'पुडुचेरी': 'Puducherry', 'चंडीगढ़': 'Chandigarh', 'लक्षद्वीप': 'Lakshadweep',
};
const ROMAN_STATES: Record<string, string> = {
  orissa: 'Odisha', 'uttaranchal': 'Uttarakhand', pondicherry: 'Puducherry', 'j&k': 'Jammu and Kashmir',
  'jammu & kashmir': 'Jammu and Kashmir', 'bengal': 'West Bengal', 'new delhi': 'Delhi', 'u.p.': 'Uttar Pradesh',
  'chattisgarh': 'Chhattisgarh', 'tamilnadu': 'Tamil Nadu',
};

const NEG = /(?:\bnot\b|\bno\b|\bnon\b|\bnahi\b|\bnahin\b|\bnever\b|नहीं|ना)\s*(?:a\s+|an\s+|any\s+|हूँ\s+|है\s+)?$/i;

type Rule = { re: RegExp; value: string };

const OCCUPATION_RULES: Rule[] = [
  { re: /dairy|pashupalan|पशुपालन|doodh\s*wala|दूध/i, value: 'dairy_farmer' },
  { re: /\bfarm(?:er|ers|s|ing)?\b|\bkisan|किसान|kheti|खेती|खेत|agricultur|cultivat/i, value: 'farmer' },
  { re: /fisher|machhuar|मछुआ|fishing/i, value: 'fisherman' },
  { re: /construction|\bmason\b|raj\s*mistri|राजमिस्त्री|building\s+work/i, value: 'construction_worker' },
  { re: /khadi|खादी/i, value: 'khadi_artisan' },
  { re: /\bcoir\b/i, value: 'coir_worker' },
  { re: /weaver|bunkar|बुनकर|artisan|karigar|कारीगर|handloom|handicraft|spinner|embroider|chikan|zari|kadhai|कढ़ाई|pottery|potter|कुम्हार/i, value: 'artisan_weaver' },
  { re: /street\s*vendor|hawker|rehri|thela|ठेला|फेरीवाल|रेहड़ी/i, value: 'street_vendor' },
  { re: /safai\s*karamchari|सफाई\s*कर्मचारी|sanitation\s+worker/i, value: 'safai_karamchari' },
  { re: /\basha\b|anganwadi|आंगनवाड़ी|आशा\s*(?:कार्यकर्ता|worker)|health\s*worker|\bnurse\b/i, value: 'health_worker' },
  { re: /teacher|shikshak|शिक्षक|lecturer|professor|faculty/i, value: 'teacher' },
  { re: /ex[-\s]?service|veteran|fauji|पूर्व\s*सैनिक|retired\s+(?:army|soldier)/i, value: 'ex_serviceman' },
  { re: /journalist|patrakar|पत्रकार|reporter/i, value: 'journalist' },
  { re: /lawyer|vakil|वकील|advocate/i, value: 'lawyer' },
  { re: /sportsperson|athlete|khiladi|खिलाड़ी|player/i, value: 'sportsperson' },
  { re: /\bartist|kalakar|कलाकार|musician|dancer|painter/i, value: 'artist' },
  { re: /labour|labor|mazdoor|मजदूर|मज़दूर|daily\s*wage|dihadi|दिहाड़ी/i, value: 'unorganized_worker' },
];

const firstMatch = (text: string, rules: Rule[]) => {
  for (const r of rules) {
    const m = text.match(r.re);
    if (m && !NEG.test(text.slice(Math.max(0, (m.index ?? 0) - 14), m.index))) return r.value;
  }
  return undefined;
};

/** true if stated, false if negated ("not a student"), undefined if not mentioned. */
function flag(text: string, re: RegExp): boolean | undefined {
  const m = text.match(re);
  if (!m) return undefined;
  return !NEG.test(text.slice(Math.max(0, (m.index ?? 0) - 14), m.index));
}

export function extractWithRules(transcript: string): Partial<Profile> {
  const text = normaliseEnglishNumbers(normaliseHindiNumbers(transcript
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))))
    .replace(/\s+/g, ' ')
    .trim();
  const lower = text.toLowerCase();
  const raw: Record<string, unknown> = {};

  // Age: "25 years", "25 saal", "२५ वर्ष", "age is 25", "I am 25"
  const age =
    lower.match(/(\d{1,3})[\s-]*(?:years?|yrs?|y\/o|saal|sal\b|varsh|वर्ष|साल|बरस)/) ??
    lower.match(/(?:age|umar|umra|उम्र|आयु)\s*(?:is|hai|है|:|-)?\s*(\d{1,3})/) ??
    lower.match(/\bi\s*(?:am|'m)\s*(\d{1,3})\b/);
  if (age) raw.age = Number(age[1]);

  // Gender (female first: "woman" contains "man")
  // (relations like "my wife" say nothing about the speaker, so they are not used)
  if (/\b(?:woman|women|female|lady|girl|widow|housewife)\b|mahila|aurat|ladki|महिला|औरत|लड़की|विधवा|स्त्री/i.test(text)) raw.gender = 'female';
  else if (/transgender|kinnar|किन्नर|third\s+gender/i.test(text)) raw.gender = 'transgender';
  else if (/\b(?:man|male|boy|widower)\b|purush|aadmi|ladka|पुरुष|आदमी|लड़का/i.test(text)) raw.gender = 'male';

  // State
  for (const [hi, en] of Object.entries(HINDI_STATES)) if (text.includes(hi)) raw.state = en;
  if (!raw.state) {
    const names = [...STATES].sort((a, b) => b.length - a.length);
    const hit = names.find((s) => lower.includes(s.toLowerCase()));
    if (hit) raw.state = hit;
    else {
      const alias = Object.keys(ROMAN_STATES).find((a) => lower.includes(a));
      if (alias) raw.state = ROMAN_STATES[alias];
    }
  }

  // Residence
  if (/\b(?:village|rural|gaon|gaanv|gram)\b|गांव|गाँव|ग्रामीण|देहात/i.test(text)) raw.residence = 'rural';
  else if (/\b(?:city|town|urban|shahar|nagar|metro)\b|शहर|नगर/i.test(text)) raw.residence = 'urban';

  // Caste category
  if (/\bpvtg\b|particularly vulnerable/i.test(text)) raw.caste = 'pvtg';
  else if (/\bs\.?t\.?\b|scheduled tribe|adivasi|tribal|आदिवासी|अनुसूचित जनजाति|जनजाति/i.test(text)) raw.caste = 'st';
  else if (/\bs\.?c\.?\b|scheduled caste|dalit|अनुसूचित जाति|दलित/i.test(text)) raw.caste = 'sc';
  else if (/\bobc\b|backward class|pichhda|ओबीसी|पिछड़ा/i.test(text)) raw.caste = 'obc';
  else if (/\bdnt\b|de-?notified|nomadic|घुमंतू/i.test(text)) raw.caste = 'dnt';
  else if (/\bgeneral\b|samanya|सामान्य|\bews\b/i.test(text)) raw.caste = 'general';

  // Income: "income 1.5 lakh", "kamai 8000 mahina", "आय 2 लाख"
  const inc = text.match(
    /(?:income|earn(?:ing|s)?|kamai|kamaai|aamdani|salary|आय|कमाई|आमदनी|वेतन)[^.\d]{0,30}?((?:₹|rs\.?|inr)?\s*[\d,]+(?:\.\d+)?\s*(?:lakhs?|lacs?|लाख|thousand|hazaar|हज़ार|हजार|k\b)?)([^.]{0,25})/i,
  );
  if (inc) {
    const amount = inc[1].replace(/लाख/, 'lakh').replace(/hazaar|हज़ार|हजार/i, 'thousand');
    const monthly = /month|mahina|mahine|महीन|monthly|per\s*mo/i.test(inc[2]);
    const value = parseRupees(amount + (monthly ? ' per month' : ''));
    if (value !== null && value >= 1000) raw.annual_income = value;
  }

  // Occupation, student
  const occupation = firstMatch(text, OCCUPATION_RULES);
  if (occupation) raw.occupation = occupation;
  const student = flag(text, /\bstudent|studying|\bchhatra|छात्र|छात्रा|padhai|पढ़ाई|college|school\s+(?:mein|me)\s+padh/i);
  if (student !== undefined) raw.student = student;
  if (student && !raw.occupation) raw.occupation = 'student';

  // Marital status
  if (/widow|vidhwa|विधवा|विधुर/i.test(text)) raw.marital_status = 'widowed';
  else if (/divorc|talaq|तलाक/i.test(text)) raw.marital_status = 'divorced';
  else if (/separated|alag\s+rehti/i.test(text)) raw.marital_status = 'separated';
  else if (/unmarried|not\s+married|\bsingle\b(?!\s+(?:mother|father|parent))|avivahit|अविवाहित|kunwar/i.test(text)) raw.marital_status = 'never_married';
  else if (/\bmarried|shaadi\s*shuda|शादीशुदा|विवाहित|my\s+husband|my\s+wife|पति|पत्नी/i.test(text)) raw.marital_status = 'married';

  // Employment
  if (/unemployed|jobless|berozgar|बेरोजगार|no\s+job|naukri\s+nahi/i.test(text)) raw.employment_status = 'unemployed';
  else if (/self[-\s]?employed|own\s+(?:business|shop)|apna\s+(?:kaam|dhandha|business)|dukaan|दुकान|व्यापार|entrepreneur/i.test(text)) raw.employment_status = 'self_employed';
  else if (/\b(?:employed|job|naukri|service)\b|नौकरी/i.test(text) && !/looking for (?:a )?job/i.test(text)) raw.employment_status = 'employed';

  // Yes/no attributes
  const disability = flag(text, /disab|handicap|divyang|viklang|दिव्यांग|विकलांग|blind|deaf|wheelchair/i);
  if (disability !== undefined) raw.disability = disability;
  const pct = text.match(/(\d{1,3})\s*(?:%|percent|प्रतिशत)/i);
  if (pct && disability) raw.disability_percent = Number(pct[1]);
  const bpl = flag(text, /\bbpl\b|below poverty|garibi rekha|गरीबी रेखा|antyodaya|अंत्योदय/i);
  if (bpl !== undefined) raw.bpl = bpl;
  const minority = flag(text, /minority|alpsankhyak|अल्पसंख्यक|\bmuslim|\bchristian|\bsikh\b|buddhist|\bjain\b|\bparsi|मुस्लिम|ईसाई|सिख|बौद्ध|जैन|पारसी/i);
  if (minority !== undefined) raw.minority = minority;
  const gov = flag(text, /government\s+(?:employee|servant|job)|sarkari\s+naukri|सरकारी\s+(?:कर्मचारी|नौकरी)/i);
  if (gov !== undefined) raw.gov_employee = gov;
  if (gov) raw.employment_status = 'employed';

  return normaliseProfileInput(raw).values;
}
