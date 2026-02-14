"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeLayout = sanitizeLayout;
const kpiRegistry_1 = require("../../config/kpiRegistry");
const PRIMARY_BREAKPOINTS = ['lg', 'md', 'sm'];
function sanitizeLayout(input, options) {
    const allowedKpiKeys = options?.allowedKpiKeys ?? kpiRegistry_1.ALLOWED_KPI_KEYS;
    const source = isPlainObject(input) ? input : null;
    if (source && looksLikeLegacyWidgetLayout(source)) {
        return sanitizeLegacyWidgetLayout(source, allowedKpiKeys);
    }
    return sanitizeOrderLayout(source, allowedKpiKeys);
}
function sanitizeOrderLayout(input, allowedKpiKeys) {
    const sourceVersion = input?.version;
    const version = Number.isInteger(sourceVersion) && Number(sourceVersion) > 0 ? Number(sourceVersion) : 1;
    const order = sanitizeStringArray(input?.order, allowedKpiKeys);
    const hidden = sanitizeStringArray(input?.hidden, allowedKpiKeys);
    const configOverrides = sanitizeConfigOverrides(input?.configOverrides, allowedKpiKeys);
    return {
        version,
        type: 'ORDER',
        order,
        hidden,
        configOverrides,
    };
}
function sanitizeLegacyWidgetLayout(input, allowedKpiKeys) {
    const breakpoints = isPlainObject(input.breakpoints) ? input.breakpoints : {};
    const primaryBreakpoint = pickPrimaryBreakpoint(breakpoints);
    const widgets = Array.isArray(breakpoints[primaryBreakpoint]) ? breakpoints[primaryBreakpoint] : [];
    const items = [];
    for (let i = 0; i < widgets.length; i += 1) {
        const raw = widgets[i];
        if (!isPlainObject(raw))
            continue;
        const kpiKey = typeof raw.kpiKey === 'string' ? raw.kpiKey.trim() : '';
        if (!kpiKey || !allowedKpiKeys.has(kpiKey))
            continue;
        const x = parseIntWithMin(raw.x, 0) ?? 0;
        const y = parseIntWithMin(raw.y, 0) ?? 0;
        const hidden = raw.isVisible === false;
        items.push({
            kpiKey,
            x,
            y,
            idx: i,
            hidden,
            ...(Object.prototype.hasOwnProperty.call(raw, 'configOverride') ? { configOverride: raw.configOverride } : {}),
        });
    }
    items.sort((a, b) => a.y - b.y || a.x - b.x || a.idx - b.idx);
    const order = dedupe(items.map((item) => item.kpiKey));
    const hidden = dedupe(items.filter((item) => item.hidden).map((item) => item.kpiKey));
    const configOverrides = {};
    for (const item of items) {
        if (Object.prototype.hasOwnProperty.call(item, 'configOverride')) {
            configOverrides[item.kpiKey] = item.configOverride;
        }
    }
    return {
        version: 1,
        type: 'ORDER',
        order: order.filter((kpiKey) => allowedKpiKeys.has(kpiKey)),
        hidden: hidden.filter((kpiKey) => allowedKpiKeys.has(kpiKey)),
        configOverrides,
    };
}
function sanitizeStringArray(value, allowedKpiKeys) {
    if (!Array.isArray(value))
        return [];
    const out = [];
    for (const item of value) {
        if (typeof item !== 'string')
            continue;
        const normalized = item.trim();
        if (!normalized || !allowedKpiKeys.has(normalized))
            continue;
        out.push(normalized);
    }
    return dedupe(out);
}
function sanitizeConfigOverrides(value, allowedKpiKeys) {
    if (!isPlainObject(value))
        return {};
    const output = {};
    for (const [kpiKey, config] of Object.entries(value)) {
        const normalized = kpiKey.trim();
        if (!normalized || !allowedKpiKeys.has(normalized))
            continue;
        output[normalized] = config;
    }
    return output;
}
function pickPrimaryBreakpoint(breakpoints) {
    for (const key of PRIMARY_BREAKPOINTS) {
        if (Array.isArray(breakpoints[key]))
            return key;
    }
    const fallback = Object.keys(breakpoints).find((key) => Array.isArray(breakpoints[key]));
    return fallback ?? 'lg';
}
function looksLikeLegacyWidgetLayout(input) {
    return isPlainObject(input.breakpoints);
}
function parseIntWithMin(value, min) {
    if (!Number.isInteger(value))
        return null;
    const n = Number(value);
    if (n < min)
        return null;
    return n;
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function dedupe(list) {
    const seen = new Set();
    const out = [];
    for (const item of list) {
        if (seen.has(item))
            continue;
        seen.add(item);
        out.push(item);
    }
    return out;
}
