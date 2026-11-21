import { ProfileDraft, EMPTY_DRAFT } from "@/api/haqdaar";
import { LanguageCode } from "./types";

/**
 * Illustrative example profiles (not real people). Each opens the checker pre-filled,
 * and its card shows schemes the matcher actually returned for it.
 */
export interface Example {
  id: string;
  /** illustration in /public/assets/illustrations/example-<id>.jpg */
  name: Record<LanguageCode, string>;
  summary: Record<LanguageCode, string>;
  /** what they might say: Hindi first, then English, as on the story cards */
  saidHi: string;
  saidEn: string;
  explain: Record<LanguageCode, string>;
  facts: Record<LanguageCode, string[]>;
  /** schemes the matcher returned for this profile (corpus v3, October 2026) */
  matches: string[];
  draft: ProfileDraft;
}

export const EXAMPLES: Example[] = [
  {
    id: "widow-farmer-bihar",
    name: { en: "Sunita · 45 · Bihar", hi: "सुनीता · 45 · बिहार" },
    summary: {
      en: "Widowed agricultural worker in a village, SC household with a BPL card.",
      hi: "गाँव में रहने वाली विधवा खेतिहर मज़दूर, SC परिवार, BPL कार्ड।",
    },
    saidHi: "“मैं बिहार के एक गाँव की 45 साल की विधवा हूँ। खेतों में काम करती हूँ, BPL कार्ड है।”",
    saidEn: "“I'm a 45-year-old widow in a Bihar village. I work on farms, and we have a BPL card.”",
    explain: {
      en: "Haqdaar.ai heard a widow, a BPL household and farm work, and checked them against every central and Bihar scheme at once. Pensions for widows lead, followed by state support for farm families.",
      hi: "हक़दार.ai ने एक विधवा, BPL परिवार और खेती का काम सुना, और उन्हें केंद्र और बिहार की हर योजना से एक साथ मिलाया। सबसे ऊपर विधवा पेंशन है, फिर खेतिहर परिवारों के लिए राज्य की मदद।",
    },
    facts: { en: ["Widowed · 45", "SC · BPL card"], hi: ["विधवा · 45", "SC · BPL कार्ड"] },
    matches: ["Indira Gandhi National Widow Pension Scheme"],
    draft: { ...EMPTY_DRAFT, age: "45", gender: "female", marital_status: "widowed", state: "Bihar", residence: "rural", caste: "sc", annual_income: "80000", occupation: "farmer", bpl: true },
  },
  {
    id: "student-kerala",
    name: { en: "Arjun · 19 · Kerala", hi: "अर्जुन · 19 · केरल" },
    summary: {
      en: "First-year college student from an OBC family in a town.",
      hi: "कस्बे में रहने वाला OBC परिवार का कॉलेज के पहले साल का छात्र।",
    },
    saidHi: "“मैं 19 साल का हूँ, कोच्चि में पढ़ता हूँ। OBC वर्ग, परिवार की आय 1.8 लाख है।”",
    saidEn: "“I'm 19 and study in Kochi. We're OBC, and my family earns 1.8 lakh a year.”",
    explain: {
      en: "A student from a family under common income limits: scholarships whose ceilings he meets come first, each showing the limit it checked.",
      hi: "आम आय सीमा के भीतर वाले परिवार का छात्र: वे छात्रवृत्तियाँ सबसे पहले आती हैं जिनकी सीमा वह पूरी करता है, और हर एक बताती है कि उसने कौन-सी सीमा जाँची।",
    },
    facts: { en: ["Student · 19", "OBC · ₹1.8 lakh"], hi: ["छात्र · 19", "OBC · ₹1.8 लाख"] },
    matches: ["PM-USP scholarship for college and university students"],
    draft: { ...EMPTY_DRAFT, age: "19", gender: "male", marital_status: "never_married", state: "Kerala", residence: "urban", caste: "obc", annual_income: "180000", occupation: "student", student: true },
  },
  {
    id: "senior-farmer-rajasthan",
    name: { en: "Ramesh · 67 · Rajasthan", hi: "रमेश · 67 · राजस्थान" },
    summary: {
      en: "Older small farmer in a village, general category, low income.",
      hi: "गाँव के बुज़ुर्ग छोटे किसान, सामान्य वर्ग, कम आय।",
    },
    saidHi: "“मैं 67 साल का हूँ, राजस्थान के गाँव में किसान हूँ, सामान्य वर्ग, आय 60,000।”",
    saidEn: "“I'm 67, a farmer in a Rajasthan village, general category, earning 60,000 a year.”",
    explain: {
      en: "Over 55, a small farmer, in a Rajasthan village: the state's pension for older farmers tops the list, followed by central farm schemes open to him.",
      hi: "55 से ऊपर, छोटे किसान, राजस्थान के गाँव में: राज्य की बुज़ुर्ग किसानों की पेंशन सबसे ऊपर है, फिर खेती की केंद्रीय योजनाएँ जो उनके लिए खुली हैं।",
    },
    facts: { en: ["Farmer · 67", "Rural · ₹60,000"], hi: ["किसान · 67", "ग्रामीण · ₹60,000"] },
    matches: ["Chief Minister Small and Marginal Farmers Older Pension Scheme"],
    draft: { ...EMPTY_DRAFT, age: "67", gender: "male", marital_status: "married", state: "Rajasthan", residence: "rural", caste: "general", annual_income: "60000", occupation: "farmer" },
  },
  {
    id: "artisan-up",
    name: { en: "Fatima · 32 · Uttar Pradesh", hi: "फ़ातिमा · 32 · उत्तर प्रदेश" },
    summary: {
      en: "Self-employed chikankari artisan in Lucknow, from a minority community.",
      hi: "लखनऊ की अपना काम करने वाली चिकनकारी कारीगर, अल्पसंख्यक समुदाय से।",
    },
    saidHi: "“मैं 32 साल की हूँ, लखनऊ में घर से चिकनकारी करती हूँ। मैं मुस्लिम हूँ।”",
    saidEn: "“I'm 32 and do chikankari embroidery from home in Lucknow. I'm Muslim.”",
    explain: {
      en: "A self-employed craftswoman from a notified minority: business loans for minorities and support for artisans match both her work and her community.",
      hi: "अधिसूचित अल्पसंख्यक समुदाय की अपना काम करने वाली कारीगर: अल्पसंख्यकों के व्यापार ऋण और कारीगरों की मदद, दोनों उसके काम और समुदाय से मेल खाते हैं।",
    },
    facts: { en: ["Artisan · self-employed", "Minority · ₹1.2 lakh"], hi: ["कारीगर · अपना काम", "अल्पसंख्यक · ₹1.2 लाख"] },
    matches: ["Term Loan Scheme of NMDFC"],
    draft: { ...EMPTY_DRAFT, age: "32", gender: "female", marital_status: "married", state: "Uttar Pradesh", residence: "urban", caste: "general", annual_income: "120000", occupation: "artisan_weaver", employment_status: "self_employed", minority: true },
  },
  {
    id: "disability-maharashtra",
    name: { en: "Kavita · 28 · Maharashtra", hi: "कविता · 28 · महाराष्ट्र" },
    summary: {
      en: "Job-seeker from a Scheduled Tribe with a 60% locomotor disability.",
      hi: "60% चलने-फिरने की दिव्यांगता वाली अनुसूचित जनजाति की नौकरी तलाश रही युवती।",
    },
    saidHi: "“मैं 28 साल की हूँ, नासिक से। ST वर्ग। मुझे 60% दिव्यांगता है और मैं काम ढूँढ रही हूँ।”",
    saidEn: "“I'm 28, from Nashik. ST category. I have a 60% disability and I'm looking for work.”",
    explain: {
      en: "A disability above the common 40% threshold and looking for work: skilling and self-employment support for persons with disabilities come first.",
      hi: "आम 40% सीमा से ज़्यादा दिव्यांगता और काम की तलाश: दिव्यांग व्यक्तियों के लिए कौशल और स्वरोज़गार की मदद सबसे पहले आती है।",
    },
    facts: { en: ["Disability 60%", "ST · seeking work"], hi: ["दिव्यांगता 60%", "ST · काम की तलाश"] },
    matches: ["Divyangjan Kaushal Yojana"],
    draft: { ...EMPTY_DRAFT, age: "28", gender: "female", marital_status: "never_married", state: "Maharashtra", residence: "urban", caste: "st", employment_status: "unemployed", disability: true, disability_percent: "60" },
  },
];

export const EXAMPLES_HEADS = {
  hero: { dev: "सफलता की कहानियाँ", en: "Success Stories" },
  kick: "Success stories · सफलता की कहानियाँ",
  title: { dev: "एक सही मिलान ऐसा दिखता है।", en: "What a match looks like." },
};

export const EXAMPLES_COPY: Record<LanguageCode, { heroSub: string; cta: string; intro: string; note: string; try: string; more: string }> = {
  en: {
    heroSub: "Five illustrative people, five different lives, and the schemes Haqdaar.ai finds for each.",
    cta: "Check my own eligibility",
    intro: "Each card shows what the person might say, what Haqdaar.ai understood, and one of the schemes it found. Open any profile to see the full list and change anything.",
    note: "These are illustrative profiles, not real people. Scheme names come from running each profile through Haqdaar.ai (corpus v3, October 2026); the list you see when you open a profile is always today's.",
    try: "See all matches for this profile",
    more: "+ more",
  },
  hi: {
    heroSub: "पाँच उदाहरण, पाँच अलग ज़िंदगियाँ, और हर एक के लिए हक़दार.ai को मिली योजनाएँ।",
    cta: "अपनी पात्रता जाँचें",
    intro: "हर कार्ड दिखाता है कि व्यक्ति क्या कह सकता है, हक़दार.ai ने क्या समझा, और उसे मिली एक योजना। पूरी सूची देखने और कुछ भी बदलने के लिए कोई भी प्रोफ़ाइल खोलिए।",
    note: "ये उदाहरण के लिए बनाई गई प्रोफ़ाइल हैं, असली लोग नहीं। योजनाओं के नाम हर प्रोफ़ाइल को हक़दार.ai पर चलाकर लिए गए हैं (डेटा संस्करण v3, अक्टूबर 2026); प्रोफ़ाइल खोलने पर दिखने वाली सूची हमेशा आज की होती है।",
    try: "इस प्रोफ़ाइल के सभी मिलान देखें",
    more: "+ और",
  },
};
