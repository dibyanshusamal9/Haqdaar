import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';
import {
  CASTES, EMPLOYMENT_STATUSES, GENDERS, MARITAL_STATUSES, normaliseProfileInput, OCCUPATIONS, Profile,
  PROFILE_FIELDS, ProfileField, RESIDENCES, STATES,
} from '../domain/profile';
import { extractWithRules } from './rule-extractor';

/**
 * FR-03: the language model's single job is transcript -> profile JSON. Its output is
 * normalised and validated field by field; anything invalid is dropped (UC-02 step 5a)
 * and shown to the citizen as blank. The model never sees scheme data and never decides
 * eligibility.
 */

export interface Extraction {
  fields: Partial<Profile>;
  provider: 'groq' | 'rules';
  dropped: ProfileField[];
  warning?: string;
}

const SYSTEM_PROMPT = `You fill in an Indian welfare-scheme eligibility form from what a citizen said about themselves.
The text may be in English, Hindi or another Indian language, or a mix.
Return ONE JSON object. Use ONLY these keys, and OMIT every key the citizen did not clearly state:
  age: integer years
  gender: ${GENDERS.join(' | ')}
  state: one of ${STATES.join('; ')}
  residence: ${RESIDENCES.join(' | ')}   (village = rural, town/city = urban)
  caste: ${CASTES.join(' | ')}   (general, OBC, SC, ST, PVTG, DNT)
  annual_income: integer rupees per year for the whole family (monthly x 12; 1 lakh = 100000)
  marital_status: ${MARITAL_STATUSES.join(' | ')}
  occupation: ${OCCUPATIONS.join(' | ')}
  employment_status: ${EMPLOYMENT_STATUSES.join(' | ')}
  student, disability, minority, bpl, gov_employee, economic_distress: true or false
  disability_percent: integer 0-100
Rules:
- Never guess. Never infer a state from the language spoken, or a caste from a name.
- A boolean is true only if stated, false only if explicitly denied; otherwise omit it.
- Convert number words in any language to digits ("pachees saal" -> 25).
- minority is true for the notified minorities: Muslim, Christian, Sikh, Buddhist, Jain, Parsi.
- Output JSON only, no prose.`;

@Injectable()
export class ExtractorService {
  private readonly logger = new Logger('Extractor');
  /** Once Groq rejects our key, stop paying a round trip on every request until restart. */
  private groqDisabled = false;

  get llmAvailable() {
    return !!config.groq.apiKey && !this.groqDisabled;
  }

  async extract(transcript: string): Promise<Extraction> {
    const text = transcript.trim();
    if (!text) return { fields: {}, provider: 'rules', dropped: [] };
    if (this.llmAvailable) {
      try {
        return await this.viaGroq(text);
      } catch (err) {
        this.logger.warn(`Groq extraction failed, using rules: ${(err as Error).message}`);
        return { ...this.viaRules(text), warning: 'The language model was unavailable; fields were filled by keyword rules.' };
      }
    }
    return this.viaRules(text);
  }

  private viaRules(text: string): Extraction {
    return { fields: extractWithRules(text), provider: 'rules', dropped: [] };
  }

  private async viaGroq(text: string): Promise<Extraction> {
    const res = await fetch(`${config.groq.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.groq.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.groq.model,
        temperature: 0,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      if ([401, 403].includes(res.status)) this.groqDisabled = true;
      throw new Error(`Groq HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(body.choices?.[0]?.message?.content ?? '{}');
    } catch {
      throw new Error('Groq returned non-JSON content');
    }
    const known = new Set<string>(PROFILE_FIELDS);
    const filtered = Object.fromEntries(Object.entries(raw).filter(([k]) => known.has(k)));
    const { values, invalid } = normaliseProfileInput(filtered);
    return { fields: values, provider: 'groq', dropped: invalid };
  }
}
