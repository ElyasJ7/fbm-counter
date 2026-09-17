import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALLOWED_SAME_SITE = new Set(['lax', 'strict', 'none']);

/**
 * Validates auth/cookie configuration at startup.
 * SameSite=None requires Secure cookies; CSRF tokens are required before
 * allowing SameSite=None (not implemented — mode is rejected).
 */
@Injectable()
export class AuthConfigValidator implements OnModuleInit {
  private readonly logger = new Logger(AuthConfigValidator.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const sameSiteRaw = (
      this.config.get<string>('COOKIE_SAME_SITE') ?? 'lax'
    ).toLowerCase();
    if (!ALLOWED_SAME_SITE.has(sameSiteRaw)) {
      throw new Error(
        `Invalid COOKIE_SAME_SITE="${sameSiteRaw}". Allowed: lax, strict, none`,
      );
    }

    const secureExplicit = this.config.get<string>('COOKIE_SECURE');
    const secure =
      secureExplicit === 'true'
        ? true
        : secureExplicit === 'false'
          ? false
          : this.config.get<string>('NODE_ENV') === 'production';

    if (sameSiteRaw === 'none') {
      // Double-submit / synchronizer CSRF is not implemented yet.
      // Refuse unsafe cross-site cookie mode until CSRF hardening lands.
      throw new Error(
        'COOKIE_SAME_SITE=none is not supported until explicit CSRF protection is enabled. Use lax or strict.',
      );
    }

    if (sameSiteRaw === 'none' && !secure) {
      throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
    }

    this.logger.log(
      JSON.stringify({
        msg: 'cookie_policy',
        sameSite: sameSiteRaw,
        secure,
        csrf: 'sameSite-lax-or-strict',
        note: 'CSRF mitigated by SameSite cookies; SameSite=none blocked until CSRF tokens exist',
      }),
    );
  }
}
