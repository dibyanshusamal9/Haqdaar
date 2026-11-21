import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';

/**
 * Sarvam text translation for the call's other languages (Bengali, Marathi, Odia): the
 * caller's answer is translated to English for the keyword reader, and the agent's
 * English lines are translated for the caller. Fixed lines repeat on every call, so
 * results are cached. If translation fails the text is returned unchanged.
 */

const CODE: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', mr: 'mr-IN', od: 'od-IN' };
const CACHE_LIMIT = 800;
const MAX_INPUT = 900; // mayura:v1 accepts up to 1000 characters per request

@Injectable()
export class TranslateService {
  private readonly logger = new Logger('Translate');
  private readonly cache = new Map<string, string>();
  private disabled = false;

  get available() {
    return !!config.sarvam.apiKey && !this.disabled;
  }

  /** Translates line by line (keeps the line breaks the call screen shows). */
  async translate(text: string, from: string, to: string): Promise<string> {
    if (from === to || !text.trim() || !this.available) return text;
    const lines = text.split('\n');
    const out = await Promise.all(lines.map((l) => (l.trim() ? this.one(l, from, to) : Promise.resolve(l))));
    return out.join('\n');
  }

  private async one(line: string, from: string, to: string): Promise<string> {
    const key = `${from}>${to}:${line}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    try {
      const res = await fetch('https://api.sarvam.ai/translate', {
        method: 'POST',
        headers: { 'api-subscription-key': config.sarvam.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: line.slice(0, MAX_INPUT),
          source_language_code: CODE[from] ?? 'en-IN',
          target_language_code: CODE[to] ?? 'en-IN',
          model: config.sarvam.translateModel,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        if ([401, 402, 403].includes(res.status)) this.disabled = true;
        throw new Error(`Sarvam HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      const body = (await res.json()) as { translated_text?: string };
      const translated = String(body.translated_text ?? '').trim() || line;
      if (this.cache.size >= CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, translated);
      return translated;
    } catch (err) {
      this.logger.warn(`Translation ${from}->${to} failed, keeping the original: ${(err as Error).message}`);
      return line;
    }
  }
}
