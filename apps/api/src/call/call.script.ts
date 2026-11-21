import { LABELS, Profile } from '../domain/profile';
import { HINDI_STATES } from '../profile/rule-extractor';

/**
 * Everything the phone-call demo says. English and Hindi are written by hand; Bengali,
 * Marathi and Odia calls use the English lines translated by Sarvam (TranslateService).
 * The call asks only for what it does not know yet: the five required fields, then the
 * caller's area of interest, occupation and income (optional, asked once each).
 */

export const CALL_LANGUAGES = ['hi', 'en', 'bn', 'mr', 'od'] as const;
export type CallLanguage = (typeof CALL_LANGUAGES)[number];
/** Languages whose lines are translated from English rather than written here. */
export const TRANSLATED: CallLanguage[] = ['bn', 'mr', 'od'];
/** The language-menu key for each language (1 = Hindi … 5 = Odia). */
export const MENU_KEYS: Record<string, CallLanguage> = { '1': 'hi', '2': 'en', '3': 'bn', '4': 'mr', '5': 'od' };

/** The menu, one line per language, each spoken in its own language. */
export const MENU: { language: CallLanguage; text: string }[] = [
  { language: 'hi', text: 'हक़दार में आपका स्वागत है। हिन्दी के लिए 1 दबाएँ।' },
  { language: 'en', text: 'For English, press 2.' },
  { language: 'bn', text: 'বাংলার জন্য 3 টিপুন।' },
  { language: 'mr', text: 'मराठीसाठी 4 दाबा।' },
  { language: 'od', text: 'ଓଡ଼ିଆ ପାଇଁ 5 ଦବାନ୍ତୁ।' },
];

/** The order questions are asked in. `interest` is the help the caller is looking for. */
export const CALL_FIELDS = ['age', 'gender', 'state', 'residence', 'caste', 'interest', 'occupation', 'annual_income'] as const;
export type CallField = (typeof CALL_FIELDS)[number];
export const OPTIONAL_CALL_FIELDS: CallField[] = ['interest', 'occupation', 'annual_income'];

export const SCRIPT = {
  en: {
    greeting:
      'Namaste, this is Haqdaar. I will ask you a few short questions, then tell you which government schemes you can get. ' +
      'To begin, tell me about yourself: your age, which state you live in, and what work you do.',
    questions: {
      age: 'How old are you?',
      gender: 'Are you a man, a woman, or transgender?',
      state: 'Which state do you live in?',
      residence: 'Do you live in a village, or in a town or city?',
      caste: 'Which category do you belong to: General, OBC, SC, or ST?',
      interest: 'What kind of help do you need? For example farming, education, health, a house, a job, business, or a pension.',
      occupation: 'What work do you do? For example farming, daily-wage labour, a small shop, or are you a student?',
      annual_income: 'Roughly how much does your whole family earn in a year? You can also say it per month.',
    } satisfies Record<CallField, string>,
    acks: ['Got it.', 'Thank you.', 'Okay.'],
    nothingYet: 'No problem, let me ask one thing at a time.',
    retry: 'Sorry, I did not catch that.',
    needed: 'I need this to check your schemes.',
    summaryIntro: 'Thank you. Here is what I understood:',
    checking: 'Let me check every scheme for you.',
  },
  hi: {
    greeting:
      'नमस्ते, मैं हक़दार हूँ। मैं आपसे कुछ छोटे सवाल पूछूँगी, फिर बताऊँगी कि आपको कौन-सी सरकारी योजनाएँ मिल सकती हैं। ' +
      'शुरू करने के लिए अपने बारे में बताइए: आपकी उम्र, आप किस राज्य में रहते हैं, और आप क्या काम करते हैं।',
    questions: {
      age: 'आपकी उम्र कितनी है?',
      gender: 'आप पुरुष हैं, महिला हैं, या ट्रांसजेंडर?',
      state: 'आप किस राज्य में रहते हैं?',
      residence: 'आप गाँव में रहते हैं, या कस्बे या शहर में?',
      caste: 'आप किस वर्ग से हैं: सामान्य, ओबीसी, अनुसूचित जाति, या अनुसूचित जनजाति?',
      interest: 'आपको किस तरह की मदद चाहिए? जैसे खेती, पढ़ाई, इलाज, घर, नौकरी, व्यापार, या पेंशन।',
      occupation: 'आप क्या काम करते हैं? जैसे खेती, दिहाड़ी मज़दूरी, छोटी दुकान, या आप पढ़ाई करते हैं?',
      annual_income: 'आपके पूरे परिवार की साल भर की कमाई लगभग कितनी है? आप महीने की कमाई भी बता सकते हैं।',
    } satisfies Record<CallField, string>,
    acks: ['ठीक है।', 'धन्यवाद।', 'समझ गई।'],
    nothingYet: 'कोई बात नहीं, मैं एक-एक करके पूछती हूँ।',
    retry: 'माफ़ कीजिए, मैं समझ नहीं पाई।',
    needed: 'योजनाएँ जाँचने के लिए यह जानना ज़रूरी है।',
    summaryIntro: 'धन्यवाद। मैंने यह समझा:',
    checking: 'अब मैं हर योजना जाँचती हूँ।',
  },
};

/** The language the lines are written in for a call language. */
export const scriptLanguage = (language: CallLanguage): 'en' | 'hi' => (language === 'hi' ? 'hi' : 'en');

/** "I don't know" / "skip" in either language: an optional question is then dropped. */
export const SKIP = /\b(?:skip|pass|don'?t know|do not know|not sure|no idea|none|nothing|no income)\b|pata nahi|pata nahin|पता नहीं|नहीं पता|मालूम नहीं|छोड़ दो|छोड़िए|कुछ नहीं/i;
/** "Anything" as the area of interest: no preference. */
export const ANY = /\b(?:any|anything|all|everything|whatever)\b|kuch bhi|sab kuch|कुछ भी|सब कुछ|सभी/i;

// ---------------------------------------------------------------------------- interests

/**
 * Areas of help, each one of myscheme.gov.in's scheme categories, recognised by keywords
 * in English, romanised Hindi and Devanagari (other languages arrive translated).
 */
export const INTERESTS: { category: string; en: string; hi: string; re: RegExp }[] = [
  { category: 'Agriculture,Rural & Environment', en: 'farming', hi: 'खेती-किसानी',
    re: /farm|crop|agricultur|kheti|kisan|irrigat|seed|fertili[sz]|tractor|livestock|cattle|dairy|fish|खेती|किसान|फसल|सिंचाई|पशु/i },
  { category: 'Education & Learning', en: 'education', hi: 'पढ़ाई',
    re: /educat|stud(?:y|ies)|school|college|scholarship|padhai|shiksha|tuition|exam|पढ़ाई|शिक्षा|छात्रवृत्ति|स्कूल|कॉलेज/i },
  { category: 'Health & Wellness', en: 'health', hi: 'स्वास्थ्य',
    re: /health|hospital|treatment|medic|illness|disease|doctor|surgery|ilaj|इलाज|स्वास्थ्य|अस्पताल|बीमारी|दवा/i },
  { category: 'Housing & Shelter', en: 'housing', hi: 'घर',
    re: /\bhous(?:e|ing)\b|\bhome\b|shelter|makaan|\bghar\b|घर|मकान|आवास/i },
  { category: 'Skills & Employment', en: 'jobs and skills', hi: 'रोज़गार',
    re: /\bjobs?\b|employ(?!ed)|skill|training|naukri|rozgar|नौकरी|रोज़गार|रोजगार|प्रशिक्षण|कौशल/i },
  { category: 'Business & Entrepreneurship', en: 'business', hi: 'व्यापार',
    re: /business|\bshop\b|enterprise|start-?up|vyapar|dhandha|व्यापार|व्यवसाय|दुकान|धंधा|कारोबार/i },
  { category: 'Social welfare & Empowerment', en: 'pensions and social welfare', hi: 'पेंशन और सामाजिक सहायता',
    re: /pension|old age|widow|disab|welfare|elderly|senior citizen|पेंशन|वृद्ध|विधवा|दिव्यांग/i },
  { category: 'Women and Child', en: 'women and children', hi: 'महिला और बच्चे',
    re: /\bwom[ae]n\b|\bgirls?\b|daughter|\bchild|mother|pregnan|maternity|महिला|बेटी|बच्च|गर्भ/i },
  { category: 'Banking,Financial Services and Insurance', en: 'loans, banking and insurance', hi: 'बैंक, लोन और बीमा',
    re: /\bloans?\b|insurance|\bbank|credit|financ|\bbima\b|karz|बीमा|लोन|कर्ज|क़र्ज़|बैंक/i },
  { category: 'Utility & Sanitation', en: 'water, electricity and sanitation', hi: 'बिजली, पानी और शौचालय',
    re: /toilet|drinking water|electric|\bgas\b|cylinder|sanitation|शौचालय|बिजली|पानी|गैस/i },
  { category: 'Sports & Culture', en: 'sports and culture', hi: 'खेल और संस्कृति', re: /sport|cultur|\bart\b|music|खेल|कला/i },
  { category: 'Transport & Infrastructure', en: 'transport', hi: 'परिवहन', re: /transport|\broad|vehicle|परिवहन/i },
  { category: 'Science, IT & Communications', en: 'science and technology', hi: 'विज्ञान और तकनीक', re: /computer|internet|digital|technolog|science/i },
  { category: 'Travel & Tourism', en: 'travel and tourism', hi: 'यात्रा और पर्यटन', re: /travel|touris|pilgrim|यात्रा|पर्यटन/i },
  { category: 'Public Safety,Law & Justice', en: 'law and justice', hi: 'कानून और न्याय', re: /legal|\blaw\b|justice|court|police|कानून|न्याय/i },
];

/** An answer -> the scheme categories it asks about (at most three, in the order said). */
export function interestsFrom(text: string): string[] {
  return INTERESTS.map((i) => ({ i, at: text.search(i.re) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .slice(0, 3)
    .map((x) => x.i.category);
}

export function interestLabel(categories: string[], language: 'en' | 'hi'): string {
  const names = categories.map((c) => INTERESTS.find((i) => i.category === c)?.[language] ?? c);
  return language === 'hi' ? names.join(' और ') : names.join(' and ');
}

/** Wraps a short answer so the keyword extractor knows which field it answers. */
export function frame(field: CallField, answer: string): string {
  switch (field) {
    case 'age':
      return `${answer} years`;
    case 'annual_income':
      return `income ${answer}`;
    default:
      return answer;
  }
}

// ---------------------------------------------------------------------------- read-back

const HINDI_LABELS = {
  gender: { female: 'महिला', male: 'पुरुष', transgender: 'ट्रांसजेंडर' },
  residence: { rural: 'गाँव', urban: 'कस्बा या शहर' },
  caste: {
    general: 'सामान्य वर्ग', obc: 'ओबीसी', sc: 'अनुसूचित जाति', st: 'अनुसूचित जनजाति', pvtg: 'पीवीटीजी', dnt: 'विमुक्त या घुमंतू समुदाय',
  },
  occupation: {
    farmer: 'किसान', dairy_farmer: 'पशुपालक', fisherman: 'मछुआरा', construction_worker: 'निर्माण मज़दूर',
    unorganized_worker: 'असंगठित या दिहाड़ी मज़दूर', organized_worker: 'संगठित क्षेत्र कर्मचारी', artisan_weaver: 'कारीगर या बुनकर',
    khadi_artisan: 'खादी कारीगर', coir_worker: 'कॉयर कामगार', artist: 'कलाकार', street_vendor: 'रेहड़ी-पटरी विक्रेता',
    safai_karamchari: 'सफ़ाई कर्मचारी', health_worker: 'स्वास्थ्य कार्यकर्ता', teacher: 'शिक्षक', student: 'छात्र',
    sportsperson: 'खिलाड़ी', ex_serviceman: 'पूर्व सैनिक', journalist: 'पत्रकार', lawyer: 'वकील', other: 'अन्य काम',
  },
} as const;

const STATE_IN_HINDI: Record<string, string> = Object.fromEntries(
  Object.entries(HINDI_STATES).map(([hi, en]) => [en, hi]),
);

/** ₹ per year -> "1.5 lakh rupees" / "1.5 लाख रुपये". */
export function spokenRupees(n: number, language: 'en' | 'hi'): string {
  const round = (x: number) => String(Math.round(x * 10) / 10);
  if (language === 'hi') {
    if (n >= 100_000) return `${round(n / 100_000)} लाख रुपये`;
    if (n >= 1000) return `${round(n / 1000)} हज़ार रुपये`;
    return `${n} रुपये`;
  }
  if (n >= 100_000) return `${round(n / 100_000)} lakh rupees`;
  if (n >= 1000) return `${round(n / 1000)} thousand rupees`;
  return `${n} rupees`;
}

/** One phrase per known field, for the read-back before matching. */
export function describe(p: Partial<Profile>, language: 'en' | 'hi', interests: string[] = []): string[] {
  const out: string[] = [];
  if (language === 'hi') {
    if (p.age !== undefined) out.push(`उम्र ${p.age} साल`);
    if (p.gender) out.push(HINDI_LABELS.gender[p.gender]);
    if (p.state) out.push(`राज्य ${STATE_IN_HINDI[p.state] ?? p.state}`);
    if (p.residence) out.push(HINDI_LABELS.residence[p.residence]);
    if (p.caste) out.push(HINDI_LABELS.caste[p.caste]);
    if (interests.length) out.push(`मदद: ${interestLabel(interests, 'hi')}`);
    if (p.occupation) out.push(`काम: ${HINDI_LABELS.occupation[p.occupation]}`);
    if (p.annual_income) out.push(`परिवार की सालाना आय लगभग ${spokenRupees(p.annual_income, 'hi')}`);
    return out;
  }
  if (p.age !== undefined) out.push(`${p.age} years old`);
  if (p.gender) out.push(LABELS.gender[p.gender].toLowerCase());
  if (p.state) out.push(`from ${p.state}`);
  if (p.residence) out.push(p.residence === 'rural' ? 'living in a village' : 'living in a town or city');
  if (p.caste) out.push(`${LABELS.caste[p.caste]} category`);
  if (interests.length) out.push(`looking for help with ${interestLabel(interests, 'en')}`);
  if (p.occupation) out.push(`work: ${LABELS.occupation[p.occupation].toLowerCase()}`);
  if (p.annual_income) out.push(`family income about ${spokenRupees(p.annual_income, 'en')} a year`);
  return out;
}

/** Scheme names read better without the bracketed acronym: "PM-KISAN (...)" -> "PM-KISAN". */
export function spokenName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The results, as spoken: how many schemes fit, then the top two, from the caller's area
 * of interest when it has any (`inInterest` false means none of them is in that area).
 */
export function resultsLine(
  counts: { eligible: number; likely: number },
  top: string[],
  language: 'en' | 'hi',
  interest: { categories: string[]; inInterest: boolean } | null = null,
  onScreen = true,
): string {
  const { eligible, likely } = counts;
  const list = top.map((name, i) => `${i + 1}. ${spokenName(name)}`).join('\n');
  if (language === 'hi') {
    if (!eligible && !likely) {
      return 'अभी आपकी बताई जानकारी से कोई योजना पूरी तरह मेल नहीं खाती। आप वेबसाइट पर अपनी जानकारी जाँचकर दोबारा कोशिश कर सकते हैं।';
    }
    const head = eligible
      ? `आप ${eligible} योजनाओं के लिए पात्र हैं` + (likely ? `, और ${likely} योजनाएँ कुछ बातों की पुष्टि के बाद मिल सकती हैं।` : '।')
      : `आपकी जानकारी से ${likely} योजनाएँ मिल सकती हैं, पर कुछ बातों की पुष्टि ज़रूरी है।`;
    const label = interest ? interestLabel(interest.categories, 'hi') : '';
    const lead = !interest
      ? 'सबसे अच्छी दो योजनाएँ ये हैं:'
      : interest.inInterest
        ? `${label} के लिए सबसे अच्छी दो योजनाएँ ये हैं:`
        : `${label} की कोई योजना आप पर लागू नहीं होती, इसलिए ये सबसे अच्छी दो योजनाएँ हैं:`;
    const where = onScreen ? 'आपकी स्क्रीन पर हैं' : 'हक़दार की वेबसाइट पर देखी जा सकती हैं';
    return `${head}\n${lead}\n${list}\nसभी योजनाएँ, हर एक के कारण के साथ, ${where}। हक़दार को कॉल करने के लिए धन्यवाद।`;
  }
  if (!eligible && !likely) {
    return 'Right now no scheme fully matches what you told me. You can check your answers on the website and try again.';
  }
  const head = eligible
    ? `You qualify for ${eligible} schemes` + (likely ? `, and ${likely} more may fit once you confirm a few details.` : '.')
    : `${likely} schemes may fit, once you confirm a few details.`;
  const label = interest ? interestLabel(interest.categories, 'en') : '';
  const lead = !interest
    ? 'The two best matches are:'
    : interest.inInterest
      ? `For ${label}, the two best matches are:`
      : `I found no ${label} scheme that fits you, so here are the two best matches overall:`;
  const where = onScreen ? 'on your screen' : 'on the Haqdaar website';
  return `${head}\n${lead}\n${list}\nAll of them, with the reason for each, are ${where}. Thank you for calling Haqdaar.`;
}

/** What the voice says for a displayed line: list numbers become pauses ("1. X" -> "1, X."). */
export function speechText(line: string): string {
  return line
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const s = l.replace(/^(\d+)\.\s+/, '$1, ').replace(/:$/, '.');
      return /[.!?।,]$/.test(s) ? s : `${s}${/[ऀ-ൿ]/.test(s) ? '।' : '.'}`;
    })
    .join(' ');
}
