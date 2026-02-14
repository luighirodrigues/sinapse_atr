export type DashboardLayoutDoc = {
  version: number;
  type: 'ORDER';
  order: string[];
  hidden: string[];
  configOverrides: Record<string, unknown>;
};

export type AllowedKpiConfig = {
  kpiKey: string;
  defaultVisible: boolean;
  defaultConfig: unknown | null;
  locked: boolean;
  defaultOrder: number;
};
