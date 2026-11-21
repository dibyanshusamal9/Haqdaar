import { BadRequestException, Body, Controller, Get, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { parse } from '../common/validation';
import {
  CASTES, EMPLOYMENT_STATUSES, GENDERS, LABELS, MARITAL_STATUSES, OCCUPATIONS, Profile, REQUIRED_FIELDS,
  RESIDENCES, STATES,
} from '../domain/profile';
import { Extraction, ExtractorService } from './extractor.service';
import { SttService } from './stt.service';

/** The parts of a multer file this controller reads. */
interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
}

const TextBody = z.object({ text: z.string().min(1).max(4000) });
const VoiceBody = z.object({ language: z.string().max(5).optional() });
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

@Controller('profile')
export class ProfileController {
  constructor(
    private readonly stt: SttService,
    private readonly extractor: ExtractorService,
  ) {}

  /** Everything the form needs: fields, allowed values, labels, and which input modes work. */
  @Get('schema')
  schema() {
    return {
      required: REQUIRED_FIELDS,
      options: {
        gender: options(GENDERS, LABELS.gender),
        state: STATES.map((s) => ({ value: s, label: s })),
        residence: options(RESIDENCES, LABELS.residence),
        caste: options(CASTES, LABELS.caste),
        marital_status: options(MARITAL_STATUSES, LABELS.marital_status),
        employment_status: options(EMPLOYMENT_STATUSES, LABELS.employment_status),
        occupation: options(OCCUPATIONS, LABELS.occupation),
      },
      capabilities: { voice: this.stt.available, llm: this.extractor.llmAvailable },
    };
  }

  /** Free text -> profile fields (the same extraction voice uses, minus STT). */
  @Post('extract')
  @HttpCode(200)
  async extract(@Body() body: unknown) {
    const { text } = parse(TextBody, body);
    return this.respond(text, null, await this.extractor.extract(text));
  }

  /** UC-02: recorded speech -> transcript -> profile fields, ready for review. */
  @Post('voice')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES } }))
  async voice(@UploadedFile() audio: UploadedAudio | undefined, @Body() body: unknown) {
    if (!audio?.buffer?.length) throw new BadRequestException('Attach the recording as multipart field "audio"');
    const { language } = parse(VoiceBody, body);
    const transcript = await this.stt.transcribe(audio.buffer, audio.mimetype, language);
    if (!transcript.text) {
      return { ...this.respond('', transcript.languageCode, { fields: {}, provider: 'rules', dropped: [] }),
        warning: 'We could not hear any words in that recording. Try again closer to the microphone, or type instead.' };
    }
    return this.respond(transcript.text, transcript.languageCode, await this.extractor.extract(transcript.text));
  }

  private respond(transcript: string, languageCode: string | null, ex: Extraction) {
    const filled = Object.keys(ex.fields) as (keyof Profile)[];
    return {
      transcript,
      languageCode,
      fields: ex.fields,
      filled,
      missingRequired: REQUIRED_FIELDS.filter((f) => !filled.includes(f)),
      dropped: ex.dropped,
      extractor: ex.provider,
      warning: ex.warning ?? null,
    };
  }
}
