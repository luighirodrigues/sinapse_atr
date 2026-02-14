import { ALLOWED_KPI_KEYS } from '../../config/kpiRegistry';
import { DashboardLayoutDoc } from './types';

type SanitizeOptions = {
  allowedKpiKeys?: Set<string>;
};

const PRIMARY_BREAKPOINTS = ['lg', 'md', 'sm'];

export function sanitizeLayout(input: unknown, options?: SanitizeOptions): DashboardLayoutDoc {
  const allowedKpiKeys = options?.allowedKpiKeys ?? ALLOWED_KPI_KEYS;
  const source = isPlainObject(input) ? input : null;

  if (source && looksLikeLegacyWidgetLayout(source)) {
    return sanitizeLegacyWidgetLayout(source, allowedKpiKeys);
  }

  return sanitizeOrderLayout(source, allowedKpiKeys);
}

function sanitizeOrderLayout(input: Record<string, any> | null, allowedKpiKeys: Set<string>): DashboardLayoutDoc {
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

function sanitizeLegacyWidgetLayout(input: Record<string, any>, allowedKpiKeys: Set<string>): DashboardLayoutDoc {
  const breakpoints = isPlainObject(input.breakpoints) ? input.breakpoints : {};
  const primaryBreakpoint = pickPrimaryBreakpoint(breakpoints);
  const widgets = Array.isArray(breakpoints[primaryBreakpoint]) ? breakpoints[primaryBreakpoint] : [];

  const items: Array<{ kpiKey: string; x: number; y: number; idx: number; hidden: boolean; configOverride?: unknown }> = [];
  for (let i = 0; i < widgets.length; i += 1) {
    const raw = widgets[i];
    if (!isPlainObject(raw)) continue;
    const kpiKey = typeof raw.kpiKey === 'string' ? raw.kpiKey.trim() : '';
    if (!kpiKey || !allowedKpiKeys.has(kpiKey)) continue;

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
  const configOverrides: Record<string, unknown> = {};
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

function sanitizeStringArray(value: unknown, allowedKpiKeys: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = item.trim();
    if (!normalized || !allowedKpiKeys.has(normalized)) continue;
    out.push(normalized);
  }
  return dedupe(out);
}

function sanitizeConfigOverrides(value: unknown, allowedKpiKeys: Set<string>): Record<string, unknown> {
  if (!isPlainObject(value)) return {};
  const output: Record<string, unknown> = {};
  for (const [kpiKey, config] of Object.entries(value)) {
    const normalized = kpiKey.trim();
    if (!normalized || !allowedKpiKeys.has(normalized)) continue;
    output[normalized] = config;
  }
  return output;
}

function pickPrimaryBreakpoint(breakpoints: Record<string, unknown>): string {
  for (const key of PRIMARY_BREAKPOINTS) {
    if (Array.isArray(breakpoints[key])) return key;
  }
  const fallback = Object.keys(breakpoints).find((key) => Array.isArray(breakpoints[key]));
  return fallback ?? 'lg';
}

function looksLikeLegacyWidgetLayout(input: Record<string, any>): boolean {
  return isPlainObject(input.breakpoints);
}

function parseIntWithMin(value: unknown, min: number): number | null {
  if (!Number.isInteger(value)) return null;
  const n = Number(value);
  if (n < min) return null;
  return n;
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}
