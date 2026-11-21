import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config';

/** Curator endpoints need the shared ADMIN_ACCESS_CODE in the x-admin-code header. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const expected = config.adminAccessCode;
    if (!expected) throw new ServiceUnavailableException('Admin access is disabled: set ADMIN_ACCESS_CODE in .env');
    const given = String(ctx.switchToHttp().getRequest().headers['x-admin-code'] ?? '');
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Wrong admin access code');
    return true;
  }
}
