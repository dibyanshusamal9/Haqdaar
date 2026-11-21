import * as path from 'node:path';
import * as dotenv from 'dotenv';

// apps/api/{src,dist}/config.* -> repo root is three levels up.
export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// The repo-root .env is shared by every app; apps/api/.env may override it.
dotenv.config({ path: path.join(REPO_ROOT, 'apps', 'api', '.env'), quiet: true });
dotenv.config({ path: path.join(REPO_ROOT, '.env'), quiet: true });

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback = ''): string {
  const raw = process.env[name];
  // .env lines in this repo carry trailing "# comments"; dotenv keeps them for unquoted values.
  return raw === undefined ? fallback : raw.replace(/\s+#.*$/, '').trim() || fallback;
}

export const config = {
  port: num('API_PORT', 4000),
  databaseUrl: str('HAQDAAR_DATABASE_URL') || str('DATABASE_URL'),
  corsOrigins: str('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  adminAccessCode: str('ADMIN_ACCESS_CODE') || str('OFFICER_ACCESS_CODE'),

  sarvam: {
    apiKey: str('SARVAM_API_KEY'),
    sttModel: str('SARVAM_STT_MODEL', 'saaras:v3'),
    // The phone-call demo's voice (Sarvam Bulbul text-to-speech).
    ttsModel: str('SARVAM_TTS_MODEL', 'bulbul:v3'),
    ttsSpeaker: str('SARVAM_TTS_SPEAKER', 'priya'),
    ttsPace: num('SARVAM_TTS_PACE', 1.1),
    ttsPitch: num('SARVAM_TTS_PITCH', 0),
    ttsTemperature: num('SARVAM_TTS_TEMPERATURE', 0.6),
    // Bengali, Marathi and Odia calls: answers are translated to English to be read.
    translateModel: str('SARVAM_TRANSLATE_MODEL', 'mayura:v1'),
  },
  // The phone line: Exotel's Voicebot applet streams calls to /exotel/voicebot.
  exotel: {
    // Shared secret the Voicebot applet sends as the custom parameter "token"; calls
    // without it are refused. Empty = no check (local testing only).
    streamToken: str('EXOTEL_STREAM_TOKEN'),
    // Only streams from this Exotel account (the `account_sid` in each call's start event)
    // are accepted. Not a secret, so nothing sensitive has to be typed into Exotel.
    accountSid: str('EXOTEL_ACCOUNT_SID'),
    // PIN callers key in before the language menu (e.g. 1234). Empty = no PIN.
    callPin: str('EXOTEL_CALL_PIN'),
    // Must match the sample rate set on the Voicebot applet (8000, 16000 or 24000).
    sampleRate: num('EXOTEL_SAMPLE_RATE', 16000),
  },
  groq: {
    apiKey: str('GROQ_API_KEY'),
    model: str('GROQ_MODEL', 'llama-3.3-70b-versatile'),
    baseUrl: str('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
  },

  myscheme: {
    siteUrl: 'https://www.myscheme.gov.in',
    apiUrl: str('MYSCHEME_API_URL', 'https://api.myscheme.gov.in'),
    // Public key the myscheme.gov.in frontend sends from every browser. Discovered from
    // the site's JS bundle at run time; set this only if discovery breaks.
    apiKey: str('MYSCHEME_API_KEY'),
    cacheDir: str('MYSCHEME_CACHE_DIR') || path.join(REPO_ROOT, 'data', 'myscheme', 'raw'),
    minIntervalMs: num('MYSCHEME_MIN_INTERVAL_MS', 350),
    concurrency: num('MYSCHEME_CONCURRENCY', 3),
    maxRetries: num('MYSCHEME_MAX_RETRIES', 5),
    userAgent: str(
      'MYSCHEME_USER_AGENT',
      'HaqdaarBot/0.1 (+student project, Thapar Institute; polite batch scraper)',
    ),
  },
};

export type AppConfig = typeof config;
