// Core plugin types
export const LEAD_VIEW_TYPE = 'sales-workbench-lead';
export const REVIEW_VIEW_TYPE = 'sales-workbench-review';
export const OPS_VIEW_TYPE = 'sales-workbench-ops';

// View configuration
export interface ViewConfig {
  viewType: string;
  title: string;
  icon: string;
}

export const VIEW_CONFIGS: Record<string, ViewConfig> = {
  [LEAD_VIEW_TYPE]: {
    viewType: LEAD_VIEW_TYPE,
    title: '线索筛选工作台',
    icon: 'filter'
  },
  [REVIEW_VIEW_TYPE]: {
    viewType: REVIEW_VIEW_TYPE,
    title: '审核链路工作台',
    icon: 'list-checks'
  },
  [OPS_VIEW_TYPE]: {
    viewType: OPS_VIEW_TYPE,
    title: '复盘经营工作台',
    icon: 'bar-chart-3'
  }
};