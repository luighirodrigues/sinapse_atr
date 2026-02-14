import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().trim().url(),
  IMPORT_START_AT: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format for IMPORT_START_AT',
  }),
  EXTERNAL_API_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(60).default(50),
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  ADMIN_TOKEN: z.string().trim().min(1, "ADMIN_TOKEN is required"),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_MODEL: z.string().trim().min(1).optional(),
});

export const env = envSchema.parse(process.env);
