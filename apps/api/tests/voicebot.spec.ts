import { CallService } from '../src/call/call.service';
import { config } from '../src/config';
import { chunksForExotel, pcmToWav, resample, rms, wavToPcm } from '../src/call/pcm';
import { maskNumbers, TIMING, VoicebotSession } from '../src/call/voicebot';
import { ExtractorService } from '../src/profile/extractor.service';

// A whole Exotel phone call against a fake socket: real call logic and extractor, scripted
// speech-to-text standing in for Sarvam, a one-tone clip standing in for its voice.

const RATE = 16000;
const tone = (ms: number, amp: number) => {
  const n = Math.round((RATE * ms) / 1000);
  const b = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(amp * Math.sin((2 * Math.PI * 300 * i) / RATE)), i * 2);
  return b;
};
const clip = pcmToWav({ samples: tone(200, 3000), sampleRate: 22050 }).toString('base64');

// Independent of the local .env: no token and no account restriction unless a test sets one.
beforeEach(() => {
  config.exotel.streamToken = '';
  config.exotel.accountSid = '';
  config.exotel.callPin = '';
});

const sessions: VoicebotSession[] = [];
afterEach(() => sessions.splice(0).forEach((s) => s.dispose()));

function setup(heard: string[], token = '') {
  const sent: Record<string, any>[] = [];
  let closed = false;
  const extractor = new ExtractorService();
  Object.defineProperty(extractor, 'llmAvailable', { get: () => false });
  const matches: unknown[] = [];
  const matcher = {
    match: async (p: unknown) => {
      matches.push(p);
      return {
        matchId: 'm', durationMs: 5, counts: { total: 2, eligible: 2, likely: 0, central: 2, state: 0, open: 2 },
        results: [{ name: 'Scheme A', categories: ['Health & Wellness'] }, { name: 'Scheme B', categories: ['Agriculture,Rural & Environment'] }],
      };
    },
  };
  const tts = { speak: async () => [clip] };
  const translator = { translate: async (text: string) => text };
  const calls = new CallService(extractor, matcher as never, tts as never, translator as never);
  const stt = { transcribe: async () => ({ text: heard.shift() ?? '', languageCode: 'en-IN' }) };
  const session = new VoicebotSession(
    { send: (d) => sent.push(JSON.parse(d)), close: () => (closed = true) },
    { calls, stt: stt as never, tts: tts as never },
    token || null,
  );
  sessions.push(session);
  const say = (event: Record<string, unknown>) => session.onMessage(JSON.stringify(event));
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const lastMark = () => [...sent].reverse().find((m) => m.event === 'mark')?.mark.name;
  const marks = () => sent.filter((m) => m.event === 'mark').length;
  // Waits until the session has sent a new prompt (it ends with a mark), then echoes that
  // mark as Exotel does once the audio has played.
  const played = async (before: number) => {
    for (let i = 0; i < 500 && marks() <= before; i++) await flush();
    expect(marks()).toBeGreaterThan(before);
    await say({ event: 'mark', stream_sid: 'S1', mark: { name: lastMark() } });
  };
  const media = (pcm: Buffer) => {
    // Exotel sends ~100 ms chunks
    const out: Promise<void>[] = [];
    for (let i = 0; i < pcm.length; i += 3200) out.push(say({ event: 'media', stream_sid: 'S1', media: { payload: pcm.subarray(i, i + 3200).toString('base64') } }));
    return Promise.all(out);
  };
  const answer = async (ms = 600) => {
    await media(Buffer.concat([tone(ms, 6000), Buffer.alloc(Math.round((RATE * (TIMING.silenceMs + 200)) / 1000) * 2)]));
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return { sent, session, say, flush, sleep, lastMark, marks, played, answer, matches, isClosed: () => closed };
}

const start = { event: 'start', stream_sid: 'S1', start: { stream_sid: 'S1', call_sid: 'CA123456', media_format: { encoding: 'raw', sample_rate: String(RATE) }, custom_parameters: { token: 'secret' } } };

describe('Exotel voicebot call', () => {
  it('runs a whole call: menu, questions, match, hang up', async () => {
    const t = setup(["I'm 45, a farmer from Punjab, I live in a village", 'man', 'OBC', 'help with farming', '1 lakh a year']);
    await t.say({ event: 'connected' });
    await t.say(start);
    // The menu plays as media in valid chunks, followed by a mark.
    const media = t.sent.filter((m) => m.event === 'media');
    expect(media.length).toBeGreaterThan(0);
    for (const m of media) {
      const bytes = Buffer.from(m.media.payload, 'base64').length;
      expect(bytes % 320).toBe(0);
      expect(bytes).toBeGreaterThanOrEqual(3200);
      expect(m.stream_sid).toBe('S1');
    }
    await t.played(0);

    // Caller presses 2 for English; the greeting plays.
    await t.say({ event: 'dtmf', stream_sid: 'S1', dtmf: { digit: '2', duration: '100' } });
    await t.played(1);

    // Five spoken answers (the fifth is the area of help); after each the next question plays.
    for (let i = 0; i < 5; i++) {
      const before = t.marks();
      await t.answer();
      await t.played(before);
    }
    expect(t.matches).toHaveLength(1);
    expect(t.matches[0]).toMatchObject({ age: 45, gender: 'male', state: 'Punjab', residence: 'rural', caste: 'obc', occupation: 'farmer', annual_income: 100000 });
    await new Promise((r) => setTimeout(r, 700));
    expect(t.isClosed()).toBe(true);
  });

  it('sends keyed digits once the caller stops pressing keys (no # needed)', async () => {
    const pause = TIMING.digitPauseMs;
    TIMING.digitPauseMs = 60;
    try {
      const t = setup(['I am a farmer from Punjab, I live in a village']);
      await t.say(start);
      await t.played(0);
      await t.say({ event: 'dtmf', dtmf: { digit: '2' } });
      await t.played(1);
      await t.answer();
      await t.played(2);
      // Asked for age: key 4, 5 and simply stop.
      for (const d of ['4', '5']) await t.say({ event: 'dtmf', dtmf: { digit: d } });
      expect(t.marks()).toBe(3);
      await t.sleep(120);
      await t.played(3);
      expect(t.isClosed()).toBe(false);
    } finally {
      TIMING.digitPauseMs = pause;
    }
  });

  it('frees the line as soon as the caller hangs up', async () => {
    const t = setup([]);
    await t.say(start);
    await t.say({ event: 'stop', stream_sid: 'S1', stop: { reason: 'callended' } });
    expect(t.isClosed()).toBe(true);
  });

  it('offers five languages: 3 chooses Bengali', async () => {
    const t = setup([]);
    await t.say(start);
    await t.played(0);
    await t.say({ event: 'dtmf', dtmf: { digit: '3' } });
    await t.played(1);
    expect((t.session as unknown as { language: string }).language).toBe('bn');
  });

  it('asks for the PIN first and opens the menu when it is right', async () => {
    config.exotel.callPin = '1234';
    const t = setup([]);
    await t.say(start);
    await t.played(0); // PIN prompt
    expect((t.session as unknown as { phase: string }).phase).toBe('pin');
    for (const d of ['1', '2', '3', '4']) await t.say({ event: 'dtmf', dtmf: { digit: d } });
    await t.played(1); // language menu
    expect((t.session as unknown as { phase: string }).phase).toBe('menu');
    await t.say({ event: 'dtmf', dtmf: { digit: '2' } });
    await t.played(2);
    expect((t.session as unknown as { phase: string }).phase).toBe('talk');
  });

  it('ends the call after three wrong PINs', async () => {
    config.exotel.callPin = '1234';
    const t = setup([]);
    await t.say(start);
    await t.played(0);
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const d of ['9', '9', '9', '9']) await t.say({ event: 'dtmf', dtmf: { digit: d } });
      await t.played(attempt + 1);
    }
    await t.sleep(700);
    expect(t.isClosed()).toBe(true);
  });

  it('takes keypad digits ending in # as an answer', async () => {
    const t = setup(['I am a farmer from Punjab, I live in a village']);
    await t.say(start);
    await t.played(0);
    await t.say({ event: 'dtmf', dtmf: { digit: '2' } });
    await t.played(1);
    await t.answer();
    await t.played(2);
    // Asked for age: key it in, then # sends it and the next question plays.
    for (const d of ['4', '5', '#']) await t.say({ event: 'dtmf', dtmf: { digit: d } });
    await t.played(3);
    expect(t.isClosed()).toBe(false);
  });

  it('refuses a stream without the shared token', async () => {
    const original = config.exotel.streamToken;
    config.exotel.streamToken = 'secret';
    try {
      const t = setup([]);
      await t.say({ ...start, start: { ...start.start, custom_parameters: { token: 'wrong' } } });
      expect(t.isClosed()).toBe(true);
      expect(t.sent).toHaveLength(0);
      const ok = setup([]);
      await ok.say(start);
      expect(ok.isClosed()).toBe(false);
      // Account check: only streams from our Exotel account.
      config.exotel.streamToken = '';
      config.exotel.accountSid = 'haqdaar2';
      const other = setup([]);
      await other.say({ ...start, start: { ...start.start, account_sid: 'someone-else' } });
      expect(other.isClosed()).toBe(true);
      const ours = setup([]);
      await ours.say({ ...start, start: { ...start.start, account_sid: 'haqdaar2' } });
      expect(ours.isClosed()).toBe(false);
    } finally {
      config.exotel.streamToken = original;
      config.exotel.accountSid = '';
    }
  });
});

describe('pcm helpers', () => {
  it('round-trips WAV and resamples', () => {
    const pcm = { samples: tone(100, 1000), sampleRate: RATE };
    const back = wavToPcm(pcmToWav(pcm));
    expect(back.sampleRate).toBe(RATE);
    expect(back.samples.equals(pcm.samples)).toBe(true);
    expect(resample(pcm, 8000).samples.length).toBe(pcm.samples.length / 2);
    expect(rms(tone(100, 1000))).toBeGreaterThan(600);
    expect(rms(Buffer.alloc(320))).toBe(0);
  });

  it('cuts chunks Exotel accepts', () => {
    const chunks = chunksForExotel(Buffer.alloc(10_000));
    expect(chunks.every((c) => c.length % 320 === 0 && c.length >= 3200)).toBe(true);
    expect(chunks.reduce((n, c) => n + c.length, 0)).toBeGreaterThanOrEqual(10_000);
  });
});

describe('call log privacy', () => {
  it('masks phone numbers in logged Exotel messages', () => {
    expect(maskNumbers('{"from":"07002074076","to":"08047291722","x":1}')).toBe('{"from":"…76","to":"…22","x":1}');
  });
});
