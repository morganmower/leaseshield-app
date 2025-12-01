/**
 * Environment variable validation and configuration
 * Validates required environment variables on startup to fail fast
 */

interface EnvConfig {
  // Database
  DATABASE_URL: string;
  
  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID?: string;
  
  // OpenAI
  AI_INTEGRATIONS_OPENAI_API_KEY?: string;
  AI_INTEGRATIONS_OPENAI_BASE_URL?: string;
  
  // Email (Resend)
  RESEND_API_KEY?: string;
  
  // LegiScan
  LEGISCAN_API_KEY?: string;
  
  // Application
  NODE_ENV: 'development' | 'production' | 'test';
  PORT?: string;
  REPLIT_DOMAINS?: string;
  
  // Session
  SESSION_SECRET?: string;
}

/**
 * Required environment variables that must be present
 */
const REQUIRED_VARS = [
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
] as const;

/**
 * Optional environment variables with warnings if missing
 */
const OPTIONAL_VARS_WITH_WARNINGS = [
  'STRIPE_WEBHOOK_SECRET',
  'AI_INTEGRATIONS_OPENAI_API_KEY',
  'RESEND_API_KEY',
] as const;

/**
 * Validate environment variables
 * Throws error if required variables are missing
 * Logs warnings for optional but recommended variables
 */
export function validateEnv(): EnvConfig {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Check optional variables with warnings
  for (const varName of OPTIONAL_VARS_WITH_WARNINGS) {
    if (!process.env[varName]) {
      warnings.push(`Missing optional environment variable: ${varName} - some features may not work`);
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('⚠️  Environment variable warnings:');
    warnings.forEach(warning => console.warn(`   ${warning}`));
  }

  // Throw error if required variables are missing
  if (errors.length > 0) {
    console.error('❌ Environment variable errors:');
    errors.forEach(error => console.error(`   ${error}`));
    throw new Error('Missing required environment variables. Please check your .env file.');
  }

  // Use test keys in development if available
  const isDevMode = (process.env.NODE_ENV || 'development') === 'development';
  const stripeSecretKey = isDevMode && process.env.TESTING_STRIPE_SECRET_KEY
    ? process.env.TESTING_STRIPE_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY!;

  // Return typed config
  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    STRIPE_SECRET_KEY: stripeSecretKey,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ID: isDevMode && process.env.TESTING_STRIPE_PRICE_ID
      ? process.env.TESTING_STRIPE_PRICE_ID
      : process.env.STRIPE_PRICE_ID,
    AI_INTEGRATIONS_OPENAI_API_KEY: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    AI_INTEGRATIONS_OPENAI_BASE_URL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    LEGISCAN_API_KEY: process.env.LEGISCAN_API_KEY,
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    PORT: process.env.PORT,
    REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };
}

/**
 * Get environment variable with fallback
 */
export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Environment variable ${key} is not set and no fallback provided`);
  }
  return value;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get application URL
 */
export function getAppUrl(): string {
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    return `https://${domains[0]}`;
  }
  
  const port = process.env.PORT || '5000';
  return `http://localhost:${port}`;
}

/**
 * Validate and export environment configuration
 */
export const env = validateEnv();

