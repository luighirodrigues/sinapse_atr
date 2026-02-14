"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDashboardUserId = resolveDashboardUserId;
const env_1 = require("../../config/env");
function resolveDashboardUserId(req) {
    if (env_1.env.DASHBOARD_INSECURE_USER_HEADER !== 'true') {
        return null;
    }
    const value = req.header('x-user-id');
    if (!value)
        return null;
    const normalized = value.trim();
    return normalized ? normalized : null;
}
