import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';

/**
 * The phone-call demo's voice: Sarvam Bulbul text-to-speech. A line is spoken sentence by
 * sentence; the clips go back as base64 WAVs and the browser plays them in order, so the
 * voice pauses at full stops. Clips are cached in memory because the questions repeat on
 * every call. Any failure returns null and the browser reads the line with its own voice.
 */

const SARVAM_LANG: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', mr: 'mr-IN', od: 'od-IN' };
const SENTENCE_LIMIT = 450; // well inside Sarvam's per-input cap
const CACHE_LIMIT = 400;

@Injectable()
export class TtsService {
  private readonly logger = new Logger('Tts');
  private readonly cache = new Map<string, string>();
  /** Once Sarvam rejects the key or runs out of credit, stop trying until restart. */
  private disabled = false;

  get available() {
    return !!config.sarvam.apiKey && !this.disabled;
  }

  /** `sampleRate`: 22050 for the browser; 8000/16000 for a phone line. */
  async speak(text: string, language: string, sampleRate = 22050): Promise<string[] | null> {
    if (!this.available || !text.trim()) return null;
    try {
      return await Promise.all(sentences(text).map((s) => this.clip(s, language, sampleRate)));
    } catch (err) {
      this.logger.warn(`Speech synthesis failed, the browser will read the line: ${(err as Error).message}`);
      return null;
    }
  }

  private async clip(sentence: string, language: string, sampleRate: number): Promise<string> {
    const key = `${config.sarvam.ttsModel}:${config.sarvam.ttsSpeaker}:${sampleRate}:${language}:${sentence}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const v3 = config.sarvam.ttsModel.startsWith('bulbul:v3');
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': config.sarvam.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: [sentence],
        target_language_code: SARVAM_LANG[language] ?? 'en-IN',
        model: config.sarvam.ttsModel,
        speaker: config.sarvam.ttsSpeaker,
        pace: config.sarvam.ttsPace,
        speech_sample_rate: sampleRate,
        ...(v3 ? { temperature: config.sarvam.ttsTemperature } : { pitch: config.sarvam.ttsPitch }),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      if ([401, 402, 403, 429].includes(res.status)) this.disabled = res.status !== 429;
      throw new Error(`Sarvam HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const body = (await res.json()) as { audios?: string[] };
    const audio = body.audios?.[0];
    if (!audio) throw new Error('Sarvam returned no audio');

    if (this.cache.size >= CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, audio);
    return audio;
  }
}

/** A line -> sentences short enough to synthesise (an over-long one is cut at a comma). */
export function sentences(text: string, limit = SENTENCE_LIMIT): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    for (let s of line.split(/(?<=[.!?।])\s+/)) {
      s = s.trim();
      while (s.length > limit) {
        const comma = s.lastIndexOf(', ', limit - 2);
        const cut = comma > limit / 2 ? comma + 1 : limit;
        out.push(s.slice(0, cut).trim());
        s = s.slice(cut).trim();
      }
      if (s) out.push(s);
    }
  }
  return out;
}
