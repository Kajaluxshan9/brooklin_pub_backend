/**
 * Environment Configuration Validator
 * This module validates that all required environment variables are present
 * and throws descriptive errors if any are missing.
 */

import { Logger } from '@nestjs/common';

interface EnvConfig {
  // Server
  NODE_ENV: string;
  PORT: string;

  // Database
  DB_HOST: string;
  DB_PORT: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;

  // JWT & Security
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BCRYPT_SALT_ROUNDS: string;
  COOKIE_MAX_AGE: string;

  // CORS
  CORS_ORIGINS: string;

  // Email
  EMAIL_HOST: string;
  EMAIL_PORT: string;
  EMAIL_USER: string;
  EMAIL_PASS: string;
  EMAIL_FROM: string;

  // Frontend
  FRONTEND_URL: string;
  PASSWORD_RESET_PATH?: string;

  // AWS S3
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_S3_BUCKET_NAME: string;
}

const REQUIRED_ENV_VARS: (keyof EnvConfig)[] = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'BCRYPT_SALT_ROUNDS',
  'COOKIE_MAX_AGE',
  'CORS_ORIGINS',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_FROM',
  'FRONTEND_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'AWS_S3_BUCKET_NAME',
];

const OPTIONAL_ENV_VARS: (keyof EnvConfig)[] = ['PASSWORD_RESET_PATH'];

/**
 * Validates environment variables and throws an error if required ones are missing
 */
export function validateEnvironment(): void {
  const missingVars: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // Check for weak JWT secret
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push(
      '⚠️  JWT_SECRET is less than 32 characters. Consider using a stronger secret.',
    );
  }

  // Check for production-specific requirements
  if (process.env.NODE_ENV === 'production') {
    if (
      process.env.CORS_ORIGINS &&
      process.env.CORS_ORIGINS.includes('localhost')
    ) {
      warnings.push(
        '⚠️  CORS_ORIGINS contains localhost in production environment.',
      );
    }

    if (process.env.DB_HOST === 'localhost') {
      warnings.push('⚠️  DB_HOST is set to localhost in production.');
    }
  }

  // Print warnings
  if (warnings.length > 0) {
    Logger.warn('\n⚠️  Environment Configuration Warnings:');
    warnings.forEach((warning) => Logger.warn(`   ${warning}`));
    Logger.warn('');
  }

  // Throw error if required variables are missing
  if (missingVars.length > 0) {
    const errorMessage = `
╔════════════════════════════════════════════════════════════════════╗
║                  MISSING ENVIRONMENT VARIABLES                     ║
╚════════════════════════════════════════════════════════════════════╝

The following required environment variables are not set:

${missingVars.map((v) => `  ❌ ${v}`).join('\n')}

Please ensure all required variables are defined in your .env file.
Refer to .env.example or .env.production for the complete list.

Optional variables:
${OPTIONAL_ENV_VARS.map((v) => `  📝 ${v}`).join('\n')}

════════════════════════════════════════════════════════════════════
`;
    throw new Error(errorMessage);
  }

  // Success message
  Logger.log('✅ Environment variables validated successfully');
  Logger.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  Logger.log(`   Database: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  Logger.log(`   Frontend: ${process.env.FRONTEND_URL}`);
  Logger.log('');
}

/**
 * Get environment variable with validation
 */
export function getRequiredEnv(key: keyof EnvConfig): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Environment variable ${key} is required but not set. Please check your .env file.`,
    );
  }
  return value;
}

/**
 * Get environment variable with optional fallback
 */
export function getOptionalEnv(
  key: keyof EnvConfig,
  fallback?: string,
): string | undefined {
  return process.env[key] || fallback;
}
