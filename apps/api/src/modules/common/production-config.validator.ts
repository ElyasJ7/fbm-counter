import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateProductionEnv } from './production-config.logic';

/**
 * Fail-fast production configuration validation at Nest bootstrap.
 */
@Injectable()
export class ProductionConfigValidator implements OnModuleInit {
  private readonly logger = new Logger(ProductionConfigValidator.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const env = {
      NODE_ENV: this.config.get<string>('NODE_ENV'),
      DATABASE_URL: this.config.get<string>('DATABASE_URL'),
      JWT_ACCESS_SECRET: this.config.get<string>('JWT_ACCESS_SECRET'),
      CORS_ORIGIN: this.config.get<string>('CORS_ORIGIN'),
      ALLOW_SEED: this.config.get<string>('ALLOW_SEED'),
      COOKIE_SECURE: this.config.get<string>('COOKIE_SECURE'),
      COOKIE_SAME_SITE: this.config.get<string>('COOKIE_SAME_SITE'),
      STORAGE_DRIVER: this.config.get<string>('STORAGE_DRIVER'),
      S3_BUCKET: this.config.get<string>('S3_BUCKET'),
      S3_ENDPOINT: this.config.get<string>('S3_ENDPOINT'),
      S3_ACCESS_KEY_ID: this.config.get<string>('S3_ACCESS_KEY_ID'),
      S3_SECRET_ACCESS_KEY: this.config.get<string>('S3_SECRET_ACCESS_KEY'),
      TRUST_PROXY: this.config.get<string>('TRUST_PROXY'),
    };

    const result = validateProductionEnv(env);
    if (!result.ok) {
      throw new Error(result.error);
    }
    for (const warning of result.warnings) {
      this.logger.warn(
        JSON.stringify({ msg: 'production_config_warning', warning }),
      );
    }
    if ((env.NODE_ENV ?? '').toLowerCase() === 'production') {
      this.logger.log(
        JSON.stringify({
          msg: 'production_config_ok',
          storageDriver: env.STORAGE_DRIVER ?? 'local',
          sameSite: env.COOKIE_SAME_SITE ?? 'lax',
          trustProxy: env.TRUST_PROXY === 'true' || env.TRUST_PROXY === '1',
        }),
      );
    }
  }
}
