import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { parse } from '../common/validation';
import { MatchService } from './match.service';

const MatchBody = z.object({
  profile: z.record(z.string(), z.unknown()),
  inputMode: z.enum(['form', 'voice', 'text']).default('form'),
});

@Controller('match')
export class MatchController {
  constructor(private readonly matcher: MatchService) {}

  /** UC-04 "Find my schemes": the confirmed profile in, ranked schemes with reasons out. */
  @Post()
  @HttpCode(200)
  match(@Body() body: unknown) {
    const { profile, inputMode } = parse(MatchBody, body);
    return this.matcher.match(profile, inputMode);
  }
}
