import { Injectable } from '@nestjs/common';
import { normaliseProfileInput, Profile, ProfileField, REQUIRED_FIELDS } from '../domain/profile';
import { MatchService } from '../match/match.service';
import { ExtractorService } from '../profile/extractor.service';
import { extractWithRules } from '../profile/rule-extractor';
import {
  ANY, CALL_FIELDS, CallField, CallLanguage, describe, frame, INTERESTS, interestsFrom, MENU, OPTIONAL_CALL_FIELDS,
  resultsLine, SCRIPT, scriptLanguage, SKIP, speechText, TRANSLATED,
} from './call.script';
import { TranslateService } from './translate.service';
import { TtsService } from './tts.service';

/**
 * The phone-call conversation (an IVR flow), shared by the web demo and the Exotel line.
 * Stateless: each turn carries the profile so far, the caller's areas of interest, the
 * question that was asked and how many times. The call asks only for missing fields, reads
 * answers with the same extractor as the website, and once the required fields are known
 * runs the same deterministic matcher. Bengali, Marathi and Odia answers are translated to
 * English to be read, and the agent's lines are translated back. Language models and
 * translation only help read and speak; they never decide eligibility.
 */

export interface CallTurnInput {
  stage: 'menu' | 'start' | 'answer';
  language: CallLanguage;
  asked: CallField | 'intro' | null;
  attempt: number;
  text: string;
  profile: Record<string, unknown>;
  /** myscheme categories the caller wants help with */
  interests: string[];
  skipped: CallField[];
}

export interface CallOptions {
  /** voice clips' sample rate: 22050 for the browser, the line rate for a phone call */
  sampleRate?: number;
  /** a phone call says "on the website" where the web demo says "on your screen" */
  channel?: 'web' | 'phone';
}

const MAX_RESULTS = 5;
const SPOKEN_RESULTS = 2;
const CATEGORIES = new Set(INTERESTS.map((i) => i.category));

@Injectable()
export class CallService {
  constructor(
    private readonly extractor: ExtractorService,
    private readonly matcher: MatchService,
    private readonly tts: TtsService,
    private readonly translator: TranslateService,
  ) {}

  async turn(input: CallTurnInput, opts: CallOptions = {}) {
    const { language } = input;
    const rate = opts.sampleRate ?? 22050;

    if (input.stage === 'menu') {
      const clips = await Promise.all(MENU.map((m) => this.tts.speak(m.text, m.language, rate)));
      return {
        say: MENU.map((m) => m.text).join('\n'),
        audio: clips.every(Boolean) ? clips.flatMap((c) => c!) : null,
        voice: MENU.map((m) => ({ text: m.text, language: m.language })),
        asked: null,
        attempt: 0,
        profile: {},
        interests: [],
        filled: [],
        skipped: [],
        done: false,
      };
    }

    const lang = scriptLanguage(language);
    const s = SCRIPT[lang];
    // Re-validate what the browser sends back; anything unreadable is simply forgotten.
    const profile: Partial<Profile> = normaliseProfileInput(input.profile).values;
    let interests = input.interests.filter((c) => CATEGORIES.has(c));
    const skipped = new Set<CallField>(input.skipped);
    const lines: string[] = [];
    let filled: string[] = [];
    const { asked, attempt } = input;
    const state = () => ({ profile, interests, filled, skipped });

    if (input.stage === 'start') {
      lines.push(s.greeting);
      return this.reply(lines, language, rate, { asked: 'intro', attempt: 0, ...state(), done: false });
    }

    // Answers in Bengali, Marathi or Odia are read in English.
    const answer = TRANSLATED.includes(language)
      ? await this.translator.translate(input.text.trim(), language, 'en')
      : input.text.trim();

    let answered = false;
    if (asked === 'interest') {
      const found = interestsFrom(answer);
      if (found.length) {
        interests = found;
        filled = ['interest'];
        answered = true;
      }
    } else if (answer) {
      const found = await this.read(answer, asked);
      filled = (Object.keys(found) as ProfileField[]).filter((f) => found[f] !== profile[f]);
      Object.assign(profile, found);
      answered = !!asked && asked !== 'intro' && profile[asked as ProfileField] !== undefined;
    }

    if (asked && asked !== 'intro' && !answered) {
      if (OPTIONAL_CALL_FIELDS.includes(asked)) {
        // Optional questions are asked once: "I don't know", "anything" or an unclear answer moves on.
        skipped.add(asked);
        if (!SKIP.test(answer) && !(asked === 'interest' && ANY.test(answer))) lines.push(s.retry);
      } else {
        // Required: ask again, saying why it matters.
        lines.push(SKIP.test(answer) ? s.needed : s.retry);
        lines.push(s.questions[asked]);
        return this.reply(lines, language, rate, { asked, attempt: attempt + 1, ...state(), done: false });
      }
    } else if (asked === 'intro' && !filled.length) {
      lines.push(s.nothingYet);
    }

    const next = CALL_FIELDS.find((f) => !skipped.has(f) && (f === 'interest' ? !interests.length : profile[f] === undefined));
    if (next) {
      // A short acknowledgement before the next question (the read-back thanks the caller itself).
      if (answered || (asked === 'intro' && filled.length)) lines.push(s.acks[Object.keys(profile).length % s.acks.length]);
      lines.push(s.questions[next]);
      return this.reply(lines, language, rate, { asked: next, attempt: 0, ...state(), done: false });
    }

    // Everything the call asks for is known: read it back, then match.
    const missing = REQUIRED_FIELDS.filter((f) => profile[f] === undefined);
    if (missing.length) {
      // Cannot happen (required fields are never skipped), but never match a partial profile.
      lines.push(s.questions[missing[0] as CallField]);
      return this.reply(lines, language, rate, { asked: missing[0] as CallField, attempt: 0, ...state(), done: false });
    }
    lines.push(`${s.summaryIntro} ${describe(profile, lang, interests).join(', ')}${lang === 'hi' ? '।' : '.'}`);
    lines.push(s.checking);
    const match = await this.matcher.match(profile, 'voice');

    // The caller's area of interest first; the spoken top two come from it when it has any.
    const wanted = (r: { categories: string[] }) => r.categories.some((c) => interests.includes(c));
    const inInterest = interests.length ? match.results.filter(wanted) : [];
    const ranked = interests.length ? [...inInterest, ...match.results.filter((r) => !wanted(r))] : match.results;
    const spoken = ranked.slice(0, SPOKEN_RESULTS).map((r) => r.name);
    lines.push(resultsLine(
      match.counts,
      spoken,
      lang,
      interests.length ? { categories: interests, inInterest: inInterest.length > 0 } : null,
      opts.channel !== 'phone',
    ));
    return this.reply(lines, language, rate, {
      asked: null,
      attempt: 0,
      ...state(),
      done: true,
      match: {
        matchId: match.matchId,
        counts: match.counts,
        durationMs: match.durationMs,
        inInterest: inInterest.length,
        results: ranked.slice(0, MAX_RESULTS),
        full: { ...match, results: ranked },
      },
    });
  }

  /**
   * An answer -> profile fields. The extractor reads the whole answer; if the field that was
   * asked about is still missing, a short answer ("45", "UP", "gaon") gets two more tries:
   * keyword rules on the answer wrapped as a sentence, then direct normalisation.
   */
  private async read(answer: string, asked: CallTurnInput['asked']): Promise<Partial<Profile>> {
    const found: Partial<Profile> = { ...(await this.extractor.extract(answer)).fields };
    if (!asked || asked === 'intro' || asked === 'interest') return found;
    const field = asked as ProfileField;
    if (found[field] !== undefined) return found;

    const framed = extractWithRules(frame(asked, answer));
    if (framed[field] !== undefined) return { ...found, [field]: framed[field] };

    const direct = normaliseProfileInput({ [field]: answer.replace(/[.!?।]+$/, '').trim() }).values;
    if (direct[field] !== undefined) return { ...found, [field]: direct[field] };
    return found;
  }

  private async reply(
    lines: string[],
    language: CallLanguage,
    rate: number,
    state: {
      asked: CallTurnInput['asked'];
      attempt: number;
      profile: Partial<Profile>;
      interests: string[];
      filled: string[];
      skipped: Set<CallField>;
      done: boolean;
      match?: unknown;
    },
  ) {
    let say = lines.join('\n');
    // Bengali, Marathi and Odia: the English lines, translated for the caller.
    if (TRANSLATED.includes(language)) say = await this.translator.translate(say, 'en', language);
    const spoken = speechText(say);
    return {
      say,
      audio: await this.tts.speak(spoken, language, rate),
      // What the browser's own voice reads if no audio came back.
      voice: [{ text: spoken, language }],
      asked: state.asked,
      attempt: state.attempt,
      profile: state.profile,
      interests: state.interests,
      filled: state.filled,
      skipped: [...state.skipped],
      done: state.done,
      ...(state.match ? { match: state.match } : {}),
    };
  }
}
