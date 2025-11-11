import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable cookie parser
  app.use(cookieParser());

  // Enable CORS for frontend communication
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3002',
  ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Enable global validation pipe with transform so incoming payloads are
  // converted to DTO classes and types (e.g., numbers) are coerced.
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Create super admin on startup
  const authService = app.get(AuthService);
  await authService.createSuperAdmin();

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
void bootstrap();
