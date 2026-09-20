import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const prefix = config.get<string>('API_PREFIX') ?? 'api';
  app.setGlobalPrefix(prefix);

  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy === 'true' || trustProxy === '1') {
    const expressApp = app.getHttpAdapter().getInstance() as {
      set: (key: string, value: unknown) => void;
    };
    expressApp.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cookieParser());

  const corsOrigin =
    config.get<string>('CORS_ORIGIN') ??
    'http://localhost:5173,http://127.0.0.1:5173';
  app.enableCors({
    origin: corsOrigin.split(',').map((value) => value.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(config.get<string>('API_PORT') ?? 3001);
  await app.listen(port);
  logger.log(`FBM API listening on http://localhost:${port}/${prefix}`);
}

void bootstrap();
