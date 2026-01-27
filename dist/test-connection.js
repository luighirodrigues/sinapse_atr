"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const baseURL = 'https://atende-api.corz.com.br/api';
const token = 'fW7ZZvNoXHR5k5g172xpF2hBSp1bOWX2McZvyR_6K5M';
async function test() {
    console.log('Testing connection to:', baseURL);
    console.log('Token:', token);
    try {
        const response = await axios_1.default.get(`${baseURL}/ticket`, {
            headers: {
                'api-key': token.trim()
            },
            params: { limit: 1 }
        });
        console.log('Success!');
        console.log('Status:', response.status);
        console.log('Data sample:', JSON.stringify(response.data).substring(0, 100));
    }
    catch (error) {
        console.error('Connection failed!');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
        if (error.cause) {
            console.error('Cause:', error.cause);
        }
    }
}
test();
