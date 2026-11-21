import { BadRequestException, Body, Controller, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { parse } from '../common/validation';
import { SttService } from '../profile/stt.service';
import { CALL_FIELDS, CALL_LANGUAGES } from './call.script';
import { CallService } from './call.service';

const TurnBody = z.object({
  stage: z.enum(['menu', 'start', 'answer']),
  language: z.enum(CALL_LANGUAGES).default('hi'),
  asked: z.enum([...CALL_FIELDS, 'intro']).nullable().default(null),
  attempt: z.number().int().min(0).max(20).default(0),
  text: z.string().max(2000).default(''),
  profile: z.record(z.string(), z.unknown()).default({}),
  interests: z.array(z.string().max(80)).max(5).default([]),
  skipped: z.array(z.enum(CALL_FIELDS)).max(CALL_FIELDS.length).default([]),
});

const ListenBody = z.object({ language: z.enum(CALL_LANGUAGES).default('hi') });
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

/** The phone-call demo: an IVR conversation in the browser that ends in a match. */
@Controller('call')
export class CallController {
  constructor(
    private readonly calls: CallService,
    private readonly stt: SttService,
  ) {}

  /** One turn of the call: the caller's answer in, the next line (text + voice) out. */
  @Post('turn')
  @HttpCode(200)
  turn(@Body() body: unknown) {
    return this.calls.turn(parse(TurnBody, body));
  }

  /** One spoken answer -> its transcript (no extraction; the next turn does that). */
  @Post('listen')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES } }))
  async listen(@UploadedFile() audio: { buffer: Buffer; mimetype: string } | undefined, @Body() body: unknown) {
    if (!audio?.buffer?.length) throw new BadRequestException('Attach the recording as multipart field "audio"');
    const { language } = parse(ListenBody, body);
    if (!this.stt.available) return { text: '', available: false };
    try {
      const transcript = await this.stt.transcribe(audio.buffer, audio.mimetype, language);
      return { text: transcript.text, available: true };
    } catch {
      // Speech service down or out of credit: the browser switches to its own recogniser.
      return { text: '', available: false };
    }
  }
}
