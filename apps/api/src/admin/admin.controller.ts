import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parse } from '../common/validation';
import { AdminGuard } from './admin.guard';
import { AdminService, SchemeEdit } from './admin.service';

const Page = z.coerce.number().int().min(1).max(10_000).default(1);

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Lets the console check a code without side effects. */
  @Get('session')
  session() {
    return { ok: true };
  }

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('runs')
  runs() {
    return this.admin.runs();
  }

  /** mode=refresh scrapes myscheme.gov.in then ingests; mode=ingest re-normalises the cache. */
  @Post('runs')
  @HttpCode(202)
  startRun(@Body() body: unknown) {
    const { mode } = parse(z.object({ mode: z.enum(['refresh', 'ingest']).default('refresh') }), body ?? {});
    return this.admin.startRun(mode);
  }

  @Get('review')
  review(@Query() query: unknown) {
    const q = parse(
      z.object({ status: z.enum(['flagged', 'auto', 'approved', 'edited', 'all']).default('flagged'), page: Page, q: z.string().max(200).optional() }),
      query,
    );
    return this.admin.reviewQueue(q.status, q.page, q.q);
  }

  @Patch('schemes/:slug')
  edit(@Param('slug') slug: string, @Body() body: unknown) {
    return this.admin.editScheme(slug, parse(SchemeEdit, body));
  }

  @Get('matches')
  matches(@Query() query: unknown) {
    return this.admin.matches(parse(z.object({ page: Page }), query).page);
  }

  /** Re-runs a logged match against today's corpus to demonstrate reproducibility (NFR-01). */
  @Get('matches/:id/replay')
  replay(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.replay(id);
  }
}
