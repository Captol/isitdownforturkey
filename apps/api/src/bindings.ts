import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';

export const EnvSchema = z.object({
  CLOUDFLARE_API_TOKEN: z.string().min(1),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_D1_DATABASE_ID: z.string().min(1),
  PROBE_HMAC_SECRET: z.string().min(32),
  DB: z.any(),
});

export type CloudflareEnvironment = z.infer<typeof EnvSchema>;
