import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
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
  INTENT_HMAC_SECRET: z.string().min(8).default('dev-only-intentlock-secret'),
  MONGODB_URI: z.string().optional(),
});

export const env = envSchema.parse(process.env);
