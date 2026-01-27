import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().trim().url(),
  IMPORT_START_AT: z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format for IMPORT_START_AT',
  }),
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  ADMIN_TOKEN: z.string().trim().min(1, "ADMIN_TOKEN is required"),
});

export const env = envSchema.parse(process.env);
