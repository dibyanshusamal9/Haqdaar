import { LanguageCode } from "./types";

type Bi = { dev: string; en: string };

/** Bilingual headings (always shown in both scripts). */
export const HELP_HEADS = {
  hero: { dev: "हक़दार कैसे मदद करता है", en: "How Haqdaar.ai helps" } as Bi,
  evidenceKick: "The evidence · सबूत",
  evidence: { dev: "योजनाएँ बहुत हैं। सही योजना तक पहुँच कम।", en: "Thousands of schemes. Very few people find theirs." } as Bi,
  gapKick: "The missing connection · छूटी हुई कड़ी",
  gap: { dev: "नियम कानूनी भाषा में। लोग अपनी भाषा में।", en: "A scheme's rules and a citizen's words rarely meet." } as Bi,
  leakKick: "Where people miss out · कहाँ चूक होती है",
  leak: { dev: "नुक़सान आवेदन से पहले ही शुरू हो जाता है।", en: "The loss starts before anyone applies." } as Bi,
  bridgeKick: "The Haqdaar bridge · हक़दार का समाधान",
  bridge: { dev: "फ़ॉर्म की जगह बातचीत। अनुमान की जगह नियम।", en: "A conversation instead of a form. Rules instead of guesses." } as Bi,
  walk: [
    { icon: "◐", dev: "कहा", en: "Said" },
    { icon: "अ", dev: "समझा", en: "Understood" },
    { icon: "✓", dev: "पुष्टि", en: "Confirmed" },
    { icon: "⚖", dev: "जाँचा", en: "Checked" },
    { icon: "★", dev: "समझाया", en: "Explained" },
  ],
  stepsKick: "Three steps · तीन क़दम",
  steps: { dev: "बोलिए, जाँचिए, देखिए।", en: "Speak, check, see." } as Bi,
  stepTitles: [
    { dev: "बताइए", en: "Tell us about yourself" },
    { dev: "जाँचिए", en: "Check the form" },
    { dev: "देखिए", en: "See your schemes" },
  ] as Bi[],
  faqKick: "Questions · सवाल",
  faq: { dev: "लोग जो पूछते हैं", en: "Questions people ask" } as Bi,
  sourcesKick: "Sources · स्रोत",
  sources: { dev: "हर आँकड़ा अपना स्रोत बताता है।", en: "Every figure opens its source." } as Bi,
};

export interface HelpBody {
  heroSub: string;
  cta: string;
  evidenceLead: string;
  statLabels: { title: string; detail: string }[];
  statCite: string;
  dataNote: string;
  gapLeftTitle: string;
  gapLeft: string[];
  gapRightTitle: string;
  gapRight: string[];
  bars: string[];
  barCite: string;
  leak: { title: string; body: string; loss: string }[];
  bridgeLead: string;
  walkSmall: string[];
  resultTitle: string;
  resultSub: string;
  resultRows: { mark: string; text: string }[];
  guardTitle: string;
  guardSub: string;
  guards: string[];
  steps: string[];
  faqs: { q: string; a: string }[];
  sources: { title: string; detail: string; href: string }[];
  method: string;
}

export const HELP: Record<LanguageCode, HelpBody> = {
  en: {
    heroSub: "How a few spoken sentences become a checked, explained list of the schemes you are entitled to.",
    cta: "Find my schemes",
    evidenceLead: "Central and state governments run thousands of welfare schemes. Each has its own conditions, written in its own way. These figures describe the Haqdaar.ai corpus itself: the schemes we check, and the conditions we check them against.",
    statLabels: [
      { title: "Schemes checked", detail: "Every scheme listed on myscheme.gov.in" },
      { title: "Central schemes", detail: "Open across India" },
      { title: "State & UT schemes", detail: "Spread across all 36 states and UTs" },
      { title: "Eligibility conditions", detail: "Each one evaluated for every search" },
    ],
    statCite: "Haqdaar.ai corpus, scraped from myscheme.gov.in",
    dataNote: "These counts are read live from the database the matcher uses. They describe schemes, not people: there is no reliable public count of how many citizens miss out on schemes they qualify for, so we do not invent one.",
    gapLeftTitle: "What a scheme's rules say",
    gapLeft: [
      "“Annual family income should not exceed ₹2,50,000”",
      "“Applicant must belong to a Scheduled Caste”",
      "“Age between 18 and 40 years as on the qualifying date”",
      "“Restricted to BPL card holders”",
    ],
    gapRightTitle: "What a citizen says",
    gapRight: [
      "“We earn about 80,000 a year.”",
      "“We are Dalit.”",
      "“I'm 34.”",
      "“We have a ration card.”",
    ],
    bars: [
      "Schemes limited to particular states or UTs",
      "Schemes with an age limit",
      "Schemes meant for particular occupations",
      "Schemes with an income ceiling in their rules",
    ],
    barCite: "Share of all schemes in the Haqdaar.ai corpus",
    leak: [
      { title: "Awareness", body: "Has the person ever heard of the scheme meant for them?", loss: "Discovery loss" },
      { title: "Understanding", body: "Can they read the conditions, written in legal prose?", loss: "Language loss" },
      { title: "Eligibility", body: "Can they tell whether they actually qualify?", loss: "Confidence loss" },
      { title: "Documents", body: "Do they know what to bring and where to get it?", loss: "Preparation loss" },
      { title: "Applying", body: "Do they know where and how to apply?", loss: "Access loss" },
    ],
    bridgeLead: "Haqdaar.ai keeps the order fixed so every answer can be understood and checked. Here is one example, start to finish.",
    walkSmall: [
      "“I'm a 45-year-old widow in a Bihar village…”",
      "age 45 · woman · widowed · Bihar · rural",
      "you edit anything that is wrong",
      "{n} schemes · fixed rules",
      "each match lists its reasons",
    ],
    resultTitle: "What every result shows",
    resultSub: "So you can act on it straight away.",
    resultRows: [
      { mark: "✓", text: "The conditions you meet, in your own terms" },
      { mark: "?", text: "Anything still to confirm, such as an income limit" },
      { mark: "↗", text: "A link to the official scheme page to apply" },
    ],
    guardTitle: "Guardrails",
    guardSub: "What keeps an answer trustworthy.",
    guards: [
      "✓ The language model only fills in the form",
      "✓ The same answers always give the same list",
      "✓ An unclear condition asks you to check; it never rules you out",
      "✓ Every match is logged with the data version, so it can be replayed",
    ],
    steps: [
      "Tap the microphone and speak, or type a few sentences: your age, state, village or town, social category, work and your family's yearly income.",
      "Fields filled from your words are highlighted. Correct anything that is wrong and fill in what is missing. Age, gender, state, area and category are required.",
      "Press “Find my schemes”. Each result shows why it matched. Filter by central or state and by category, then open the official page to apply.",
    ],
    faqs: [
      { q: "Does the AI decide whether I'm eligible?", a: "No. The AI (Sarvam AI for speech, Llama 3 for understanding) only fills in the form. Eligibility is decided by fixed rules stored in a database. The same answers always give the same list, and every result shows the conditions it was based on." },
      { q: "Which languages can I speak in?", a: "Hindi, English, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil or Telugu. Choose the language under the microphone. The website itself is in English and Hindi." },
      { q: "What happens to my voice recording?", a: "It is sent to Sarvam AI only to turn it into text, and we do not save it. We do not save the text either. For every search we keep only the form fields used for matching (no name, phone number or ID), so results can be audited." },
      { q: "What do “Eligible” and “Check one detail” mean?", a: "“Eligible” means you meet every condition we can check for that scheme. “Check one detail” means nothing rules you out, but one condition couldn't be decided: maybe you left a field blank (often income), or the condition comes from the scheme's text and needs your confirmation." },
      { q: "Why is a scheme I know about missing?", a: "Usually one of your answers rules it out: a different state, an age limit, a category, or a requirement such as being a student or having a BPL card. Open the scheme from “Browse schemes” to see exactly which conditions Haqdaar.ai checks." },
      { q: "Is the result final?", a: "No. Haqdaar.ai is for information only. The authority that runs the scheme makes the final decision. Use the official link on each result to apply." },
      { q: "Can I check schemes for someone in my family?", a: "Yes. Enter that person's details: their age, their occupation, and so on. Many schemes are for children, students or elderly parents." },
      { q: "The microphone doesn't work.", a: "Your browser may have blocked microphone access. Allow it from the address bar, or simply type in the box next to the microphone. Typing works exactly the same way." },
    ],
    sources: [
      { title: "myscheme.gov.in", detail: "National scheme portal: the source of every scheme and its eligibility tags", href: "https://www.myscheme.gov.in" },
      { title: "Sarvam AI", detail: "Speech-to-text for Indian languages", href: "https://www.sarvam.ai" },
      { title: "Groq · Llama 3", detail: "Turns words into form fields; never decides eligibility", href: "https://groq.com" },
      { title: "PostgreSQL JSONB", detail: "Where each scheme's rules are stored and evaluated", href: "https://www.postgresql.org/docs/current/datatype-json.html" },
    ],
    method: "Method note: figures on this page are computed from the live Haqdaar.ai database at the moment you open it. Scheme data is collected from myscheme.gov.in by a polite batch scraper and refreshed on a schedule; conditions come from the portal's own eligibility tags and, for income limits, from the published eligibility text.",
  },
  hi: {
    heroSub: "कैसे कुछ बोले गए वाक्य उन योजनाओं की जाँची और समझाई गई सूची बनते हैं, जिनके आप हक़दार हैं।",
    cta: "मेरी योजनाएँ खोजें",
    evidenceLead: "केंद्र और राज्य सरकारें हज़ारों कल्याण योजनाएँ चलाती हैं। हर योजना की अपनी शर्तें हैं, अपने ढंग से लिखी हुई। ये आँकड़े हक़दार.ai के डेटा के हैं: वे योजनाएँ जिन्हें हम जाँचते हैं, और वे शर्तें जिन पर जाँचते हैं।",
    statLabels: [
      { title: "जाँची जाने वाली योजनाएँ", detail: "myscheme.gov.in पर दर्ज हर योजना" },
      { title: "केंद्रीय योजनाएँ", detail: "पूरे भारत के लिए" },
      { title: "राज्य व केंद्रशासित प्रदेश की योजनाएँ", detail: "सभी 36 राज्यों और केंद्रशासित प्रदेशों में" },
      { title: "पात्रता शर्तें", detail: "हर खोज में हर एक जाँची जाती है" },
    ],
    statCite: "हक़दार.ai डेटा, myscheme.gov.in से जुटाया गया",
    dataNote: "ये गिनतियाँ उसी डेटाबेस से सीधे पढ़ी जाती हैं जिसे मिलान करने वाला सिस्टम इस्तेमाल करता है। ये योजनाओं के बारे में हैं, लोगों के बारे में नहीं: कितने नागरिक अपनी योजनाओं से चूक जाते हैं, इसकी कोई भरोसेमंद सार्वजनिक गिनती नहीं है, इसलिए हम कोई संख्या गढ़ते नहीं।",
    gapLeftTitle: "योजना के नियम क्या कहते हैं",
    gapLeft: [
      "“परिवार की वार्षिक आय ₹2,50,000 से अधिक नहीं होनी चाहिए”",
      "“आवेदक अनुसूचित जाति से होना चाहिए”",
      "“निर्धारित तिथि पर आयु 18 से 40 वर्ष के बीच”",
      "“केवल BPL कार्ड धारकों के लिए”",
    ],
    gapRightTitle: "नागरिक क्या कहते हैं",
    gapRight: [
      "“हम साल में लगभग 80,000 कमाते हैं।”",
      "“हम दलित हैं।”",
      "“मेरी उम्र 34 है।”",
      "“हमारे पास राशन कार्ड है।”",
    ],
    bars: [
      "कुछ ख़ास राज्यों या केंद्रशासित प्रदेशों तक सीमित योजनाएँ",
      "उम्र की सीमा वाली योजनाएँ",
      "कुछ ख़ास कामों के लिए बनी योजनाएँ",
      "नियमों में आय की सीमा वाली योजनाएँ",
    ],
    barCite: "हक़दार.ai डेटा की सभी योजनाओं में हिस्सा",
    leak: [
      { title: "जानकारी", body: "क्या व्यक्ति ने अपने लिए बनी योजना के बारे में कभी सुना है?", loss: "खोज में चूक" },
      { title: "समझ", body: "क्या वे कानूनी भाषा में लिखी शर्तें पढ़ पाते हैं?", loss: "भाषा में चूक" },
      { title: "पात्रता", body: "क्या वे बता पाते हैं कि वे सच में पात्र हैं?", loss: "भरोसे में चूक" },
      { title: "दस्तावेज़", body: "क्या उन्हें पता है कि क्या लाना है और कहाँ से?", loss: "तैयारी में चूक" },
      { title: "आवेदन", body: "क्या उन्हें पता है कि कहाँ और कैसे आवेदन करें?", loss: "पहुँच में चूक" },
    ],
    bridgeLead: "हक़दार.ai क्रम तय रखता है ताकि हर जवाब समझा और जाँचा जा सके। यहाँ शुरू से अंत तक एक उदाहरण है।",
    walkSmall: [
      "“मैं बिहार के गाँव की 45 साल की विधवा हूँ…”",
      "उम्र 45 · महिला · विधवा · बिहार · ग्रामीण",
      "जो ग़लत हो, आप बदल दें",
      "{n} योजनाएँ · तय नियम",
      "हर मिलान अपने कारण बताता है",
    ],
    resultTitle: "हर नतीजा क्या दिखाता है",
    resultSub: "ताकि आप तुरंत आगे बढ़ सकें।",
    resultRows: [
      { mark: "✓", text: "आप कौन-सी शर्तें पूरी करते हैं, आपके अपने शब्दों में" },
      { mark: "?", text: "क्या अभी जाँचना बाक़ी है, जैसे आय की सीमा" },
      { mark: "↗", text: "आवेदन के लिए योजना के आधिकारिक पेज का लिंक" },
    ],
    guardTitle: "सुरक्षा",
    guardSub: "जो जवाब को भरोसेमंद बनाती है।",
    guards: [
      "✓ भाषा मॉडल सिर्फ़ फ़ॉर्म भरता है",
      "✓ एक जैसे जवाब हमेशा एक जैसी सूची देते हैं",
      "✓ अस्पष्ट शर्त आपसे जाँचने को कहती है; आपको बाहर नहीं करती",
      "✓ हर मिलान डेटा संस्करण के साथ दर्ज होता है, ताकि उसे दोहराया जा सके",
    ],
    steps: [
      "माइक दबाकर बोलिए, या कुछ वाक्य लिखिए: आपकी उम्र, राज्य, गाँव या शहर, सामाजिक वर्ग, काम और परिवार की सालाना आय।",
      "आपकी बात से भरे गए खाने हाइलाइट होते हैं। जो ग़लत हो उसे ठीक कीजिए और जो छूटा हो उसे भरिए। उम्र, लिंग, राज्य, क्षेत्र और वर्ग ज़रूरी हैं।",
      "“मेरी योजनाएँ खोजें” दबाइए। हर नतीजे के साथ उसका कारण दिखता है। केंद्रीय या राज्य और श्रेणी से छाँटिए, फिर आवेदन के लिए आधिकारिक पेज खोलिए।",
    ],
    faqs: [
      { q: "क्या AI तय करता है कि मैं पात्र हूँ या नहीं?", a: "नहीं। AI (आवाज़ के लिए Sarvam AI, समझने के लिए Llama 3) सिर्फ़ फ़ॉर्म भरता है। पात्रता डेटाबेस में रखे तय नियमों से तय होती है। एक जैसे जवाब हमेशा एक जैसी सूची देते हैं, और हर नतीजा बताता है कि वह किन शर्तों पर आधारित है।" },
      { q: "मैं किन भाषाओं में बोल सकता/सकती हूँ?", a: "हिन्दी, अंग्रेज़ी, बांग्ला, गुजराती, कन्नड़, मलयालम, मराठी, ओड़िया, पंजाबी, तमिल या तेलुगु। माइक के नीचे भाषा चुनिए। वेबसाइट अंग्रेज़ी और हिन्दी में है।" },
      { q: "मेरी आवाज़ की रिकॉर्डिंग का क्या होता है?", a: "उसे सिर्फ़ लिखे शब्दों में बदलने के लिए Sarvam AI को भेजा जाता है, और हम उसे सहेजते नहीं। उसका लिखित रूप भी नहीं रखते। हर खोज के लिए हम सिर्फ़ मिलान वाले खाने रखते हैं (न नाम, न फ़ोन नंबर, न पहचान पत्र), ताकि नतीजों की जाँच हो सके।" },
      { q: "“पात्र” और “एक बात जाँचें” का क्या मतलब है?", a: "“पात्र” का मतलब है कि आप उस योजना की हर वह शर्त पूरी करते हैं जो हम जाँच सकते हैं। “एक बात जाँचें” का मतलब है कि कोई शर्त आपको बाहर नहीं करती, पर एक शर्त तय नहीं हो सकी: शायद आपने कोई खाना ख़ाली छोड़ा (अक्सर आय), या शर्त योजना के पाठ से ली गई है और आपकी पुष्टि चाहती है।" },
      { q: "जो योजना मुझे पता है, वह क्यों नहीं दिखी?", a: "आमतौर पर आपका कोई जवाब उसे बाहर कर देता है: अलग राज्य, उम्र की सीमा, वर्ग, या कोई ज़रूरत जैसे छात्र होना या BPL कार्ड होना। “सभी योजनाएँ” से वह योजना खोलकर देखिए कि हक़दार.ai कौन-सी शर्तें जाँचता है।" },
      { q: "क्या नतीजा अंतिम है?", a: "नहीं। हक़दार.ai सिर्फ़ जानकारी के लिए है। अंतिम फ़ैसला योजना चलाने वाला प्राधिकरण करता है। आवेदन के लिए हर नतीजे पर दिया आधिकारिक लिंक इस्तेमाल करें।" },
      { q: "क्या मैं परिवार के किसी सदस्य के लिए योजनाएँ देख सकता/सकती हूँ?", a: "हाँ। उस व्यक्ति की जानकारी भरिए: उनकी उम्र, उनका काम वग़ैरह। कई योजनाएँ बच्चों, छात्रों या बुज़ुर्ग माता-पिता के लिए हैं।" },
      { q: "माइक्रोफ़ोन काम नहीं कर रहा।", a: "हो सकता है ब्राउज़र ने माइक की अनुमति रोकी हो। पता-पट्टी से अनुमति दीजिए, या माइक के बगल वाले बॉक्स में लिख दीजिए। लिखकर भी बिल्कुल वैसे ही काम होता है।" },
    ],
    sources: [
      { title: "myscheme.gov.in", detail: "राष्ट्रीय योजना पोर्टल: हर योजना और उसके पात्रता टैग का स्रोत", href: "https://www.myscheme.gov.in" },
      { title: "Sarvam AI", detail: "भारतीय भाषाओं में आवाज़ से लिखित", href: "https://www.sarvam.ai" },
      { title: "Groq · Llama 3", detail: "शब्दों से फ़ॉर्म के खाने भरता है; पात्रता तय नहीं करता", href: "https://groq.com" },
      { title: "PostgreSQL JSONB", detail: "जहाँ हर योजना के नियम रखे और जाँचे जाते हैं", href: "https://www.postgresql.org/docs/current/datatype-json.html" },
    ],
    method: "तरीक़े की टिप्पणी: इस पेज के आँकड़े पेज खोलते ही हक़दार.ai के डेटाबेस से निकाले जाते हैं। योजनाओं का डेटा myscheme.gov.in से एक संयमित बैच स्क्रेपर जुटाता है और तय समय पर ताज़ा करता है; शर्तें पोर्टल के अपने पात्रता टैग से, और आय की सीमा प्रकाशित पात्रता पाठ से ली जाती हैं।",
  },
};
