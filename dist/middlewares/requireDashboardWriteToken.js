"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDashboardWriteToken = void 0;
const env_1 = require("../config/env");
const requireDashboardWriteToken = (req, res, next) => {
    const token = req.header('x-dashboard-write-token');
    if (!token) {
        return res.status(401).json({ error: 'unauthorized' });
    }
    if (token !== env_1.env.DASHBOARD_WRITE_TOKEN) {
        return res.status(403).json({ error: 'forbidden' });
    }
    return next();
};
exports.requireDashboardWriteToken = requireDashboardWriteToken;
