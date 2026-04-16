// Main entry point for Sales Workbench Plugin

import { Plugin, WorkspaceLeaf } from 'obsidian';
import { LEAD_VIEW_TYPE, REVIEW_VIEW_TYPE, OPS_VIEW_TYPE, VIEW_CONFIGS } from './types/index';
import { LeadWorkbenchView } from './components/lead/LeadWorkbenchView';
import { ReviewWorkbenchView } from './components/review/ReviewWorkbenchView';
import { OpsWorkbenchView } from './components/ops/OpsWorkbenchView';
import { OpsWorkbenchSaveData, DEFAULT_OPS_SAVE_DATA } from './types/ops';

// V14: Plugin 数据存储键名
const OPS_DATA_KEY = 'sales-workbench:ops-data';

export default class SalesWorkbenchPlugin extends Plugin {
  // V14: 第三工作台持久化数据（内存态 + 保存占位）
  public opsSaveData: OpsWorkbenchSaveData = DEFAULT_OPS_SAVE_DATA;

  async onload(): Promise<void> {
    // V14: 从 Obsidian 持久化存储加载数据
    await this.loadOpsData();

    // Register three workbench views
    this.registerView(LEAD_VIEW_TYPE, (leaf) => new LeadWorkbenchView(leaf));
    this.registerView(REVIEW_VIEW_TYPE, (leaf) => new ReviewWorkbenchView(leaf));
    // V14: 传递 plugin 实例给 OpsWorkbenchView
    this.registerView(OPS_VIEW_TYPE, (leaf) => new OpsWorkbenchView(leaf, this));

    // Add commands for each workbench
    this.addCommand({
      id: 'open-lead-workbench',
      name: '打开线索筛选工作台',
      callback: () => this.openWorkbench(LEAD_VIEW_TYPE)
    });

    this.addCommand({
      id: 'open-review-workbench',
      name: '打开审核链路工作台',
      callback: () => this.openWorkbench(REVIEW_VIEW_TYPE)
    });

    this.addCommand({
      id: 'open-ops-workbench',
      name: '打开复盘经营工作台',
      callback: () => this.openWorkbench(OPS_VIEW_TYPE)
    });

    // Add ribbon icons
    this.addRibbonIcon('filter', VIEW_CONFIGS[LEAD_VIEW_TYPE].title, () =>
      this.openWorkbench(LEAD_VIEW_TYPE)
    );

    this.addRibbonIcon('list-checks', VIEW_CONFIGS[REVIEW_VIEW_TYPE].title, () =>
      this.openWorkbench(REVIEW_VIEW_TYPE)
    );

    this.addRibbonIcon('bar-chart-3', VIEW_CONFIGS[OPS_VIEW_TYPE].title, () =>
      this.openWorkbench(OPS_VIEW_TYPE)
    );

    console.log('[sales-workbench] Plugin loaded - Native views ready');
  }

  onunload(): void {
    // Detach all workbench leaves
    [LEAD_VIEW_TYPE, REVIEW_VIEW_TYPE, OPS_VIEW_TYPE].forEach((viewType) => {
      this.app.workspace.getLeavesOfType(viewType).forEach((leaf) => leaf.detach());
    });

    console.log('[sales-workbench] Plugin unloaded');
  }

  // V14: 从 Obsidian 持久化存储加载数据
  private async loadOpsData(): Promise<void> {
    try {
      const savedData = await this.loadData();
      if (savedData?.[OPS_DATA_KEY]) {
        this.opsSaveData = {
          ...DEFAULT_OPS_SAVE_DATA,
          ...savedData[OPS_DATA_KEY]
        };
        console.log('[sales-workbench] Ops data loaded:', this.opsSaveData);
      }
    } catch (error) {
      console.error('[sales-workbench] Failed to load ops data:', error);
    }
  }

  // V14: 保存数据到 Obsidian 持久化存储
  public async saveOpsData(): Promise<void> {
    try {
      this.opsSaveData.lastUpdated = new Date().toISOString();
      const existingData = await this.loadData() || {};
      existingData[OPS_DATA_KEY] = this.opsSaveData;
      await this.saveData(existingData);
      console.log('[sales-workbench] Ops data saved:', this.opsSaveData);
    } catch (error) {
      console.error('[sales-workbench] Failed to save ops data:', error);
    }
  }

  // V14: 获取当前阶段复盘数据
  public getStageReview(stageId: string): StageReviewData | undefined {
    return this.opsSaveData.stageReviews[stageId];
  }

  // V14: 保存阶段复盘数据
  public async saveStageReview(stageId: string, data: Partial<StageReviewData>): Promise<void> {
    const existing = this.opsSaveData.stageReviews[stageId] || {
      stageId: stageId as any,
      problem: '',
      whyThisIsAProblem: '',
      rootCauseGuesses: [],
      solutionPlan: '',
      testSubmission: '',
      updatedAt: new Date().toISOString()
    };

    this.opsSaveData.stageReviews[stageId] = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString()
    };

    await this.saveOpsData();
  }

  // V14: 保存当前状态（展开/收起、当前步骤等）
  public async saveCurrentState(state: Partial<OpsWorkbenchSaveData['currentState']>): Promise<void> {
    this.opsSaveData.currentState = {
      ...this.opsSaveData.currentState,
      ...state
    };
    await this.saveOpsData();
  }

  private async openWorkbench(viewType: string): Promise<void> {
    // Get or create leaf
    const leaf = this.app.workspace.getLeaf(true);

    // Set view state
    await leaf.setViewState({
      type: viewType,
      active: true
    });

    // Reveal the leaf
    this.app.workspace.revealLeaf(leaf);
  }
}