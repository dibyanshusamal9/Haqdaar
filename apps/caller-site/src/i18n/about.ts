import { LanguageCode } from "./types";

/** Headings are always bilingual (Devanagari over English), as on the original pages. */
type Bi = { dev: string; en: string };

export const ABOUT_HEADS = {
  hero: { dev: "हक़दार के बारे में", en: "About Haqdaar.ai" } as Bi,
  introKick: "About Haqdaar.ai · हक़दार के बारे में",
  intro: { dev: "हक़ हमेशा आपका था।", en: "What's yours was always yours." } as Bi,
  features: [
    { dev: "यह सुनता है", en: "It listens" },
    { dev: "यह जाँचता है", en: "It checks" },
    { dev: "यह समझाता है", en: "It explains" },
  ] as Bi[],
  gapKick: "Why we built it · क्यों बनाया",
  gap: { dev: "पोर्टल खोजते हैं। चैटबॉट अनुमान लगाते हैं।", en: "Portals search. Chatbots guess. Neither tells you what's yours." } as Bi,
  builtKick: "How it is built · यह कैसे बना है",
  built: { dev: "AI फ़ॉर्म भरता है। नियम फ़ैसला करते हैं।", en: "AI fills in the form. Fixed rules decide." } as Bi,
  flow: [
    { icon: "◐", dev: "बोलिए या लिखिए", en: "Speak or type" },
    { icon: "अ", dev: "लिखित रूप", en: "Transcribe" },
    { icon: "◇", dev: "फ़ॉर्म भरना", en: "Fill the form" },
    { icon: "✓", dev: "आप जाँचें", en: "You confirm" },
    { icon: "⚖", dev: "तय नियम", en: "Fixed rules" },
    { icon: "★", dev: "आपकी योजनाएँ", en: "Your schemes" },
  ],
  mvKick: "Our direction · हमारा संकल्प",
  mv: { dev: "हमारा ध्येय और दृष्टि", en: "Mission & Vision" } as Bi,
  mission: { dev: "हमारा ध्येय", en: "Our Mission" } as Bi,
  vision: { dev: "हमारी दृष्टि", en: "Our Vision" } as Bi,
  teamKick: "The team · टीम",
  team: { dev: "किसने बनाया", en: "Who built it" } as Bi,
};

export interface AboutBody {
  heroSub: string;
  cta: string;
  lead: string;
  body: string;
  features: string[];
  gapLeftTitle: string;
  gapLeft: string[];
  gapRightTitle: string;
  gapRight: string[];
  builtLead: string;
  flowSmall: string[];
  promiseTitle: string;
  promiseSub: string;
  promises: string[];
  notTitle: string;
  notSub: string;
  nots: string[];
  mvLead: string;
  mission: string;
  vision: string;
  teamIntro: string;
  dataTitle: string;
  data: string;
}

export const ABOUT: Record<LanguageCode, AboutBody> = {
  en: {
    heroSub: "Speak or type your situation once. See every scheme you qualify for, and why.",
    cta: "Find my schemes",
    lead: "Thousands of welfare schemes exist across central and state governments. Their eligibility rules are written in dense legal prose, and one person can qualify for dozens of them without ever hearing of one.",
    body: "Haqdaar (हक़दार) means “one who is rightfully entitled”. Haqdaar.ai lets a citizen describe their life by voice or in a few typed words, shows them exactly what it understood, and checks those answers against every scheme on myscheme.gov.in using fixed, published rules. No legal prose to decode, no guesswork, and a reason for every result.",
    features: [
      "Speak in any of 11 Indian languages, or type a few sentences. Sarvam AI turns speech into text; nobody is asked to fill a long form first.",
      "Each scheme's conditions are stored as rules in a database. Your answers are compared with all of them at once: the same answers always give the same list.",
      "Every scheme comes with the conditions you meet, anything you still need to confirm, and a link to the official page to apply.",
    ],
    gapLeftTitle: "What exists today",
    gapLeft: [
      "Portals that search by keyword, so you must already know what to look for",
      "Chatbots that can wrongly say “you are not eligible”",
      "Typed forms that leave out people who find typing hard",
      "Rules written in legal language, spread across PDFs",
    ],
    gapRightTitle: "What Haqdaar.ai does",
    gapRight: [
      "Matches you against every scheme, not a keyword",
      "Fixed rules decide; nothing is invented",
      "Speak in your language, then check the form",
      "Every result says why, in plain words",
    ],
    builtLead: "The language model has exactly one job: turning what you said into form fields that you can see and correct. Eligibility itself is a database query, so it can be tested, explained and repeated.",
    flowSmall: ["Web · 11 languages", "Sarvam AI", "Llama 3 · checked fields", "Edit any field", "PostgreSQL · JSONB", "Reasons + official links"],
    promiseTitle: "What we promise",
    promiseSub: "The guardrails behind every answer.",
    promises: [
      "✓ The AI never decides eligibility",
      "✓ The same answers always give the same list",
      "✓ Every result shows the conditions behind it",
      "✓ Unclear conditions ask you to check instead of ruling you out",
      "✓ No name, phone number, ID, audio or transcript is stored",
    ],
    notTitle: "What Haqdaar.ai is not",
    notSub: "So nobody relies on it for the wrong thing.",
    nots: [
      "✗ Not a government service, and not affiliated with one",
      "✗ It does not submit applications on your behalf",
      "✗ Its results are information, not a legal decision",
    ],
    mvLead: "A clear purpose for every search, and a future where no entitlement goes unclaimed because the rules were hard to read.",
    mission: "To make every citizen's welfare entitlements discoverable in their own words: listen in their language, check every central and state scheme against fixed, published rules, and explain each result plainly, without asking anyone to read legal prose or trust a black box.",
    vision: "A country where nobody misses a benefit meant for them because the rules were hard to find or understand. Finding what you are entitled to should be as easy as describing your life, and every answer should be one you can check.",
    teamIntro: "Haqdaar.ai is built for SatHack 2026 by a student team from Thapar Institute of Engineering and Technology, Patiala.",
    dataTitle: "Data and disclaimer",
    data: "Scheme information comes from myscheme.gov.in, the Government of India's national scheme portal, and is refreshed on a schedule. Haqdaar.ai is an independent student project and is not affiliated with or endorsed by the Government of India. Results are for information only; the authority running each scheme makes the final decision.",
  },
  hi: {
    heroSub: "अपनी स्थिति एक बार बोलिए या लिखिए। देखिए आप किन योजनाओं के पात्र हैं, और क्यों।",
    cta: "मेरी योजनाएँ खोजें",
    lead: "केंद्र और राज्य सरकारों की हज़ारों कल्याण योजनाएँ हैं। उनकी पात्रता शर्तें भारी कानूनी भाषा में लिखी होती हैं, और एक व्यक्ति दर्जनों योजनाओं का पात्र होकर भी किसी के बारे में नहीं सुन पाता।",
    body: "हक़दार का मतलब है “जिसका जायज़ हक़ हो”। हक़दार.ai में नागरिक बोलकर या कुछ शब्द लिखकर अपने बारे में बताते हैं, हम दिखाते हैं कि हमने ठीक-ठीक क्या समझा, और तय, प्रकाशित नियमों से उन जवाबों को myscheme.gov.in की हर योजना से मिलाते हैं। न कानूनी भाषा समझनी पड़ती है, न अंदाज़ा लगाना पड़ता है, और हर नतीजे के साथ उसका कारण होता है।",
    features: [
      "11 भारतीय भाषाओं में से किसी में बोलिए, या कुछ वाक्य लिखिए। Sarvam AI आवाज़ को लिखे शब्दों में बदलता है; किसी से पहले लंबा फ़ॉर्म नहीं भरवाया जाता।",
      "हर योजना की शर्तें डेटाबेस में नियमों के रूप में रखी हैं। आपके जवाब एक साथ सब से मिलाए जाते हैं: एक जैसे जवाब हमेशा एक जैसी सूची देते हैं।",
      "हर योजना के साथ दिखता है कि आप कौन-सी शर्तें पूरी करते हैं, क्या जाँचना बाक़ी है, और आवेदन के लिए आधिकारिक पेज का लिंक।",
    ],
    gapLeftTitle: "आज क्या उपलब्ध है",
    gapLeft: [
      "शब्दों से खोजने वाले पोर्टल, यानी आपको पहले से पता होना चाहिए कि क्या ढूँढना है",
      "चैटबॉट जो ग़लती से कह सकते हैं कि “आप पात्र नहीं हैं”",
      "लिखकर भरने वाले फ़ॉर्म, जिनसे लिखने में दिक़्क़त वाले लोग छूट जाते हैं",
      "कानूनी भाषा में लिखे नियम, कई PDF में बिखरे हुए",
    ],
    gapRightTitle: "हक़दार.ai क्या करता है",
    gapRight: [
      "किसी एक शब्द से नहीं, हर योजना से आपका मिलान करता है",
      "तय नियम फ़ैसला करते हैं; कुछ भी मनगढ़ंत नहीं",
      "अपनी भाषा में बोलिए, फिर फ़ॉर्म जाँचिए",
      "हर नतीजा आसान शब्दों में बताता है कि क्यों",
    ],
    builtLead: "भाषा मॉडल का सिर्फ़ एक काम है: आपकी बात को फ़ॉर्म के उन खानों में बदलना जिन्हें आप देख और सुधार सकें। पात्रता अपने आप में एक डेटाबेस क्वेरी है, इसलिए उसे जाँचा, समझाया और दोहराया जा सकता है।",
    flowSmall: ["वेब · 11 भाषाएँ", "Sarvam AI", "Llama 3 · जाँचे गए खाने", "कोई भी खाना बदलें", "PostgreSQL · JSONB", "कारण + आधिकारिक लिंक"],
    promiseTitle: "हमारा वादा",
    promiseSub: "हर जवाब के पीछे की सुरक्षा।",
    promises: [
      "✓ पात्रता का फ़ैसला AI कभी नहीं करता",
      "✓ एक जैसे जवाब हमेशा एक जैसी सूची देते हैं",
      "✓ हर नतीजा अपनी शर्तें दिखाता है",
      "✓ अस्पष्ट शर्तें आपको बाहर करने के बजाय जाँचने को कहती हैं",
      "✓ न नाम, न फ़ोन नंबर, न पहचान पत्र, न आवाज़, न उसका लिखित रूप रखा जाता है",
    ],
    notTitle: "हक़दार.ai क्या नहीं है",
    notSub: "ताकि कोई ग़लत चीज़ के लिए इस पर निर्भर न रहे।",
    nots: [
      "✗ यह सरकारी सेवा नहीं है, न किसी से जुड़ी है",
      "✗ यह आपकी ओर से आवेदन जमा नहीं करता",
      "✗ इसके नतीजे जानकारी हैं, कानूनी फ़ैसला नहीं",
    ],
    mvLead: "हर खोज के लिए एक साफ़ मक़सद, और एक ऐसा भविष्य जहाँ कोई हक़ इसलिए न छूटे कि नियम पढ़ने में मुश्किल थे।",
    mission: "हर नागरिक के कल्याण संबंधी हक़ उसकी अपनी भाषा में खोजने योग्य बनाना: उनकी भाषा में सुनना, केंद्र और राज्य की हर योजना को तय, प्रकाशित नियमों से जाँचना, और हर नतीजे को आसान शब्दों में समझाना, बिना किसी से कानूनी भाषा पढ़वाए या किसी अनदेखी व्यवस्था पर भरोसा करवाए।",
    vision: "एक ऐसा देश जहाँ कोई भी अपने लिए बनी योजना इसलिए न खोए कि नियम ढूँढना या समझना मुश्किल था। अपना हक़ जानना उतना ही आसान हो जितना अपने जीवन के बारे में बताना, और हर जवाब ऐसा हो जिसे आप जाँच सकें।",
    teamIntro: "हक़दार.ai को SatHack 2026 के लिए थापर इंस्टीट्यूट ऑफ़ इंजीनियरिंग एंड टेक्नोलॉजी, पटियाला के छात्रों की एक टीम ने बनाया है।",
    dataTitle: "डेटा और अस्वीकरण",
    data: "योजनाओं की जानकारी भारत सरकार के राष्ट्रीय योजना पोर्टल myscheme.gov.in से ली जाती है और तय समय पर ताज़ा की जाती है। हक़दार.ai एक स्वतंत्र छात्र परियोजना है और इसका भारत सरकार से कोई संबंध या समर्थन नहीं है। नतीजे केवल जानकारी के लिए हैं; हर योजना का अंतिम फ़ैसला उसे चलाने वाला प्राधिकरण करता है।",
  },
};

export const TEAM = ["Apurv", "Dibyanshu Samal", "Shiven Bansal", "Somraj Singha"];
