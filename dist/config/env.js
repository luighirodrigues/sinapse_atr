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
    EXTERNAL_API_BASE_URL: zod_1.z.string().trim().url(),
    EXTERNAL_API_TOKEN: zod_1.z.string().trim().optional(),
    IMPORT_START_AT: zod_1.z.string().trim().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid date format for IMPORT_START_AT',
    }),
    PORT: zod_1.z.string().default('3000').transform((val) => parseInt(val, 10)),
});
exports.env = envSchema.parse(process.env);
