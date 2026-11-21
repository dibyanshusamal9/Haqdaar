import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { Injectable, Logger } from '@nestjs/common';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { config } from '../config';
import { SttService } from '../profile/stt.service';
import { CallLanguage, MENU, MENU_KEYS } from './call.script';
import { CallService, CallTurnInput } from './call.service';
import { chunksForExotel, pcmToWav, resample, rms, wavToPcm } from './pcm';
import { TtsService } from './tts.service';

/**
 * The real phone line. Exotel's Voicebot applet streams each call over a WebSocket: the
 * caller's audio arrives as base64 16-bit PCM, key presses as `dtmf` events, and audio we
 * send back is played to the caller. Each call runs the same conversation as the web demo
 * (CallService): a language menu (1-5), questions only for what is missing, then the top
 * schemes read aloud. When the call is finished, or the caller hangs up, we close the
 * socket so Exotel ends the call and the line is free for the next one.
 */

export const VOICEBOT_PATH = '/exotel/voicebot';

export const TIMING = {
  minSpeechMs: 250, // this much sound means the caller has started speaking
  silenceMs: 1200, // a pause this long ends their answer
  maxAnswerMs: 15_000, // longest single answer
  noAnswerMs: 9000, // nothing said: ask again
  menuWaitMs: 8000, // no key at the menu: continue in Hindi
  digitPauseMs: 2000, // keyed digits are sent once the caller stops pressing keys
  gapMs: 250, // silence between sentences we play
  maxSilentRetries: 3, // then say goodbye
  idleMs: 30_000, // no audio from Exotel for this long: the call is gone, free the line
  maxCallMs: 15 * 60_000, // hard limit on one call
  pinWaitMs: 12_000, // no PIN keyed after the prompt: ask again
  pinTries: 3, // wrong PINs before the call ends
};

// The PIN gate (when EXOTEL_CALL_PIN is set), spoken in Hindi then English.
const PIN = {
  ask: [
    { language: 'hi' as const, text: 'हक़दार हेल्पलाइन में आपका स्वागत है। कृपया अपना 4 अंकों का पिन दबाएँ।' },
    { language: 'en' as const, text: 'Welcome to the Haqdaar helpline. Please key in your 4-digit PIN.' },
  ],
  wrong: [
    { language: 'hi' as const, text: 'पिन सही नहीं है। कृपया फिर से दबाएँ।' },
    { language: 'en' as const, text: 'That PIN is not right. Please try again.' },
  ],
  refused: [
    { language: 'hi' as const, text: 'पिन सही नहीं है। नमस्ते।' },
    { language: 'en' as const, text: 'That PIN is not right. Goodbye.' },
  ],
};

const GOODBYE: Record<CallLanguage, string> = {
  hi: 'मुझे आपकी आवाज़ सुनाई नहीं दी। कृपया फिर से कॉल करें। नमस्ते।',
  en: 'I could not hear you. Please call again. Goodbye.',
  bn: 'আমি আপনার কথা শুনতে পাইনি। অনুগ্রহ করে আবার কল করুন। নমস্কার।',
  mr: 'मला तुमचा आवाज ऐकू आला नाही. कृपया पुन्हा कॉल करा. नमस्कार.',
  od: 'ମୁଁ ଆପଣଙ୍କ କଥା ଶୁଣିପାରିଲି ନାହିଁ। ଦୟାକରି ପୁଣି କଲ୍ କରନ୍ତୁ। ନମସ୍କାର।',
};

type Turn = Awaited<ReturnType<CallService['turn']>>;

/** The parts of a WebSocket a session uses (so tests can drive it without a network). */
export interface Socket {
  send(data: string): void;
  close(): void;
}

export class VoicebotSession {
  private readonly log = new Logger('Voicebot');
  private streamSid = '';
  private callTag = '';
  private rate = config.exotel.sampleRate;
  private language: CallLanguage = 'hi';
  private phase: 'waiting' | 'pin' | 'menu' | 'talk' | 'closing' | 'closed' = 'waiting';
  private pinTries = 0;
  private pinTimer: NodeJS.Timeout | null = null;
  private state: Pick<CallTurnInput, 'asked' | 'attempt' | 'profile' | 'interests' | 'skipped'> = {
    asked: null, attempt: 0, profile: {}, interests: [], skipped: [],
  };
  private busy = false;
  private markSeq = 0;
  private pendingMark: string | null = null;
  private speechTimer: NodeJS.Timeout | null = null;
  private menuTimer: NodeJS.Timeout | null = null;
  private digitTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private callTimer: NodeJS.Timeout | null = null;
  private silentRetries = 0;
  private digits = '';
  // listening
  private listening = false;
  private heard: Buffer[] = [];
  private preroll: Buffer[] = [];
  private spoke = false;
  private speechMs = 0;
  private silentMs = 0;
  private listenedMs = 0;
  private noise = 200;

  constructor(
    private readonly ws: Socket,
    private readonly deps: { calls: CallService; stt: SttService; tts: TtsService },
    private readonly queryToken: string | null = null,
  ) {}

  async onMessage(raw: string): Promise<void> {
    let msg: Record<string, any>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.event) {
      case 'start':
        return this.onStart(msg);
      case 'media':
        this.alive();
        if (this.listening && typeof msg.media?.payload === 'string') this.hear(Buffer.from(msg.media.payload, 'base64'));
        return;
      case 'dtmf':
        this.alive();
        return this.onKey(String(msg.dtmf?.digit ?? ''));
      case 'mark':
        if (msg.mark?.name && msg.mark.name === this.pendingMark) this.doneSpeaking();
        return;
      case 'stop':
        // The caller hung up (or the applet ended): close our side at once, so Exotel
        // releases the call and the number can be dialled again straight away.
        this.log.log(`${this.callTag} ended (${msg.stop?.reason ?? 'stop'})`);
        return this.close();
      default:
        return;
    }
  }

  dispose(): void {
    this.phase = 'closed';
    this.listening = false;
    for (const t of [this.speechTimer, this.menuTimer, this.digitTimer, this.idleTimer, this.callTimer, this.pinTimer]) if (t) clearTimeout(t);
  }

  /** Audio keeps flowing during a live call; when it stops, the call is gone. */
  private alive() {
    if (this.phase === 'closed') return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.log.warn(`${this.callTag} no audio for ${TIMING.idleMs / 1000}s, closing`);
      this.close();
    }, TIMING.idleMs);
  }

  // ------------------------------------------------------------------ call flow

  private async onStart(msg: Record<string, any>) {
    const start = msg.start ?? {};
    this.streamSid = String(msg.stream_sid ?? start.stream_sid ?? '');
    this.callTag = `call …${String(start.call_sid ?? this.streamSid).slice(-6)}`;
    const rate = Number(start.media_format?.sample_rate);
    if (rate > 0) this.rate = rate;

    const expected = config.exotel.streamToken;
    const token = start.custom_parameters?.token ?? this.queryToken;
    const account = config.exotel.accountSid;
    const refused = expected && token !== expected
      ? 'wrong or missing token'
      : account && String(start.account_sid ?? '') !== account ? 'not from our Exotel account' : null;
    if (refused) {
      this.log.warn(`${this.callTag} refused: ${refused}`);
      this.phase = 'closed';
      this.ws.close();
      return;
    }
    this.log.log(`${this.callTag} started (${this.rate} Hz, account ${start.account_sid ?? '?'})`);
    this.alive();
    this.callTimer = setTimeout(() => this.close(), TIMING.maxCallMs);
    if (config.exotel.callPin) {
      this.phase = 'pin';
      await this.say(PIN.ask);
    } else {
      await this.menu();
    }
  }

  private async menu() {
    this.phase = 'menu';
    await this.say(MENU);
  }

  /** Speaks fixed lines, each in its own language. */
  private async say(lines: { language: CallLanguage; text: string }[]) {
    const clips = await Promise.all(lines.map((l) => this.deps.tts.speak(l.text, l.language, this.rate)));
    if (this.phase === 'closed') return;
    this.play(clips.flatMap((c) => c ?? []));
  }

  // ------------------------------------------------------------------ PIN

  /** Keyed PIN digits: checked once there are enough, on #, or after a pause. */
  private onPinKey(digit: string) {
    if (this.pinTimer) clearTimeout(this.pinTimer);
    if (digit === '*') {
      this.digits = '';
      return;
    }
    if (digit !== '#') this.digits += digit;
    this.stopPlaying();
    if (digit === '#' || this.digits.length >= config.exotel.callPin.length) void this.checkPin();
    else this.pinTimer = setTimeout(() => void this.checkPin(), TIMING.digitPauseMs);
  }

  private async checkPin() {
    if (this.pinTimer) clearTimeout(this.pinTimer);
    if (this.phase !== 'pin') return;
    const keyed = this.digits;
    this.digits = '';
    if (keyed === config.exotel.callPin) {
      this.log.log(`${this.callTag} PIN accepted`);
      await this.menu();
      return;
    }
    this.log.warn(`${this.callTag} wrong PIN (${keyed.length} digits)`);
    if (++this.pinTries >= TIMING.pinTries) {
      this.phase = 'closing';
      await this.say(PIN.refused);
      return;
    }
    await this.say(PIN.wrong);
  }

  private onKey(digit: string) {
    if (!digit) return;
    if (this.phase === 'pin') return this.onPinKey(digit);
    if (this.phase === 'menu') {
      const language = MENU_KEYS[digit];
      if (language) {
        this.stopPlaying();
        void this.chooseLanguage(language);
      }
      return;
    }
    if (this.phase !== 'talk' || this.busy) return;
    // Digits answer number questions (age, income). They are sent once the caller stops
    // pressing keys for two seconds; # sends at once, * starts again.
    if (this.digitTimer) clearTimeout(this.digitTimer);
    if (digit === '#') return this.sendDigits();
    if (digit === '*') {
      this.digits = '';
      return;
    }
    this.digits += digit;
    this.listening = false; // keying in: don't treat the tones as speech
    this.digitTimer = setTimeout(() => this.sendDigits(), TIMING.digitPauseMs);
  }

  private sendDigits() {
    if (this.digitTimer) clearTimeout(this.digitTimer);
    const typed = this.digits;
    this.digits = '';
    if (!typed || this.busy || this.phase !== 'talk') {
      if (this.phase === 'talk' && !this.busy && !this.pendingMark) this.startListening();
      return;
    }
    this.stopPlaying();
    this.listening = false;
    this.log.log(`${this.callTag} keyed ${typed}`);
    void this.turn('answer', typed);
  }

  private async chooseLanguage(language: CallLanguage) {
    if (this.phase !== 'menu') return;
    if (this.menuTimer) clearTimeout(this.menuTimer);
    this.language = language;
    this.phase = 'talk';
    this.log.log(`${this.callTag} language ${language}`);
    await this.turn('start');
  }

  private async turn(stage: 'start' | 'answer', text = '') {
    this.busy = true;
    let reply: Turn;
    try {
      reply = await this.deps.calls.turn({ stage, language: this.language, text, ...this.state }, { sampleRate: this.rate, channel: 'phone' });
    } catch (err) {
      this.log.error(`${this.callTag} turn failed: ${(err as Error).message}`);
      this.busy = false;
      this.phase = 'closing';
      this.play(await this.deps.tts.speak(GOODBYE[this.language], this.language, this.rate));
      return;
    }
    this.state = {
      asked: reply.asked, attempt: reply.attempt, profile: reply.profile as Record<string, unknown>,
      interests: reply.interests, skipped: reply.skipped,
    };
    if (reply.filled.length) this.log.log(`${this.callTag} understood ${reply.filled.join(', ')}`);
    if (reply.done) {
      this.phase = 'closing';
      this.log.log(`${this.callTag} matched: ${JSON.stringify((reply as { match?: { counts?: unknown } }).match?.counts ?? {})}`);
    }
    this.busy = false;
    this.play(reply.audio);
  }

  // ------------------------------------------------------------------ speaking

  /** Plays WAV clips (base64) to the caller, then waits for Exotel's mark. */
  private play(clips: string[] | null) {
    this.listening = false;
    if (!clips?.length) {
      this.log.warn(`${this.callTag} no audio to play (speech synthesis unavailable)`);
      this.doneSpeaking();
      return;
    }
    const gap = Buffer.alloc(Math.round((this.rate * TIMING.gapMs) / 1000) * 2);
    const parts: Buffer[] = [];
    for (const clip of clips) {
      try {
        parts.push(resample(wavToPcm(Buffer.from(clip, 'base64')), this.rate).samples, gap);
      } catch (err) {
        this.log.warn(`${this.callTag} skipped an unreadable clip: ${(err as Error).message}`);
      }
    }
    const pcm = Buffer.concat(parts);
    for (const chunk of chunksForExotel(pcm)) {
      this.send({ event: 'media', stream_sid: this.streamSid, media: { payload: chunk.toString('base64') } });
    }
    const name = `haqdaar-${++this.markSeq}`;
    this.pendingMark = name;
    this.send({ event: 'mark', stream_sid: this.streamSid, mark: { name } });
    // If Exotel never echoes the mark, carry on once the audio must have finished.
    const ms = (pcm.length / 2 / this.rate) * 1000;
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(() => { if (this.pendingMark === name) this.doneSpeaking(); }, ms + 2500);
  }

  private stopPlaying() {
    if (!this.pendingMark) return;
    this.pendingMark = null;
    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.send({ event: 'clear', stream_sid: this.streamSid });
  }

  private doneSpeaking() {
    this.pendingMark = null;
    if (this.speechTimer) clearTimeout(this.speechTimer);
    if (this.phase === 'closing') {
      // Let the last words reach the caller, then hand the call back to the flow (Hangup).
      setTimeout(() => this.close(), 600);
    } else if (this.phase === 'pin') {
      // Waiting for the PIN; nothing keyed in time counts as a try and asks again.
      if (this.pinTimer) clearTimeout(this.pinTimer);
      this.pinTimer = setTimeout(() => {
        if (this.phase !== 'pin' || this.digits) return;
        if (++this.pinTries >= TIMING.pinTries) {
          this.phase = 'closing';
          void this.say(PIN.refused);
        } else {
          void this.say(PIN.ask);
        }
      }, TIMING.pinWaitMs);
    } else if (this.phase === 'menu') {
      if (this.menuTimer) clearTimeout(this.menuTimer);
      this.menuTimer = setTimeout(() => void this.chooseLanguage('hi'), TIMING.menuWaitMs);
    } else if (this.phase === 'talk' && !this.busy) {
      this.startListening();
    }
  }

  private close() {
    if (this.phase === 'closed') return;
    this.dispose();
    this.log.log(`${this.callTag} finished`);
    this.ws.close();
  }

  // ------------------------------------------------------------------ listening

  private startListening() {
    // Digits keyed while the question played are still on their way.
    if (this.digits) return;
    this.listening = true;
    this.heard = [];
    this.preroll = [];
    this.spoke = false;
    this.speechMs = 0;
    this.silentMs = 0;
    this.listenedMs = 0;
  }

  /** Voice activity detection on the caller's audio: speech, then a pause, ends an answer. */
  private hear(chunk: Buffer) {
    const ms = (chunk.length / 2 / this.rate) * 1000;
    const level = rms(chunk);
    this.listenedMs += ms;
    if (level > Math.max(350, this.noise * 3)) {
      this.speechMs += ms;
      this.silentMs = 0;
      if (!this.spoke && this.speechMs >= TIMING.minSpeechMs) {
        this.spoke = true;
        this.heard = [...this.preroll];
      }
    } else if (!this.spoke) {
      this.noise = this.noise * 0.95 + level * 0.05;
      this.speechMs = 0;
    } else {
      this.silentMs += ms;
    }
    if (this.spoke) this.heard.push(chunk);
    else {
      this.preroll.push(chunk);
      if (this.preroll.length > 8) this.preroll.shift();
    }

    if (this.spoke && (this.silentMs >= TIMING.silenceMs || this.listenedMs >= TIMING.maxAnswerMs)) void this.answerHeard();
    else if (!this.spoke && this.listenedMs >= TIMING.noAnswerMs) void this.noAnswer();
  }

  private async answerHeard() {
    this.listening = false;
    this.busy = true;
    const wav = pcmToWav({ samples: Buffer.concat(this.heard), sampleRate: this.rate });
    let text = '';
    try {
      text = (await this.deps.stt.transcribe(wav, 'audio/wav', this.language)).text;
    } catch (err) {
      this.log.warn(`${this.callTag} speech-to-text failed: ${(err as Error).message}`);
    }
    this.busy = false;
    if (this.phase !== 'talk') return;
    if (!text) return this.noAnswer();
    this.silentRetries = 0;
    this.log.log(`${this.callTag} heard "${text}"`);
    await this.turn('answer', text);
  }

  private async noAnswer() {
    this.listening = false;
    if (++this.silentRetries >= TIMING.maxSilentRetries) {
      this.phase = 'closing';
      this.play(await this.deps.tts.speak(GOODBYE[this.language], this.language, this.rate));
      return;
    }
    // An empty answer: the call asks again (or skips an optional question).
    await this.turn('answer', '');
  }

  private send(message: unknown) {
    if (this.phase === 'closed') return;
    this.ws.send(JSON.stringify(message));
  }
}

/** Accepts Exotel's WebSocket connections on the API's HTTP server. */
@Injectable()
export class VoicebotGateway {
  private readonly log = new Logger('Voicebot');

  constructor(
    private readonly calls: CallService,
    private readonly stt: SttService,
    private readonly tts: TtsService,
  ) {}

  attach(server: Server) {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== VOICEBOT_PATH) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        const session = new VoicebotSession(ws, { calls: this.calls, stt: this.stt, tts: this.tts }, url.searchParams.get('token'));
        ws.on('message', (data: RawData) => {
          session.onMessage(data.toString()).catch((err) => this.log.error(`Voicebot message failed: ${(err as Error).message}`));
        });
        ws.on('close', () => session.dispose());
        ws.on('error', (err) => this.log.warn(`Voicebot socket error: ${err.message}`));
      });
    });
    this.log.log(`Exotel Voicebot stream accepted at ws://…${VOICEBOT_PATH}`);
  }
}
