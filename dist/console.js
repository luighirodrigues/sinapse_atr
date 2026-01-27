"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TicketImportService_1 = require("./services/TicketImportService");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function main() {
    const service = new TicketImportService_1.TicketImportService();
    try {
        await service.runImport();
        console.log('Job completed successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('Job failed:', error);
        process.exit(1);
    }
}
main();
