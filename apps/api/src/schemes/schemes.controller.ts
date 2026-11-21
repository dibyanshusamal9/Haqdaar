import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { parse } from '../common/validation';
import { SchemesService } from './schemes.service';

const ListQuery = z.object({
  q: z.string().max(200).optional(),
  level: z.enum(['central', 'state']).optional(),
  state: z.string().max(80).optional(),
  category: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  size: z.coerce.number().int().min(1).max(100).default(24),
});

@Controller('schemes')
export class SchemesController {
  constructor(private readonly schemes: SchemesService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.schemes.list(parse(ListQuery, query));
  }

  @Get('stats')
  stats() {
    return this.schemes.stats();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.schemes.get(slug);
  }
}
