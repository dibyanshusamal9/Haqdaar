import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/** Parses a request body/query with zod; a failure becomes a 400 naming each bad field. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const res = schema.safeParse(input);
  if (res.success) return res.data;
  throw new BadRequestException({
    message: 'Invalid request',
    errors: res.error.issues.map((i) => ({ field: i.path.join('.') || '(body)', message: i.message })),
  });
}
