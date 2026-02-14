import { DashboardLayoutDoc, AllowedKpiConfig } from './types';

type MergeLayoutInput = {
  tenantDefaultLayout: DashboardLayoutDoc | null;
  userLayout: DashboardLayoutDoc | null;
  allowedKpis: AllowedKpiConfig[];
};

export function mergeLayout(input: MergeLayoutInput): DashboardLayoutDoc {
  const allowedSorted = [...input.allowedKpis].sort((a, b) => a.defaultOrder - b.defaultOrder || a.kpiKey.localeCompare(b.kpiKey));
  const allowedKeys = new Set<string>(allowedSorted.map((item) => item.kpiKey));
  const lockedKeys = new Set<string>(allowedSorted.filter((item) => item.locked).map((item) => item.kpiKey));

  const baseLayout = input.tenantDefaultLayout ?? buildBaseLayout(allowedSorted);
  const baseOrder = completeOrder(baseLayout.order, allowedSorted);
  const order = applyUserOrder({
    baseOrder,
    userOrder: input.userLayout?.order ?? [],
    lockedKeys,
    allowedKeys,
  });

  const baseHidden = buildBaseHidden(baseLayout.hidden, allowedSorted, input.tenantDefaultLayout !== null);
  const hidden = applyUserHidden({
    baseHidden,
    userHidden: input.userLayout?.hidden ?? [],
    hasUserLayout: input.userLayout !== null,
    lockedKeys,
    allowedKeys,
  });

  const configOverrides = mergeConfigOverrides({
    tenantConfig: baseLayout.configOverrides,
    userConfig: input.userLayout?.configOverrides ?? {},
    lockedKeys,
    allowedKeys,
  });

  return {
    version: 1,
    type: 'ORDER',
    order,
    hidden,
    configOverrides,
  };
}

export function buildBaseLayout(allowedKpis: AllowedKpiConfig[]): DashboardLayoutDoc {
  const sorted = [...allowedKpis].sort((a, b) => a.defaultOrder - b.defaultOrder || a.kpiKey.localeCompare(b.kpiKey));
  return {
    version: 1,
    type: 'ORDER',
    order: sorted.map((item) => item.kpiKey),
    hidden: sorted.filter((item) => !item.defaultVisible).map((item) => item.kpiKey),
    configOverrides: {},
  };
}

function completeOrder(seedOrder: string[], allowedSorted: AllowedKpiConfig[]): string[] {
  const allowedSet = new Set<string>(allowedSorted.map((item) => item.kpiKey));
  const normalizedSeed = dedupe(seedOrder.filter((kpiKey) => allowedSet.has(kpiKey)));
  const missing = allowedSorted.map((item) => item.kpiKey).filter((kpiKey) => !normalizedSeed.includes(kpiKey));
  return [...normalizedSeed, ...missing];
}

function applyUserOrder(input: {
  baseOrder: string[];
  userOrder: string[];
  lockedKeys: Set<string>;
  allowedKeys: Set<string>;
}): string[] {
  const userOrder = dedupe(input.userOrder.filter((kpiKey) => input.allowedKeys.has(kpiKey) && !input.lockedKeys.has(kpiKey)));
  const baseNonLocked = input.baseOrder.filter((kpiKey) => !input.lockedKeys.has(kpiKey));
  const tailNonLocked = baseNonLocked.filter((kpiKey) => !userOrder.includes(kpiKey));
  const reorderedNonLocked = [...userOrder, ...tailNonLocked];

  let cursor = 0;
  const merged = input.baseOrder.map((kpiKey) => {
    if (input.lockedKeys.has(kpiKey)) return kpiKey;
    const next = reorderedNonLocked[cursor];
    cursor += 1;
    return next;
  });

  const missing = Array.from(input.allowedKeys).filter((kpiKey) => !merged.includes(kpiKey));
  return [...merged, ...missing];
}

function buildBaseHidden(baseHidden: string[], allowedSorted: AllowedKpiConfig[], hasTenantDefault: boolean): Set<string> {
  const allowed = new Set<string>(allowedSorted.map((item) => item.kpiKey));
  const normalizedBase = dedupe(baseHidden.filter((kpiKey) => allowed.has(kpiKey)));
  if (hasTenantDefault) return new Set(normalizedBase);

  return new Set(
    allowedSorted
      .filter((item) => !item.defaultVisible)
      .map((item) => item.kpiKey)
      .filter((kpiKey) => allowed.has(kpiKey))
  );
}

function applyUserHidden(input: {
  baseHidden: Set<string>;
  userHidden: string[];
  hasUserLayout: boolean;
  lockedKeys: Set<string>;
  allowedKeys: Set<string>;
}): string[] {
  const next = new Set<string>(input.baseHidden);
  if (!input.hasUserLayout) {
    return Array.from(next);
  }
  const userHiddenSet = new Set(dedupe(input.userHidden.filter((kpiKey) => input.allowedKeys.has(kpiKey))));

  for (const kpiKey of input.allowedKeys) {
    if (input.lockedKeys.has(kpiKey)) continue;
    if (userHiddenSet.has(kpiKey)) {
      next.add(kpiKey);
    } else {
      next.delete(kpiKey);
    }
  }

  return Array.from(next);
}

function mergeConfigOverrides(input: {
  tenantConfig: Record<string, unknown>;
  userConfig: Record<string, unknown>;
  lockedKeys: Set<string>;
  allowedKeys: Set<string>;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [kpiKey, value] of Object.entries(input.tenantConfig)) {
    if (!input.allowedKeys.has(kpiKey)) continue;
    out[kpiKey] = value;
  }

  for (const [kpiKey, value] of Object.entries(input.userConfig)) {
    if (!input.allowedKeys.has(kpiKey)) continue;
    if (input.lockedKeys.has(kpiKey)) continue;
    out[kpiKey] = value;
  }

  return out;
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
