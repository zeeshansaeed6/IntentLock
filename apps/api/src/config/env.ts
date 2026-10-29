import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4100),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DEMO_MODE: z.enum(['scripted', 'live']).default('scripted'),
  AIRWALLEX_BASE_URL: z.string().url().default('https://api.sandbox.airwallex.com'),
  AIRWALLEX_CLIENT_ID: z.string().optional(),
  AIRWALLEX_API_KEY: z.string().optional(),
  AIRWALLEX_WEBHOOK_SECRET: z.string().optional(),
  LLM_PROVIDER: z.string().default('scripted'),
  LLM_MODEL: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  INTENT_HMAC_SECRET: z.string().min(8, 'INTENT_HMAC_SECRET must be at least 8 characters long'),
  ADMIN_INITIAL_PASSWORD: z.string().min(8, 'ADMIN_INITIAL_PASSWORD must be at least 8 characters long'),
  ADMIN_EMAIL: z.string().email().default('admin@intentlock.io'),
  MONGODB_URI: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnvConfig(source: NodeJS.ProcessEnv = process.env): EnvConfig {
  const isProd = source.NODE_ENV === 'production';
  const target: Record<string, string | undefined> = { ...source };

  if (isProd) {
    const missing: string[] = [];
    if (!target.INTENT_HMAC_SECRET) missing.push('INTENT_HMAC_SECRET');
    if (!target.ADMIN_INITIAL_PASSWORD) missing.push('ADMIN_INITIAL_PASSWORD');
    if (missing.length > 0) {
      throw new Error(`In production, ${missing.join(' and ')} must be set. Process cannot start.`);
    }
  } else {
    // In development / test, generate cryptographically random values at startup if not provided
    if (!target.INTENT_HMAC_SECRET) {
      target.INTENT_HMAC_SECRET = randomBytes(32).toString('hex');
    }
    if (!target.ADMIN_INITIAL_PASSWORD) {
      target.ADMIN_INITIAL_PASSWORD = randomBytes(16).toString('hex');
    }
  }

  const result = envSchema.safeParse(target);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ` - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${issues}`);
  }

  return result.data;
}

export const env = loadEnvConfig(process.env);
