import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { config } from '../config';

/** FR-02: speech-to-text through Sarvam AI, tuned for Indian languages and accents. */

const SARVAM_LANG: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN',
  or: 'od-IN', od: 'od-IN', pa: 'pa-IN', ta: 'ta-IN', te: 'te-IN',
};

export interface Transcript {
  text: string;
  languageCode: string | null;
}

@Injectable()
export class SttService {
  get available() {
    return !!config.sarvam.apiKey;
  }

  async transcribe(audio: Buffer, mimetype: string, language?: string): Promise<Transcript> {
    if (!this.available) {
      throw new ServiceUnavailableException('Speech recognition is not configured (SARVAM_API_KEY). Please type instead.');
    }
    const form = new FormData();
    const ext = mimetype.includes('ogg') ? 'ogg' : mimetype.includes('wav') ? 'wav' : mimetype.includes('mp') ? 'mp3' : 'webm';
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimetype || 'audio/webm' }), `speech.${ext}`);
    form.append('model', config.sarvam.sttModel);
    form.append('language_code', (language && SARVAM_LANG[language]) || 'unknown');

    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': config.sarvam.apiKey },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new ServiceUnavailableException(`Speech recognition failed (Sarvam HTTP ${res.status}). Please type instead. ${detail}`);
    }
    const body = (await res.json()) as { transcript?: string; language_code?: string };
    return { text: String(body.transcript ?? '').trim(), languageCode: body.language_code ?? null };
  }
}
