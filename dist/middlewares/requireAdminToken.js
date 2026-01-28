"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminToken = void 0;
const env_1 = require("../config/env");
const requireAdminToken = (req, res, next) => {
    const token = req.header('x-admin-token');
    if (token === env_1.env.ADMIN_TOKEN) {
        return next();
    }
    res.status(401).json({ error: 'unauthorized' });
};
exports.requireAdminToken = requireAdminToken;
