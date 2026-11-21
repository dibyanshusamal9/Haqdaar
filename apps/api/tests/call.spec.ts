import { CallService, CallTurnInput } from '../src/call/call.service';
import {
  describe as describeProfile, interestsFrom, resultsLine, speechText, spokenRupees,
} from '../src/call/call.script';
import { sentences } from '../src/call/tts.service';
import { ExtractorService } from '../src/profile/extractor.service';
import { normaliseEnglishNumbers } from '../src/profile/english-numbers';
import { extractWithRules } from '../src/profile/rule-extractor';

// The call flow with keyword extraction (no LLM), no voice, a stub matcher and a stub
// translator that records what it was asked to translate.
const extractor = new ExtractorService();
Object.defineProperty(extractor, 'llmAvailable', { get: () => false });
const matched: unknown[] = [];
const matcher = {
  match: async (profile: unknown) => {
    matched.push(profile);
    return {
      matchId: 'm1',
      durationMs: 12,
      counts: { total: 4, eligible: 3, likely: 1, central: 3, state: 1, open: 4 },
      results: [
        { name: 'Atal Pension Yojana', categories: ['Social welfare & Empowerment'] },
        { name: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)', categories: ['Agriculture,Rural & Environment'] },
        { name: 'National Scholarship', categories: ['Education & Learning'] },
        { name: 'Punjab Farmer Scheme', categories: ['Agriculture,Rural & Environment'] },
      ],
    };
  },
};
const tts = { speak: async () => null };
const translated: { text: string; from: string; to: string }[] = [];
const translator = {
  translate: async (text: string, from: string, to: string) => {
    translated.push({ text, from, to });
    // Pretend: Bengali answers come out in English, English lines get a [bn] tag.
    if (to === 'en') return { 'আমার বয়স পঁয়তাল্লিশ': 'My age is forty-five' }[text] ?? text;
    return `[${to}] ${text}`;
  },
};
const calls = new CallService(extractor, matcher as never, tts as never, translator as never);

const turn = (over: Partial<CallTurnInput>, channel: 'web' | 'phone' = 'web') =>
  calls.turn(
    { stage: 'answer', language: 'en', asked: null, attempt: 0, text: '', profile: {}, interests: [], skipped: [], ...over },
    { channel },
  );

const BASE = { age: 45, gender: 'male', state: 'Punjab', residence: 'rural', caste: 'obc' };

describe('call flow', () => {
  beforeEach(() => {
    matched.length = 0;
    translated.length = 0;
  });

  it('opens with the five-language menu', async () => {
    const r = await turn({ stage: 'menu' });
    expect(r.say).toContain('1 दबाएँ');
    expect(r.say).toContain('press 2');
    expect(r.say).toContain('3 টিপুন');
    expect(r.say).toContain('4 दाबा');
    expect(r.say).toContain('5 ଦବାନ୍ତୁ');
    expect(r.voice.map((v) => v.language)).toEqual(['hi', 'en', 'bn', 'mr', 'od']);
  });

  it('greets, then asks only for what the intro did not cover', async () => {
    expect((await turn({ stage: 'start' })).asked).toBe('intro');
    const r = await turn({ asked: 'intro', text: 'I am 45 years old, a farmer from Punjab, I live in a village' });
    expect(r.profile).toMatchObject({ age: 45, state: 'Punjab', residence: 'rural', occupation: 'farmer' });
    expect(r.asked).toBe('gender');
  });

  it('reads short answers to the question that was asked', async () => {
    expect((await turn({ asked: 'age', text: '45' })).profile).toMatchObject({ age: 45 });
    expect((await turn({ asked: 'age', text: 'forty five' })).profile).toMatchObject({ age: 45 });
    expect((await turn({ asked: 'state', text: 'UP' })).profile).toMatchObject({ state: 'Uttar Pradesh' });
    expect((await turn({ asked: 'residence', text: 'gaon' })).profile).toMatchObject({ residence: 'rural' });
    expect((await turn({ asked: 'annual_income', text: '8000 per month', profile: { age: 30 } })).profile)
      .toMatchObject({ annual_income: 96000 });
    expect((await turn({ language: 'hi', asked: 'age', text: 'पैंतालीस' })).profile).toMatchObject({ age: 45 });
  });

  it('asks a required question again when the answer is unclear', async () => {
    const r = await turn({ asked: 'caste', text: 'hmm', attempt: 0 });
    expect(r.asked).toBe('caste');
    expect(r.attempt).toBe(1);
    expect(r.say).toMatch(/did not catch that/);
  });

  it('asks what help the caller needs after the required fields', async () => {
    const r = await turn({ asked: 'caste', text: 'OBC', profile: { ...BASE, caste: undefined } });
    expect(r.asked).toBe('interest');
    expect(r.say).toContain('What kind of help do you need?');
    const answered = await turn({ asked: 'interest', text: 'help with farming and education', profile: BASE });
    expect(answered.interests).toEqual(['Agriculture,Rural & Environment', 'Education & Learning']);
    expect(answered.asked).toBe('occupation');
  });

  it('takes "anything" as no preference, without an apology', async () => {
    const r = await turn({ asked: 'interest', text: 'anything is fine', profile: BASE });
    expect(r.interests).toEqual([]);
    expect(r.skipped).toContain('interest');
    expect(r.say).not.toMatch(/did not catch/);
  });

  it('speaks the top two schemes from the caller\'s area of interest', async () => {
    const r = await turn({
      asked: 'annual_income', text: '1 lakh', profile: { ...BASE, occupation: 'farmer' },
      interests: ['Agriculture,Rural & Environment'],
    }, 'phone');
    expect(r.done).toBe(true);
    expect(matched[0]).toMatchObject({ ...BASE, occupation: 'farmer', annual_income: 100000 });
    expect(r.say).toContain('looking for help with farming');
    expect(r.say).toContain('For farming, the two best matches are:\n1. Pradhan Mantri Kisan Samman Nidhi\n2. Punjab Farmer Scheme');
    expect(r.say).not.toContain('3.');
    expect(r.say).toContain('on the Haqdaar website');
    // Interest first in what the screen shows, too.
    const m = r.match as { results: { name: string }[]; inInterest: number };
    expect(m.inInterest).toBe(2);
    expect(m.results[0].name).toMatch(/PM-KISAN/);
  });

  it('says so when nothing matches the interest, then gives the best overall', async () => {
    const r = await turn({
      asked: 'annual_income', text: '1 lakh', profile: { ...BASE, occupation: 'farmer' },
      interests: ['Housing & Shelter'],
    });
    expect(r.say).toContain('I found no housing scheme that fits you, so here are the two best matches overall:\n1. Atal Pension Yojana');
    expect(r.say).toContain('on your screen');
  });

  it('skips an optional question the caller cannot answer', async () => {
    const r = await turn({ asked: 'annual_income', text: "I don't know", profile: { ...BASE, occupation: 'farmer' }, skipped: ['interest'] });
    expect(r.skipped).toContain('annual_income');
    expect(r.done).toBe(true);
  });

  it('never matches before the required fields are known', async () => {
    const r = await turn({ asked: 'intro', text: 'I am a farmer' });
    expect(r.done).toBe(false);
    expect(matched).toHaveLength(0);
  });

  it('translates Bengali answers to English and its lines into Bengali', async () => {
    const r = await turn({ language: 'bn', asked: 'age', text: 'আমার বয়স পঁয়তাল্লিশ' });
    expect(translated[0]).toEqual({ text: 'আমার বয়স পঁয়তাল্লিশ', from: 'bn', to: 'en' });
    expect(r.profile).toMatchObject({ age: 45 });
    expect(r.say.startsWith('[bn] ')).toBe(true);
    expect(r.voice[0].language).toBe('bn');
  });
});

describe('call script', () => {
  it('says money the way people do', () => {
    expect(spokenRupees(150000, 'en')).toBe('1.5 lakh rupees');
    expect(spokenRupees(96000, 'hi')).toBe('96 हज़ार रुपये');
  });

  it('describes a profile in Hindi', () => {
    expect(describeProfile({ age: 30, gender: 'female', state: 'Bihar', residence: 'rural' }, 'hi', ['Health & Wellness']))
      .toEqual(['उम्र 30 साल', 'महिला', 'राज्य बिहार', 'गाँव', 'मदद: स्वास्थ्य']);
  });

  it('recognises areas of help in English and Hindi', () => {
    expect(interestsFrom('I need a loan for my shop')).toEqual(['Banking,Financial Services and Insurance', 'Business & Entrepreneurship']);
    expect(interestsFrom('मुझे इलाज और घर के लिए मदद चाहिए')).toEqual(['Health & Wellness', 'Housing & Shelter']);
    expect(interestsFrom('nothing in particular')).toEqual([]);
  });

  it('turns list lines into spoken pauses', () => {
    expect(speechText('The two best matches are:\n1. A\n2. B')).toBe('The two best matches are. 1, A. 2, B.');
    expect(resultsLine({ eligible: 0, likely: 0 }, [], 'en')).toMatch(/no scheme fully matches/);
  });

  it('splits long text into sentences for synthesis', () => {
    expect(sentences('One. Two!\nThree।')).toEqual(['One.', 'Two!', 'Three।']);
    expect(sentences(`${'word, '.repeat(100)}end.`, 100).every((s) => s.length <= 100)).toBe(true);
  });
});

describe('English number words', () => {
  it('converts spelled-out numbers', () => {
    expect(normaliseEnglishNumbers('My age is forty-five')).toBe('My age is 45');
    expect(normaliseEnglishNumbers('one lakh twenty thousand')).toBe('120000');
    expect(normaliseEnglishNumbers('two hundred and fifty')).toBe('250');
    expect(normaliseEnglishNumbers('a lakh')).toBe('a lakh');
    expect(extractWithRules('My age is fifty, I live in a village in Odisha')).toMatchObject({ age: 50, state: 'Odisha', residence: 'rural' });
    expect(extractWithRules('family income is two lakh a year')).toMatchObject({ annual_income: 200000 });
  });
});
