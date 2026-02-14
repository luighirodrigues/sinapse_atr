import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLayout } from '../../src/services/dashboard/mergeLayout';
import { AllowedKpiConfig, DashboardLayoutDoc } from '../../src/services/dashboard/types';

const allowedBase: AllowedKpiConfig[] = [
  { kpiKey: 'avg-first-response-time', defaultVisible: true, defaultConfig: null, locked: false, defaultOrder: 10 },
  { kpiKey: 'avg-session-duration-by-tag', defaultVisible: true, defaultConfig: null, locked: false, defaultOrder: 20 },
];

function layout(input?: Partial<DashboardLayoutDoc>): DashboardLayoutDoc {
  return {
    version: 1,
    type: 'ORDER',
    order: input?.order ?? [],
    hidden: input?.hidden ?? [],
    configOverrides: input?.configOverrides ?? {},
  };
}

test('adds newly allowed KPI when missing from layouts', () => {
  const result = mergeLayout({
    tenantDefaultLayout: layout({ order: ['avg-first-response-time'] }),
    userLayout: null,
    allowedKpis: [
      ...allowedBase,
      { kpiKey: 'top-slowest-sessions-by-tag', defaultVisible: true, defaultConfig: null, locked: false, defaultOrder: 30 },
    ],
  });

  assert.deepEqual(result.order, ['avg-first-response-time', 'avg-session-duration-by-tag', 'top-slowest-sessions-by-tag']);
});

test('removes KPI that is no longer allowed', () => {
  const result = mergeLayout({
    tenantDefaultLayout: layout({ order: ['avg-first-response-time', 'top-slowest-sessions-by-tag'] }),
    userLayout: null,
    allowedKpis: allowedBase,
  });

  assert.deepEqual(result.order, ['avg-first-response-time', 'avg-session-duration-by-tag']);
});

test('locked KPI ignores user reorder/hide/config override', () => {
  const result = mergeLayout({
    tenantDefaultLayout: layout({
      order: ['avg-first-response-time', 'avg-session-duration-by-tag'],
      hidden: [],
      configOverrides: { 'avg-first-response-time': { source: 'tenant' } },
    }),
    userLayout: layout({
      order: ['avg-session-duration-by-tag', 'avg-first-response-time'],
      hidden: ['avg-first-response-time'],
      configOverrides: {
        'avg-first-response-time': { source: 'user' },
        'avg-session-duration-by-tag': { source: 'user' },
      },
    }),
    allowedKpis: [{ ...allowedBase[0], locked: true }, { ...allowedBase[1], locked: false }],
  });

  assert.deepEqual(result.order, ['avg-first-response-time', 'avg-session-duration-by-tag']);
  assert.equal(result.hidden.includes('avg-first-response-time'), false);
  assert.deepEqual(result.configOverrides['avg-first-response-time'], { source: 'tenant' });
});

test('uses tenant default when user layout does not exist', () => {
  const tenantDefault = layout({
    order: ['avg-session-duration-by-tag', 'avg-first-response-time'],
    hidden: ['avg-session-duration-by-tag'],
  });
  const result = mergeLayout({
    tenantDefaultLayout: tenantDefault,
    userLayout: null,
    allowedKpis: allowedBase,
  });

  assert.deepEqual(result.order, ['avg-session-duration-by-tag', 'avg-first-response-time']);
  assert.deepEqual(result.hidden, ['avg-session-duration-by-tag']);
});

test('builds base layout when tenant default does not exist', () => {
  const result = mergeLayout({
    tenantDefaultLayout: null,
    userLayout: null,
    allowedKpis: allowedBase,
  });

  assert.deepEqual(result.order, [
    'avg-first-response-time',
    'avg-session-duration-by-tag',
  ]);
  assert.deepEqual(result.hidden, []);
  assert.equal(result.type, 'ORDER');
});
