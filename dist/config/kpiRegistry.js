"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_KPI_KEYS = exports.KPI_REGISTRY = void 0;
exports.isAllowedKpiKey = isAllowedKpiKey;
exports.getKpiRegistryByKey = getKpiRegistryByKey;
exports.KPI_REGISTRY = [
    { kpiKey: 'avg-first-response-time', label: 'Avg First Response Time', defaultOrder: 10 },
    { kpiKey: 'avg-session-duration-by-tag', label: 'Avg Session Duration by Tag', defaultOrder: 20 },
    { kpiKey: 'top-slowest-sessions-by-tag', label: 'Top Slowest Sessions by Tag', defaultOrder: 30 },
    { kpiKey: 'consolidated-sales-summary', label: 'Consolidated Sales Summary', defaultOrder: 40 },
    { kpiKey: 'consolidated-sales-daily', label: 'Consolidated Sales Daily', defaultOrder: 50 },
    { kpiKey: 'consolidated-sales-sellers', label: 'Consolidated Sales Sellers', defaultOrder: 60 },
    { kpiKey: 'session-analyses-summary', label: 'Session Analyses Summary', defaultOrder: 70 },
    { kpiKey: 'session-analyses-ranking', label: 'Session Analyses Ranking', defaultOrder: 80 },
    { kpiKey: 'session-analyses-details', label: 'Session Analyses Details', defaultOrder: 90 },
];
exports.ALLOWED_KPI_KEYS = new Set(exports.KPI_REGISTRY.map((item) => item.kpiKey));
function isAllowedKpiKey(value) {
    return typeof value === 'string' && exports.ALLOWED_KPI_KEYS.has(value);
}
function getKpiRegistryByKey(kpiKey) {
    return exports.KPI_REGISTRY.find((item) => item.kpiKey === kpiKey) ?? null;
}
