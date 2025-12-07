import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import cookieParser from 'cookie-parser';
import {
  validateEnvironment,
  getRequiredEnv,
  getOptionalEnv,
} from './config/env.validation';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  // Validate environment variables before starting the application
  try {
    validateEnvironment();
  } catch (error) {
    Logger.error(error.message);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:
      getRequiredEnv('NODE_ENV') === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Configure static file serving for uploads
  const uploadDir = getOptionalEnv('UPLOAD_DIR', 'uploads') || 'uploads';
  const absoluteUploadDir = path.isAbsolute(uploadDir)
    ? uploadDir
    : path.join(process.cwd(), uploadDir);

  // Ensure upload directory exists
  if (!fs.existsSync(absoluteUploadDir)) {
    fs.mkdirSync(absoluteUploadDir, { recursive: true });
    Logger.log(`Created upload directory: ${absoluteUploadDir}`);
  }

  // Serve static files from uploads directory
  // app.useStaticAssets(absoluteUploadDir, {
  //   prefix: '/uploads/',
  // });
  // Logger.log(`📁 Serving uploads from: ${absoluteUploadDir}`);

  // Enable cookie parser
  app.use(cookieParser());

  // Enable CORS for frontend communication
  const corsOrigins = getRequiredEnv('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
  });

  // Enable global validation pipe with transform so incoming payloads are
  // converted to DTO classes and types (e.g., numbers) are coerced.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter to standardize error responses and log unique error IDs
  app.useGlobalFilters(new AllExceptionsFilter());

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (getRequiredEnv('NODE_ENV') === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  });

  // Create super admin on startup
  const authService = app.get(AuthService);
  await authService.createSuperAdmin();

  const port = parseInt(getRequiredEnv('PORT'), 10);
  const host = getRequiredEnv('HOST');
  await app.listen(port, host);
  Logger.log(`🚀 Application is running on port: ${port}`);
  Logger.log(`🌍 Environment: ${getRequiredEnv('NODE_ENV')}`);
  Logger.log(
    `💾 Database: ${getRequiredEnv('DB_HOST')}:${getRequiredEnv('DB_PORT')}`,
  );
}
void bootstrap();
