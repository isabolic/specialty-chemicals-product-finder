import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

/** Shared by main.ts and the HTTP tests, so tests exercise the real pipeline. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  // Behind nginx in Docker: use X-Forwarded-For for the rate limiter's client IP.
  (app as NestExpressApplication).set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
