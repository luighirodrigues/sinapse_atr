"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TicketImportService_1 = require("./services/TicketImportService");
const client_1 = require("./prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function main() {
    const args = process.argv.slice(2);
    const slug = args[0];
    const service = new TicketImportService_1.TicketImportService();
    try {
        if (slug) {
            console.log(`Starting import for client: ${slug}`);
            await service.runImport(slug);
        }
        else {
            console.log('Starting import for ALL active clients');
            await service.runImport();
        }
        console.log('Job completed successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('Job failed:', error);
        process.exit(1);
    }
    finally {
        await client_1.prisma.$disconnect();
    }
}
main();
