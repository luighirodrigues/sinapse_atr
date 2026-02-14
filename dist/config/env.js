"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().trim().url(),
    IMPORT_START_AT: zod_1.z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid date format for IMPORT_START_AT',
    }),
    EXTERNAL_API_REQUESTS_PER_MINUTE: zod_1.z.coerce.number().int().min(1).max(60).default(50),
    PORT: zod_1.z.string().default('3000').transform((val) => parseInt(val, 10)),
    ADMIN_TOKEN: zod_1.z.string().trim().min(1, "ADMIN_TOKEN is required"),
    DASHBOARD_WRITE_TOKEN: zod_1.z.string().trim().min(1, 'DASHBOARD_WRITE_TOKEN is required'),
    DASHBOARD_INSECURE_USER_HEADER: zod_1.z.enum(['true', 'false']).default('false'),
    OPENAI_API_KEY: zod_1.z.string().trim().min(1).optional(),
    OPENAI_MODEL: zod_1.z.string().trim().min(1).optional(),
});
exports.env = envSchema.parse(process.env);
