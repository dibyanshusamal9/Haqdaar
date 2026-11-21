// Interface languages with complete Haqdaar.ai copy. Voice input accepts more
// languages than this (see VOICE_LANGUAGES); the form and results are shown in these.
export type LanguageCode = "en" | "hi";

export const LANGUAGES: { code: LanguageCode; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
];

// Languages Sarvam AI can transcribe; the citizen may speak any of these.
export const VOICE_LANGUAGES: { code: string; nativeName: string }[] = [
  { code: "hi", nativeName: "हिन्दी" },
  { code: "en", nativeName: "English" },
  { code: "bn", nativeName: "বাংলা" },
  { code: "gu", nativeName: "ગુજરાતી" },
  { code: "kn", nativeName: "ಕನ್ನಡ" },
  { code: "ml", nativeName: "മലയാളം" },
  { code: "mr", nativeName: "मराठी" },
  { code: "or", nativeName: "ଓଡ଼ିଆ" },
  { code: "pa", nativeName: "ਪੰਜਾਬੀ" },
  { code: "ta", nativeName: "தமிழ்" },
  { code: "te", nativeName: "తెలుగు" },
];
