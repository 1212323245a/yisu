// Ops Workbench View - 经营复盘与策略纠偏台
// Layout: 左选 / 中操 / 右辅 三栏结构
// Version: V14 - 增加保存逻辑

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { OPS_VIEW_TYPE, VIEW_CONFIGS } from '../../types/index';
import {
  ActiveMainView,
  AISkillType,
  MarketStage,
  MarketStageConfig,
  ProblemAssetType,
  ProblemStatus,
  ProblemStep,
  MARKET_STAGE_CONFIGS,
  PROBLEM_ASSET_CONFIGS,
  REACTION_CATEGORIES,
  ProblemAsset,
  generateMockProblemAssets,
  AI_SKILL_CONFIGS,
  StageReviewData,
  OpsWorkbenchSaveData
} from '../../types/ops';
// V14: 引入 plugin 类型
import type SalesWorkbenchPlugin from '../../main';

export class OpsWorkbenchView extends ItemView {
  // V14: 对 plugin 实例的引用（用于保存）
  private plugin: SalesWorkbenchPlugin | null = null;

  // 当前状态
  private activeMainView: ActiveMainView = 'market';
  private activeMarketStage: MarketStage = 'opening';
  private activeProblemAssetType: ProblemAssetType = 'high-frequency';
  private currentStep: ProblemStep = 'discovery';
  private problemStatus: ProblemStatus = 'open';
  private showProblemReview: boolean = false; // 问题复盘默认不展开
  private selectedAssetId: string | null = null; // V8: 当前选中的问题资产ID，实现one-detail-at-a-time

  // V14: 当前阶段复盘数据（内存态）
  private currentStageReview: Partial<StageReviewData> = {};

  // DOM 引用
  private leftPanelEl: HTMLElement | null = null;
  private centerPanelEl: HTMLElement | null = null;
  private rightPanelEl: HTMLElement | null = null;

  // Mock 数据
  private mockProblemAssets: ProblemAsset[] = generateMockProblemAssets();
  private selectedSkillId: AISkillType = AI_SKILL_CONFIGS[0]?.id ?? 'analyze';

  // V14: 构造函数接受 plugin 实例
  constructor(leaf: WorkspaceLeaf, plugin?: SalesWorkbenchPlugin) {
    super(leaf);
    this.plugin = plugin || null;

    // V14: 如果有保存的数据，恢复状态
    if (this.plugin) {
      const savedState = this.plugin.opsSaveData.currentState;
      this.activeMainView = savedState.activeMainView;
      this.activeMarketStage = savedState.activeMarketStage;
      this.activeProblemAssetType = savedState.activeProblemAssetType;
      this.showProblemReview = savedState.showProblemReview;
      this.currentStep = savedState.currentStep;

      // V14: 加载当前阶段的复盘数据
      const savedReview = this.plugin.getStageReview(this.activeMarketStage);
      if (savedReview) {
        this.currentStageReview = savedReview;
      }
    }
  }

  getViewType(): string {
    return OPS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return VIEW_CONFIGS[OPS_VIEW_TYPE].title;
  }

  getIcon(): string {
    return VIEW_CONFIGS[OPS_VIEW_TYPE].icon;
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass('cyber-workbench-root');
    this.contentEl.style.padding = '0';
    this.contentEl.style.overflow = 'hidden';

    const container = this.contentEl.createDiv({ cls: 'wb-ops-container' });

    // Header
    this.renderHeader(container);

    // Main: 三栏结构
    this.renderThreeColumnLayout(container);

    // Footer
    this.renderFooter(container);
  }

  // ============================================
  // HEADER
  // ============================================
  private renderHeader(parent: HTMLElement): void {
    const header = parent.createDiv({ cls: 'wb-ops-header' });

    const titleWrap = header.createDiv({ cls: 'wb-ops-header-title-wrap' });
    titleWrap.createDiv({ cls: 'wb-ops-title', text: '经营复盘与策略纠偏台' });

    const actions = header.createDiv({ cls: 'wb-ops-header-actions' });
    actions.createDiv({ cls: 'wb-ops-date-compact', text: '📅 04-01 ~ 04-14' });
  }

  // ============================================
  // 三栏布局
  // ============================================
  private renderThreeColumnLayout(parent: HTMLElement): void {
    const main = parent.createDiv({ cls: 'wb-ops-three-column' });

    this.leftPanelEl = main.createDiv({ cls: 'wb-ops-left-panel' });
    this.renderLeftPanel(this.leftPanelEl);

    this.centerPanelEl = main.createDiv({ cls: 'wb-ops-center-panel' });
    this.renderCenterPanel(this.centerPanelEl);

    this.rightPanelEl = main.createDiv({ cls: 'wb-ops-right-panel' });
    this.renderRightPanel(this.rightPanelEl);
  }

  // ============================================
  // 左栏：选择区
  // ============================================
  private renderLeftPanel(panel: HTMLElement): void {
    // 左栏标题
    const header = panel.createDiv({ cls: 'wb-ops-panel-header' });
    header.createDiv({ cls: 'wb-ops-panel-title', text: '选择区' });

    // 1. 主线切换
    const switcherSection = panel.createDiv({ cls: 'wb-ops-left-section' });
    switcherSection.createDiv({ cls: 'wb-ops-section-label', text: '复盘主线' });

    const switcherWrap = switcherSection.createDiv({ cls: 'wb-ops-view-switcher' });

    const marketBtn = switcherWrap.createDiv({
      cls: `wb-ops-switcher-btn ${this.activeMainView === 'market' ? 'wb-ops-switcher-active' : ''}`,
      text: '📊 市场话术复盘'
    });
    marketBtn.onclick = () => this.switchMainView('market');

    const salesBtn = switcherWrap.createDiv({
      cls: `wb-ops-switcher-btn ${this.activeMainView === 'sales' ? 'wb-ops-switcher-active' : ''}`,
      text: '👤 销售认知复盘'
    });
    salesBtn.onclick = () => this.switchMainView('sales');

    // 2. 当前对象列表
    const objectSection = panel.createDiv({ cls: 'wb-ops-left-section' });
    objectSection.createDiv({ cls: 'wb-ops-section-label', text: '当前对象' });

    if (this.activeMainView === 'market') {
      this.renderMarketLeftPanel(objectSection);
    } else {
      this.renderSalesLeftPanel(objectSection);
    }
  }

  // 市场话术复盘左栏：话术模板 + 3个阶段
  private renderMarketLeftPanel(section: HTMLElement): void {
    const objectList = section.createDiv({ cls: 'wb-ops-object-list' });

    // 话术模板 V3.2
    const templateItem = objectList.createDiv({
      cls: 'wb-ops-object-item wb-ops-object-template'
    });
    templateItem.createDiv({ cls: 'wb-ops-object-icon', text: '📄' });
    templateItem.createDiv({ cls: 'wb-ops-object-label', text: '话术模板 V3.2' });

    // 分隔线
    objectList.createDiv({ cls: 'wb-ops-object-divider', text: '阶段页' });

    // 3个阶段页入口
    for (const stageConfig of MARKET_STAGE_CONFIGS) {
      const stageItem = objectList.createDiv({
        cls: `wb-ops-object-item wb-ops-object-stage ${
          this.activeMarketStage === stageConfig.id ? 'wb-ops-object-active' : ''
        }`
      });
      stageItem.createDiv({ cls: 'wb-ops-object-icon', text: '▶️' });

      const labelWrap = stageItem.createDiv({ cls: 'wb-ops-object-label-wrap' });
      labelWrap.createDiv({ cls: 'wb-ops-object-label', text: stageConfig.name });
      labelWrap.createDiv({ cls: 'wb-ops-object-sublabel', text: stageConfig.timeRange });

      stageItem.onclick = () => this.switchMarketStage(stageConfig.id);
    }

    // 注意：市场问题不再出现在左栏，已移入阶段页内部
  }

  // 销售认知复盘左栏：问题资产类型
  private renderSalesLeftPanel(section: HTMLElement): void {
    const objectList = section.createDiv({ cls: 'wb-ops-object-list' });

    // 问题资产类型列表
    for (const assetConfig of PROBLEM_ASSET_CONFIGS) {
      const assetItem = objectList.createDiv({
        cls: `wb-ops-object-item wb-ops-object-asset ${
          this.activeProblemAssetType === assetConfig.id ? 'wb-ops-object-active' : ''
        }`
      });
      assetItem.createDiv({ cls: 'wb-ops-object-icon', text: assetConfig.icon });

      const labelWrap = assetItem.createDiv({ cls: 'wb-ops-object-label-wrap' });
      labelWrap.createDiv({ cls: 'wb-ops-object-label', text: assetConfig.name });
      labelWrap.createDiv({ cls: 'wb-ops-object-sublabel', text: assetConfig.description });

      // 统计数字（mock）
      const count = this.getAssetTypeCount(assetConfig.id);
      assetItem.createDiv({ cls: 'wb-ops-object-badge', text: String(count) });

      assetItem.onclick = () => this.switchProblemAssetType(assetConfig.id);
    }

    // 注意：销售个人不再作为左栏主导航
  }

  private getAssetTypeCount(type: ProblemAssetType): number {
    return this.mockProblemAssets.filter(a => a.type === type).length;
  }

  // ============================================
  // 中栏：操作区
  // ============================================
  private renderCenterPanel(panel: HTMLElement): void {
    const header = panel.createDiv({ cls: 'wb-ops-panel-header' });
    header.createDiv({ cls: 'wb-ops-panel-title', text: '操作区' });

    const content = panel.createDiv({ cls: 'wb-ops-center-content' });

    if (this.activeMainView === 'market') {
      this.renderMarketStagePage(content);
    } else {
      this.renderSalesAssetPage(content);
    }
  }

  // ============================================
  // 市场阶段页：固定4块结构
  // ============================================
  private renderMarketStagePage(container: HTMLElement): void {
    container.addClass('wb-ops-view-market');

    const stageConfig = MARKET_STAGE_CONFIGS.find(s => s.id === this.activeMarketStage)!;

    // 视图标题
    const viewHeader = container.createDiv({ cls: 'wb-ops-view-header' });
    viewHeader.createDiv({ cls: 'wb-ops-view-title', text: `${stageConfig.name} (${stageConfig.timeRange})` });
    viewHeader.createDiv({ cls: 'wb-ops-view-subtitle', text: stageConfig.goal });

    // === 块1：阶段定义与关键数据 ===
    this.renderStageDefinitionPanel(container, stageConfig);

    // === 块2：客户反应归类区 ===
    this.renderReactionCategoryPanel(container, stageConfig);

    // === 块3：阶段复盘区（含问题闭环）===
    this.renderStageReviewPanel(container, stageConfig);

    // === 块4：阶段结论区 ===
    this.renderStageConclusionPanel(container, stageConfig);

    // Mock 说明
    container.createDiv({
      cls: 'wb-ops-mock-note',
      text: '[MOCK] 数据为占位值'
    });
  }

  // 块1：阶段定义与关键数据
  private renderStageDefinitionPanel(container: HTMLElement, stageConfig: MarketStageConfig): void {
    const panel = container.createDiv({ cls: 'wb-ops-stage-panel' });

    const header = panel.createDiv({ cls: 'wb-ops-stage-panel-header' });
    header.createDiv({ cls: 'wb-ops-stage-panel-title', text: '📊 阶段定义与关键数据' });

    const content = panel.createDiv({ cls: 'wb-ops-stage-panel-content' });

    // 阶段定义
    const definitionSection = content.createDiv({ cls: 'wb-ops-definition-section' });

    const defGrid = definitionSection.createDiv({ cls: 'wb-ops-definition-grid' });

    const defItems = [
      { label: '阶段名称', value: stageConfig.name },
      { label: '时间区间', value: stageConfig.timeRange },
      { label: '阶段目标', value: stageConfig.goal },
      { label: '关联节点', value: stageConfig.relatedNodes.join(', ') }
    ];

    for (const item of defItems) {
      const defItem = defGrid.createDiv({ cls: 'wb-ops-definition-item' });
      defItem.createDiv({ cls: 'wb-ops-definition-label', text: item.label });
      defItem.createDiv({ cls: 'wb-ops-definition-value', text: item.value });
    }

    // 关键指标
    const metricsSection = content.createDiv({ cls: 'wb-ops-metrics-section' });
    metricsSection.createDiv({ cls: 'wb-ops-metrics-title', text: '关键指标' });

    const metricsGrid = metricsSection.createDiv({ cls: 'wb-ops-metrics-grid' });

    // 根据阶段生成对应的mock指标
    const mockMetrics = this.generateMockMetrics(stageConfig.id);
    for (const metric of mockMetrics) {
      const metricCard = metricsGrid.createDiv({
        cls: `wb-ops-metric-card ${metric.trend === 'up' ? 'wb-ops-metric-up' : metric.trend === 'down' ? 'wb-ops-metric-down' : ''}`
      });
      metricCard.createDiv({ cls: 'wb-ops-metric-name', text: metric.name });
      metricCard.createDiv({ cls: 'wb-ops-metric-value', text: metric.value });
      metricCard.createDiv({ cls: 'wb-ops-metric-compare', text: metric.compare });
    }
  }

  private generateMockMetrics(stageId: MarketStage): Array<{ name: string; value: string; compare: string; trend: 'up' | 'down' | 'flat' }> {
    const metricsMap: Record<MarketStage, Array<{ name: string; value: string; compare: string; trend: 'up' | 'down' | 'flat' }>> = {
      opening: [
        { name: '0-5秒挂断率', value: '12.5%', compare: '环比 -2.3%', trend: 'down' },
        { name: '5-13秒挂断率', value: '7.8%', compare: '环比 +1.2%', trend: 'up' },
        { name: '13秒进入率', value: '79.7%', compare: '环比 +1.1%', trend: 'up' }
      ],
      hook: [
        { name: '13-27秒挂断率', value: '5.2%', compare: '环比 -0.8%', trend: 'down' },
        { name: '钩子接受率', value: '68.4%', compare: '环比 +3.2%', trend: 'up' },
        { name: '进入加微信率', value: '45.6%', compare: '环比 +2.1%', trend: 'up' }
      ],
      wechat: [
        { name: '口头同意率', value: '64.2%', compare: '环比 +1.5%', trend: 'up' },
        { name: '微信确认率', value: '78.5%', compare: '环比 -2.1%', trend: 'down' },
        { name: '错号/换号率', value: '8.3%', compare: '环比 +0.5%', trend: 'up' },
        { name: '最终加微完成率', value: '45.8%', compare: '环比 +0.8%', trend: 'up' }
      ]
    };
    return metricsMap[stageId];
  }

  // 块2：客户反应归类区（md引用入口）- V13: 添加块内滚动
  private renderReactionCategoryPanel(container: HTMLElement, stageConfig: MarketStageConfig): void {
    const panel = container.createDiv({ cls: 'wb-ops-stage-panel wb-ops-panel-scrollable' });

    const header = panel.createDiv({ cls: 'wb-ops-stage-panel-header' });
    header.createDiv({ cls: 'wb-ops-stage-panel-title', text: '💬 客户反应归类' });
    header.createDiv({ cls: 'wb-ops-stage-panel-subtitle', text: '持续积累型样本库 - 点击打开详细文档' });

    const content = panel.createDiv({ cls: 'wb-ops-stage-panel-content' });

    const reactionsGrid = content.createDiv({ cls: 'wb-ops-reactions-md-grid' });

    // 筛选出该阶段相关的反应分类
    const relevantReactions = REACTION_CATEGORIES.filter(r =>
      r.targetStage.includes(stageConfig.name) ||
      this.isReactionRelevantToStage(r, stageConfig.id)
    );

    for (const reaction of relevantReactions) {
      const mdCard = reactionsGrid.createDiv({ cls: 'wb-ops-reaction-md-card' });

      const cardHeader = mdCard.createDiv({ cls: 'wb-ops-reaction-md-header' });
      cardHeader.createDiv({ cls: 'wb-ops-reaction-md-name', text: reaction.name });
      cardHeader.createDiv({ cls: 'wb-ops-reaction-md-count', text: `${reaction.sampleCount} 样本` });

      const cardBody = mdCard.createDiv({ cls: 'wb-ops-reaction-md-body' });
      cardBody.createDiv({ cls: 'wb-ops-reaction-md-meaning', text: reaction.meaning });

      const cardFooter = mdCard.createDiv({ cls: 'wb-ops-reaction-md-footer' });
      cardFooter.createDiv({ cls: 'wb-ops-reaction-md-target', text: `→ ${reaction.targetStage}` });

      // md引用入口
      const mdLink = cardFooter.createDiv({ cls: 'wb-ops-reaction-md-link' });
      mdLink.createDiv({ cls: 'wb-ops-reaction-md-icon', text: '📄' });
      mdLink.createDiv({ cls: 'wb-ops-reaction-md-path', text: reaction.mdReference });

      // 点击打开md文件的占位
      mdCard.onclick = () => {
        // TODO: 打开对应的md文件
        console.log(`Open MD: ${reaction.mdReference}`);
      };
    }

    // md文件结构说明
    const mdNote = content.createDiv({ cls: 'wb-ops-md-note' });
    mdNote.createDiv({ text: '📁 每个反应分类对应独立MD文件，包含：分类说明 / 为什么归这类 / 经典原文Top10 / 持续补充的新样本' });
  }

  private isReactionRelevantToStage(reaction: typeof REACTION_CATEGORIES[0], stageId: MarketStage): boolean {
    const stageRelevance: Record<MarketStage, string[]> = {
      opening: ['who', 'robot', 'agree', 'reject', 'busy'],
      hook: ['content', 'agree', 'reject', 'busy'],
      wechat: ['wrong-number', 'agree', 'reject']
    };
    return stageRelevance[stageId].includes(reaction.id);
  }

  // 块3：阶段复盘区（问题移入阶段页内部）- V14: 整块展开，不限制高度
  private renderStageReviewPanel(container: HTMLElement, stageConfig: MarketStageConfig): void {
    // V14: 移除 wb-ops-panel-scrollable，让复盘内容整块展开
    const panel = container.createDiv({ cls: 'wb-ops-stage-panel wb-ops-stage-panel-review' });

    const header = panel.createDiv({ cls: 'wb-ops-stage-panel-header' });
    header.createDiv({ cls: 'wb-ops-stage-panel-title', text: '🔍 阶段复盘' });

    const content = panel.createDiv({ cls: 'wb-ops-stage-panel-content' });

    if (!this.showProblemReview) {
      // 问题默认空白，由人工点击开启
      const emptyState = content.createDiv({ cls: 'wb-ops-review-empty' });
      emptyState.createDiv({ cls: 'wb-ops-review-empty-icon', text: '🔍' });
      emptyState.createDiv({ cls: 'wb-ops-review-empty-text', text: '暂未发现问题' });
      emptyState.createDiv({ cls: 'wb-ops-review-empty-hint', text: '点击开启复盘流程，或等待AI识别异常' });

      const startBtn = content.createEl('button', {
        cls: 'cyber-btn cyber-btn-primary wb-ops-start-review-btn',
        text: '开启阶段复盘'
      });
      startBtn.onclick = () => {
        this.showProblemReview = true;
        this.saveCurrentState(); // V14: 保存状态
        this.refreshCenterPanel();
      };
    } else {
      // 复盘流程展开
      this.renderReviewFlowInStage(content);
    }
  }

  // 阶段页内部的问题复盘流程 - V14: 增加保存逻辑
  private renderReviewFlowInStage(container: HTMLElement): void {
    const flowContainer = container.createDiv({ cls: 'wb-ops-review-flow' });

    // V14: 保存当前状态到 plugin
    this.saveCurrentState();

    // 1. 发现问题
    const problemSection = flowContainer.createDiv({ cls: 'wb-ops-review-flow-section' });
    const problemHeader = problemSection.createDiv({ cls: 'wb-ops-review-flow-header' });
    problemHeader.createDiv({ cls: 'wb-ops-review-flow-number', text: '1' });
    problemHeader.createDiv({ cls: 'wb-ops-review-flow-title', text: '问题' });
    const problemBody = problemSection.createDiv({ cls: 'wb-ops-review-flow-body' });
    const problemInput = problemBody.createEl('input', {
      cls: 'wb-ops-review-input',
      attr: { placeholder: '描述观察到的异常...' }
    });
    // V14: 加载已保存的问题
    problemInput.value = this.currentStageReview.problem || '开场白0-5秒挂断率异常升高';
    // V14: 失焦时保存
    problemInput.onblur = () => {
      this.currentStageReview.problem = problemInput.value;
      this.saveStageReview();
    };

    // 2. 为什么这是个问题
    const whySection = flowContainer.createDiv({ cls: 'wb-ops-review-flow-section' });
    const whyHeader = whySection.createDiv({ cls: 'wb-ops-review-flow-header' });
    whyHeader.createDiv({ cls: 'wb-ops-review-flow-number', text: '2' });
    whyHeader.createDiv({ cls: 'wb-ops-review-flow-title', text: '为什么这是个问题' });
    const whyBody = whySection.createDiv({ cls: 'wb-ops-review-flow-body' });
    const whyTextarea = whyBody.createEl('textarea', {
      cls: 'wb-ops-review-textarea',
      attr: { placeholder: '解释为什么这值得复盘...', rows: 2 }
    });
    // V14: 加载已保存的内容
    whyTextarea.value = this.currentStageReview.whyThisIsAProblem || '挂断率是漏斗第一层，0-5秒挂断率从V3.1的8%上升到12%，每天损失约50个可触达客户';
    // V14: 失焦时保存
    whyTextarea.onblur = () => {
      this.currentStageReview.whyThisIsAProblem = whyTextarea.value;
      this.saveStageReview();
    };

    // 3. 原因猜测
    const causeSection = flowContainer.createDiv({ cls: 'wb-ops-review-flow-section' });
    const causeHeader = causeSection.createDiv({ cls: 'wb-ops-review-flow-header' });
    causeHeader.createDiv({ cls: 'wb-ops-review-flow-number', text: '3' });
    causeHeader.createDiv({ cls: 'wb-ops-review-flow-title', text: '原因猜测' });
    const causeBody = causeSection.createDiv({ cls: 'wb-ops-review-flow-body' });
    const guesses = this.currentStageReview.rootCauseGuesses?.length ? this.currentStageReview.rootCauseGuesses : [
      { id: '1', label: '开场白停顿过长（0.8s→1.2s）', confidence: 'high', selected: true },
      { id: '2', label: '身份锚定缺失', confidence: 'high', selected: false },
      { id: '3', label: '节点分支逻辑混淆', confidence: 'medium', selected: false },
      { id: '4', label: '开场语速过快导致客户不适', confidence: 'medium', selected: false },
      { id: '5', label: '开场白语气不够自然', confidence: 'low', selected: false },
      { id: '6', label: '拨号时段选择不当', confidence: 'low', selected: false }
    ];
    // 确保保存到内存态
    this.currentStageReview.rootCauseGuesses = guesses;

    for (const guess of guesses) {
      const guessEl = causeBody.createDiv({ cls: 'wb-ops-review-guess' });
      guessEl.onclick = () => {
        guess.selected = !guess.selected;
        // 更新视觉状态
        const radioEl = guessEl.querySelector('.wb-ops-review-guess-radio');
        if (radioEl) {
          radioEl.textContent = guess.selected ? '◉' : '○';
          radioEl.classList.toggle('selected', guess.selected);
        }
        // V14: 保存猜测选择
        this.saveStageReview();
      };
      guessEl.createDiv({
        cls: `wb-ops-review-guess-radio ${guess.selected ? 'selected' : ''}`,
        text: guess.selected ? '◉' : '○'
      });
      guessEl.createDiv({ cls: 'wb-ops-review-guess-label', text: guess.label });
      guessEl.createDiv({ cls: 'wb-ops-review-guess-confidence', text: guess.confidence });
    }

    // 补充分析区（V8: 增加内容高度用于滚动测试）
    const analysisNote = causeBody.createDiv({ cls: 'wb-ops-review-analysis-note' });
    analysisNote.createDiv({ text: '📊 数据分析支持：' });
    analysisNote.createDiv({ text: '• 挂断高峰集中在接通后0.5-1.5秒' });
    analysisNote.createDiv({ text: '• 停顿超过0.8秒的案例挂断率达85%' });
    analysisNote.createDiv({ text: '• 有身份锚定的开场白挂断率降低40%' });
    analysisNote.createDiv({ text: '• 早晨9-10点挂断率最高，达24%' });

    // 4. 解决方案
    const solutionSection = flowContainer.createDiv({ cls: 'wb-ops-review-flow-section' });
    const solutionHeader = solutionSection.createDiv({ cls: 'wb-ops-review-flow-header' });
    solutionHeader.createDiv({ cls: 'wb-ops-review-flow-number', text: '4' });
    solutionHeader.createDiv({ cls: 'wb-ops-review-flow-title', text: '解决方案' });
    const solutionBody = solutionSection.createDiv({ cls: 'wb-ops-review-flow-body' });
    const solutionTextarea = solutionBody.createEl('textarea', {
      cls: 'wb-ops-review-textarea',
      attr: { placeholder: '描述计划如何调整...', rows: 2 }
    });
    // V14: 加载已保存的解决方案
    solutionTextarea.value = this.currentStageReview.solutionPlan || '缩短开场白停顿至0.5s以内，增加身份锚定"您好王总，我是XX小李"';
    // V14: 失焦时保存
    solutionTextarea.onblur = () => {
      this.currentStageReview.solutionPlan = solutionTextarea.value;
      this.saveStageReview();
    };

    // 5. 测试提交
    const testSection = flowContainer.createDiv({ cls: 'wb-ops-review-flow-section' });
    const testHeader = testSection.createDiv({ cls: 'wb-ops-review-flow-header' });
    testHeader.createDiv({ cls: 'wb-ops-review-flow-number', text: '5' });
    testHeader.createDiv({ cls: 'wb-ops-review-flow-title', text: '测试提交' });
    const testBody = testSection.createDiv({ cls: 'wb-ops-review-flow-body' });
    const testTextarea = testBody.createEl('textarea', {
      cls: 'wb-ops-review-textarea',
      attr: { placeholder: '描述验证方案...', rows: 2 }
    });
    // V14: 加载已保存的测试方案
    testTextarea.value = this.currentStageReview.testSubmission || 'A/B测试：50%流量使用新开场白，观察3天挂断率变化';
    // V14: 失焦时保存
    testTextarea.onblur = () => {
      this.currentStageReview.testSubmission = testTextarea.value;
      this.saveStageReview();
    };

    // 6. 验证结果
    const resultSection = flowContainer.createDiv({ cls: 'wb-ops-review-flow-section' });
    const resultHeader = resultSection.createDiv({ cls: 'wb-ops-review-flow-header' });
    resultHeader.createDiv({ cls: 'wb-ops-review-flow-number', text: '6' });
    resultHeader.createDiv({ cls: 'wb-ops-review-flow-title', text: '验证结果' });
    const resultBody = resultSection.createDiv({ cls: 'wb-ops-review-flow-body' });
    resultBody.createDiv({ cls: 'wb-ops-review-result-pending', text: '⏳ 验证进行中...' });

    // V10: 添加更多历史验证记录用于滚动测试
    const historySection = resultBody.createDiv({ cls: 'wb-ops-review-history' });
    historySection.createDiv({ cls: 'wb-ops-review-history-title', text: '📜 历史验证记录' });
    const historyItems = [
      { date: '04-10', result: '无效', desc: '调整拨号时段至下午2-4点' },
      { date: '04-11', result: '部分有效', desc: '增加号码清洗过滤空号' },
      { date: '04-12', result: '负向效果', desc: '更换录音版本V3.2' },
      { date: '04-13', result: '待验证', desc: '缩短开场停顿至0.5s' },
      { date: '04-14', result: '无效', desc: '增加开场白身份锚定' },
      { date: '04-15', result: '部分有效', desc: '调整语速至120字/分钟' },
      { date: '04-16', result: '待验证', desc: '增加客户称呼个性化' },
      { date: '04-17', result: '无效', desc: '更换开场白音乐背景' }
    ];
    for (const item of historyItems) {
      const itemEl = historySection.createDiv({ cls: 'wb-ops-review-history-item' });
      itemEl.createDiv({ cls: 'wb-ops-review-history-date', text: item.date });
      itemEl.createDiv({ cls: `wb-ops-review-history-result result-${item.result === '无效' ? 'failed' : item.result === '部分有效' ? 'partial' : 'pending'}`, text: item.result });
      itemEl.createDiv({ cls: 'wb-ops-review-history-desc', text: item.desc });
    }

    // AI辅助提示
    const aiNote = flowContainer.createDiv({ cls: 'wb-ops-review-ai-note' });
    aiNote.createDiv({ cls: 'wb-ops-review-ai-icon', text: '🤖' });
    aiNote.createDiv({ cls: 'wb-ops-review-ai-text', text: 'AI可辅助原因分析和建议生成（右栏Skill入口）' });

    // 关闭复盘按钮
    const closeBtn = container.createEl('button', {
      cls: 'cyber-btn cyber-btn-secondary wb-ops-close-review-btn',
      text: '收起复盘'
    });
    closeBtn.onclick = () => {
      this.showProblemReview = false;
      this.saveCurrentState(); // V14: 保存状态
      this.refreshCenterPanel();
    };
  }

  // V14: 保存当前状态到 plugin
  private saveCurrentState(): void {
    if (this.plugin) {
      this.plugin.saveCurrentState({
        activeMainView: this.activeMainView,
        activeMarketStage: this.activeMarketStage,
        activeProblemAssetType: this.activeProblemAssetType,
        showProblemReview: this.showProblemReview,
        currentStep: this.currentStep
      });
    }
  }

  // V14: 保存阶段复盘数据到 plugin
  private saveStageReview(): void {
    if (this.plugin) {
      this.plugin.saveStageReview(this.activeMarketStage, this.currentStageReview);
    }
  }

  // 块4：阶段结论区
  private renderStageConclusionPanel(container: HTMLElement, stageConfig: MarketStageConfig): void {
    const panel = container.createDiv({ cls: 'wb-ops-stage-panel wb-ops-stage-panel-conclusion' });

    const header = panel.createDiv({ cls: 'wb-ops-stage-panel-header' });
    header.createDiv({ cls: 'wb-ops-stage-panel-title', text: '✓ 阶段结论' });

    const content = panel.createDiv({ cls: 'wb-ops-stage-panel-content' });

    const conclusionGrid = content.createDiv({ cls: 'wb-ops-conclusion-grid' });

    const conclusionOptions = [
      { id: 'keep', label: '保持当前话术', icon: '✓', desc: '当前表现良好，无需调整' },
      { id: 'adjust', label: '调整话术', icon: '🔧', desc: '基于复盘结果进行优化' },
      { id: 'promote', label: '沉淀到问题库', icon: '📚', desc: '有价值的经验，值得保存' },
      { id: 'rejudge', label: '标记为已改判', icon: '↻', desc: '问题定义有误，需要重新判断' }
    ];

    for (const option of conclusionOptions) {
      const optionEl = conclusionGrid.createDiv({ cls: 'wb-ops-conclusion-option' });
      optionEl.createDiv({ cls: 'wb-ops-conclusion-icon', text: option.icon });
      optionEl.createDiv({ cls: 'wb-ops-conclusion-label', text: option.label });
      optionEl.createDiv({ cls: 'wb-ops-conclusion-desc', text: option.desc });
    }

    // 状态门显示
    const statusGate = content.createDiv({ cls: 'wb-ops-status-gate' });
    statusGate.createDiv({ cls: 'wb-ops-status-gate-label', text: '当前状态门' });
    statusGate.createDiv({ cls: 'wb-ops-status-gate-value', text: '待验证' });
  }

  // ============================================
  // 销售问题资产页：V8 one-detail-at-a-time 重构
  // ============================================
  private renderSalesAssetPage(container: HTMLElement): void {
    container.addClass('wb-ops-view-sales');

    const assetConfig = PROBLEM_ASSET_CONFIGS.find(a => a.id === this.activeProblemAssetType)!;

    // 过滤该类型的资产
    const assets = this.mockProblemAssets.filter(a => a.type === this.activeProblemAssetType);

    // 视图标题
    const viewHeader = container.createDiv({ cls: 'wb-ops-view-header' });
    viewHeader.createDiv({ cls: 'wb-ops-view-title', text: `${assetConfig.icon} ${assetConfig.name}` });
    viewHeader.createDiv({ cls: 'wb-ops-view-subtitle', text: assetConfig.description });

    if (assets.length === 0) {
      const emptyState = container.createDiv({ cls: 'wb-ops-asset-empty' });
      emptyState.createDiv({ cls: 'wb-ops-asset-empty-icon', text: '📭' });
      emptyState.createDiv({ cls: 'wb-ops-asset-empty-text', text: '暂无此类问题资产' });
      return;
    }

    // V8: 问题资产列表（摘要形式）
    const listSection = container.createDiv({ cls: 'wb-ops-asset-list-section' });
    listSection.createDiv({ cls: 'wb-ops-asset-list-title', text: `问题列表 (${assets.length})` });

    for (const asset of assets) {
      const isSelected = this.selectedAssetId === asset.id;
      const summaryItem = listSection.createDiv({
        cls: `wb-ops-asset-summary ${isSelected ? 'wb-ops-asset-summary-selected' : ''}`
      });

      const summaryHeader = summaryItem.createDiv({ cls: 'wb-ops-asset-summary-header' });
      summaryHeader.createDiv({ cls: 'wb-ops-asset-summary-title', text: asset.title });

      const statusClass = asset.status === 'open' ? 'status-open'
        : asset.status === 'rejudged' ? 'status-rejudged'
        : 'status-resolved';
      summaryHeader.createDiv({ cls: `wb-ops-asset-summary-status ${statusClass}`, text: asset.status });

      summaryItem.createDiv({ cls: 'wb-ops-asset-summary-desc', text: asset.description.substring(0, 60) + '...' });

      // 点击展开详情
      summaryItem.onclick = () => this.selectAsset(asset.id);

      // 如果是当前选中的资产，立即在其下方展开详情
      if (isSelected) {
        this.renderExpandedAssetDetail(summaryItem, asset);
      }
    }

    // 如果没有选中任何资产，默认选中第一个
    if (!this.selectedAssetId && assets.length > 0) {
      this.selectedAssetId = assets[0].id;
      this.refreshCenterPanel();
      return;
    }

    // Mock 说明
    container.createDiv({
      cls: 'wb-ops-mock-note',
      text: '[MOCK] 数据为占位值 · V9 结构回正'
    });
  }

  // V9: 展开显示单个问题资产详情（在列表项下方）
  private renderExpandedAssetDetail(container: HTMLElement, asset: ProblemAsset): void {
    const detailPanel = container.createDiv({ cls: 'wb-ops-asset-detail-expanded' });

    // === 块1：问题定义区 ===
    const definitionSection = detailPanel.createDiv({ cls: 'wb-ops-asset-detail-section' });
    definitionSection.createDiv({ cls: 'wb-ops-asset-detail-section-title', text: '📋 问题定义' });
    const defContent = definitionSection.createDiv({ cls: 'wb-ops-asset-detail-content' });
    defContent.createDiv({ cls: 'wb-ops-asset-detail-desc', text: asset.description });
    defContent.createDiv({ cls: 'wb-ops-asset-detail-why', text: `为什么重要：${asset.whyItMatters}` });
    defContent.createDiv({ cls: 'wb-ops-asset-detail-judgement', text: `当前判断：${asset.currentJudgement}` });

    // === 块2：关键指标区 ===
    const metricsSection = detailPanel.createDiv({ cls: 'wb-ops-asset-detail-section' });
    metricsSection.createDiv({ cls: 'wb-ops-asset-detail-section-title', text: '📊 关键指标' });
    const metricsContent = metricsSection.createDiv({ cls: 'wb-ops-asset-detail-content' });
    const metricsGrid = metricsContent.createDiv({ cls: 'wb-ops-asset-detail-metrics' });
    metricsGrid.createDiv({ cls: 'wb-ops-asset-detail-metric', text: `影响：${asset.metrics.impact}` });
    metricsGrid.createDiv({ cls: 'wb-ops-asset-detail-metric', text: `频率：${asset.metrics.frequency}` });
    metricsGrid.createDiv({ cls: 'wb-ops-asset-detail-metric', text: `趋势：${asset.metrics.trend}` });

    // === 块3：样本证据区 ===
    const samplesSection = detailPanel.createDiv({ cls: 'wb-ops-asset-detail-section' });
    samplesSection.createDiv({ cls: 'wb-ops-asset-detail-section-title', text: '🔗 样本证据' });
    const samplesContent = samplesSection.createDiv({ cls: 'wb-ops-asset-detail-content' });
    samplesContent.createDiv({
      cls: 'wb-ops-asset-detail-samples',
      text: `共 ${asset.sampleCount} 个样本 | 涉及销售：${asset.sampleSales.join(', ')}`
    });

    // === 块4：模式归纳区 ===
    const patternsSection = detailPanel.createDiv({ cls: 'wb-ops-asset-detail-section' });
    patternsSection.createDiv({ cls: 'wb-ops-asset-detail-section-title', text: '🔍 模式归纳' });
    const patternsContent = patternsSection.createDiv({ cls: 'wb-ops-asset-detail-content' });
    if (asset.patterns.highFrequencyScene) {
      patternsContent.createDiv({ text: `高频场景：${asset.patterns.highFrequencyScene}` });
    }
    if (asset.patterns.likelyCustomerPattern) {
      patternsContent.createDiv({ text: `客户模式：${asset.patterns.likelyCustomerPattern}` });
    }
    if (asset.patterns.failurePattern) {
      patternsContent.createDiv({ text: `失败模式：${asset.patterns.failurePattern}` });
    }
    if (asset.patterns.breakthroughPattern) {
      patternsContent.createDiv({ text: `突破模式：${asset.patterns.breakthroughPattern}` });
    }

    // === 块5：经验沉淀区 ===
    const experienceSection = detailPanel.createDiv({ cls: 'wb-ops-asset-detail-section' });
    experienceSection.createDiv({ cls: 'wb-ops-asset-detail-section-title', text: '💡 经验沉淀' });
    const expContent = experienceSection.createDiv({ cls: 'wb-ops-asset-detail-content' });
    expContent.createDiv({ text: `已尝试方法：${asset.experience.triedMethods.join('、')}` });
    expContent.createDiv({ text: `当前结论：${asset.experience.currentConclusion}` });
    expContent.createDiv({ text: `值得保存：${asset.experience.worthSaving ? '是' : '否'} | 需要更多验证：${asset.experience.needMoreValidation ? '是' : '否'}` });

    // 关闭详情按钮
    const closeBtn = detailPanel.createEl('button', {
      cls: 'cyber-btn cyber-btn-secondary wb-ops-close-detail-btn',
      text: '收起详情'
    });
    closeBtn.onclick = () => this.selectAsset(null);
  }

  private selectAsset(assetId: string | null): void {
    this.selectedAssetId = assetId;
    this.refreshCenterPanel();
  }

  // 保留旧方法以兼容，但实际使用新逻辑
  private renderProblemAssetCard(container: HTMLElement, asset: ProblemAsset): void {
    // V8: 此方法不再直接使用，详情通过 renderExpandedAssetDetail 渲染
  }

  // ============================================
  // 右栏：问题闭环辅助区（流程助手）
  // ============================================
  private renderRightPanel(panel: HTMLElement): void {
    const header = panel.createDiv({ cls: 'wb-ops-panel-header' });
    header.createDiv({ cls: 'wb-ops-panel-title', text: '问题闭环辅助区' });

    // 步骤指示器
    this.renderStepIndicator(panel);

    // 流程助手顺序：发现问题 -> 原因分析 -> 样本客户链接 -> 建议调整 -> 待验证 -> 已尝试动作 -> AI skill
    this.renderProblemDiscoveryAssistant(panel);
    this.renderRootCauseAssistant(panel);
    this.renderSampleLinksAssistant(panel);
    this.renderSuggestionAssistant(panel);
    this.renderValidationAssistant(panel);
    this.renderTriedActionsAssistant(panel);
    this.renderSkillSelectorAssistant(panel);

    // Mock 说明
    panel.createDiv({
      cls: 'wb-ops-mock-note',
      text: '[MOCK] 右栏为流程助手'
    });
  }

  private renderStepIndicator(panel: HTMLElement): void {
    const steps = [
      { id: 'discovery', label: '问题', icon: '🔍' },
      { id: 'analysis', label: '原因', icon: '🔬' },
      { id: 'samples', label: '样本', icon: '🔗' },
      { id: 'suggestion', label: '建议', icon: '💡' },
      { id: 'validation', label: '验证', icon: '✓' }
    ];

    const indicator = panel.createDiv({ cls: 'wb-ops-step-indicator-compact' });

    // 问题状态
    const statusWrap = indicator.createDiv({ cls: 'wb-ops-problem-status-compact' });
    statusWrap.createDiv({ cls: 'wb-ops-problem-status-label', text: '状态' });
    const statusClass = this.problemStatus === 'open' ? 'status-open'
      : this.problemStatus === 'rejudged' ? 'status-rejudged'
      : 'status-resolved';
    statusWrap.createDiv({
      cls: `wb-ops-problem-status-value ${statusClass}`,
      text: this.problemStatus === 'open' ? '进行中' : this.problemStatus === 'rejudged' ? '已改判' : '已解决'
    });

    // 步骤流程
    const stepFlow = indicator.createDiv({ cls: 'wb-ops-step-flow-compact' });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isActive = step.id === this.currentStep;
      const isPast = steps.findIndex(s => s.id === this.currentStep) > i;

      const stepEl = stepFlow.createDiv({
        cls: `wb-ops-step-item-compact ${isActive ? 'step-active' : ''} ${isPast ? 'step-past' : ''}`
      });
      stepEl.createDiv({ cls: 'wb-ops-step-icon-compact', text: isPast ? '✓' : step.icon });
      stepEl.createDiv({ cls: 'wb-ops-step-label-compact', text: step.label });

      // 步骤可点击
      stepEl.onclick = () => this.setCurrentStep(step.id as ProblemStep);

      if (i < steps.length - 1) {
        stepFlow.createDiv({
          cls: `wb-ops-step-arrow-compact ${isPast ? 'arrow-active' : ''}`,
          text: '→'
        });
      }
    }
  }

  // 1. 发现问题（流程助手）
  private renderProblemDiscoveryAssistant(panel: HTMLElement): void {
    const section = panel.createDiv({ cls: 'wb-ops-assistant-section' });
    section.addClass('wb-ops-assistant-clickable');
    if (this.currentStep === 'discovery') section.addClass('wb-ops-assistant-active');
    const header = section.createDiv({ cls: 'wb-ops-assistant-header' });
    header.createDiv({ cls: 'wb-ops-assistant-number', text: '1' });
    header.createDiv({ cls: 'wb-ops-assistant-title', text: '发现问题' });

    const content = section.createDiv({ cls: 'wb-ops-assistant-content' });
    content.createDiv({
      cls: 'wb-ops-assistant-hint',
      text: '💡 在中栏详细描述问题，此处仅显示当前问题摘要'
    });
    section.onclick = () => this.setCurrentStep('discovery');
  }

  // 2. 原因分析（流程助手）
  private renderRootCauseAssistant(panel: HTMLElement): void {
    const section = panel.createDiv({ cls: 'wb-ops-assistant-section' });
    section.addClass('wb-ops-assistant-clickable');
    if (this.currentStep === 'analysis') section.addClass('wb-ops-assistant-active');
    const header = section.createDiv({ cls: 'wb-ops-assistant-header' });
    header.createDiv({ cls: 'wb-ops-assistant-number', text: '2' });
    header.createDiv({ cls: 'wb-ops-assistant-title', text: '原因分析' });
    header.createDiv({ cls: 'wb-ops-assistant-ai-badge', text: '🤖 AI' });

    const content = section.createDiv({ cls: 'wb-ops-assistant-content' });
    section.onclick = () => this.setCurrentStep('analysis');
    content.createDiv({
      cls: 'wb-ops-assistant-hint',
      text: '💡 AI辅助根因分析结果在中栏展示'
    });
  }

  // 3. 样本客户链接（流程助手）
  private renderSampleLinksAssistant(panel: HTMLElement): void {
    const section = panel.createDiv({ cls: 'wb-ops-assistant-section' });
    section.addClass('wb-ops-assistant-clickable');
    if (this.currentStep === 'samples') section.addClass('wb-ops-assistant-active');
    const header = section.createDiv({ cls: 'wb-ops-assistant-header' });
    header.createDiv({ cls: 'wb-ops-assistant-number', text: '3' });
    header.createDiv({ cls: 'wb-ops-assistant-title', text: '样本客户链接' });

    const content = section.createDiv({ cls: 'wb-ops-assistant-content' });
    section.onclick = () => this.setCurrentStep('samples');
    content.createDiv({
      cls: 'wb-ops-assistant-hint',
      text: '💡 关联客户样本在中栏问题资产页展示'
    });
  }

  // 4. 建议调整（流程助手）
  private renderSuggestionAssistant(panel: HTMLElement): void {
    const section = panel.createDiv({ cls: 'wb-ops-assistant-section' });
    section.addClass('wb-ops-assistant-clickable');
    if (this.currentStep === 'suggestion') section.addClass('wb-ops-assistant-active');
    const header = section.createDiv({ cls: 'wb-ops-assistant-header' });
    header.createDiv({ cls: 'wb-ops-assistant-number', text: '4' });
    header.createDiv({ cls: 'wb-ops-assistant-title', text: '建议调整' });
    header.createDiv({ cls: 'wb-ops-assistant-ai-badge', text: '🤖 AI' });

    const content = section.createDiv({ cls: 'wb-ops-assistant-content' });
    section.onclick = () => this.setCurrentStep('suggestion');
    content.createDiv({
      cls: 'wb-ops-assistant-hint',
      text: '💡 AI建议在中栏详细展示'
    });
  }

  // 5. 待验证（流程助手）
  private renderValidationAssistant(panel: HTMLElement): void {
    const section = panel.createDiv({ cls: 'wb-ops-assistant-section' });
    section.addClass('wb-ops-assistant-clickable');
    if (this.currentStep === 'validation') section.addClass('wb-ops-assistant-active');
    const header = section.createDiv({ cls: 'wb-ops-assistant-header' });
    header.createDiv({ cls: 'wb-ops-assistant-number', text: '5' });
    header.createDiv({ cls: 'wb-ops-assistant-title', text: '待验证' });
    header.createDiv({ cls: 'wb-ops-assistant-ai-badge', text: '🤖 AI' });

    const content = section.createDiv({ cls: 'wb-ops-assistant-content' });
    section.onclick = () => this.setCurrentStep('validation');
    content.createDiv({
      cls: 'wb-ops-assistant-hint',
      text: '💡 验证方案在中栏详细展示'
    });
  }

  // 6. 已尝试动作（折叠区）
  private renderTriedActionsAssistant(panel: HTMLElement): void {
    const section = panel.createDiv({ cls: 'wb-ops-assistant-section wb-ops-assistant-collapsible' });

    const header = section.createDiv({ cls: 'wb-ops-collapsible-header' });
    header.createDiv({ cls: 'wb-ops-collapsible-icon', text: '▼' });
    header.createDiv({ cls: 'wb-ops-collapsible-title', text: '已尝试动作' });
    header.createDiv({ cls: 'wb-ops-collapsible-count', text: '8' });

    const content = section.createDiv({ cls: 'wb-ops-collapsible-content' });

    const triedList = content.createDiv({ cls: 'wb-ops-tried-list-compact' });
    const triedItems = [
      { action: 'V3.1 调整拨号时段', result: '无效' },
      { action: 'V3.1 增加号码清洗', result: '部分有效' },
      { action: 'V3.2 更换录音', result: '负向效果' },
      { action: 'V3.2 缩短开场停顿', result: '待验证' },
      { action: 'V3.2 增加身份锚定', result: '待验证' },
      { action: 'V3.1 优化话术节奏', result: '部分有效' },
      { action: 'V3.1 调整语速语调', result: '无效' },
      { action: 'V3.2 增加客户称呼', result: '待验证' }
    ];

    for (const item of triedItems) {
      const itemEl = triedList.createDiv({ cls: 'wb-ops-tried-item-compact' });
      itemEl.createDiv({ cls: 'wb-ops-tried-action-compact', text: item.action });
      const resultClass = item.result === '无效' ? 'result-failed'
        : item.result === '部分有效' ? 'result-partial'
        : item.result === '待验证' ? 'result-pending'
        : 'result-failed';
      itemEl.createDiv({ cls: `wb-ops-tried-result-compact ${resultClass}`, text: item.result });
    }

    // 折叠功能
    header.onclick = () => {
      const isCollapsed = content.hasClass('wb-ops-collapsed');
      if (isCollapsed) {
        content.removeClass('wb-ops-collapsed');
        header.querySelector('.wb-ops-collapsible-icon')!.textContent = '▼';
      } else {
        content.addClass('wb-ops-collapsed');
        header.querySelector('.wb-ops-collapsible-icon')!.textContent = '▶';
      }
    };
  }

  // 7. AI Skill 选择
  private renderSkillSelectorAssistant(panel: HTMLElement): void {
    const section = panel.createDiv({ cls: 'wb-ops-assistant-section wb-ops-skill-section' });
    const header = section.createDiv({ cls: 'wb-ops-assistant-header' });
    header.createDiv({ cls: 'wb-ops-assistant-title', text: '🤖 AI Skill' });

    const content = section.createDiv({ cls: 'wb-ops-assistant-content' });
    const skillGrid = content.createDiv({ cls: 'wb-ops-skill-grid-compact' });

    for (const skill of AI_SKILL_CONFIGS) {
      const skillBtn = skillGrid.createDiv({
        cls: `wb-ops-skill-btn-compact ${this.selectedSkillId === skill.id ? 'wb-ops-skill-btn-selected' : ''}`
      });
      skillBtn.createDiv({ cls: 'wb-ops-skill-icon-compact', text: skill.icon });
      skillBtn.createDiv({ cls: 'wb-ops-skill-label-compact', text: skill.label });
      skillBtn.onclick = () => this.setSelectedSkill(skill.id);
    }
  }

  // ============================================
  // 视图切换逻辑
  // ============================================
  private switchMainView(view: ActiveMainView): void {
    if (this.activeMainView === view) return;

    this.activeMainView = view;
    this.showProblemReview = false;

    this.saveCurrentState(); // V14: 保存状态
    this.refreshAllPanels();
  }

  private switchMarketStage(stage: MarketStage): void {
    if (this.activeMarketStage === stage) return;

    this.activeMarketStage = stage;
    this.showProblemReview = false;

    // V14: 切换阶段时加载该阶段的复盘数据
    if (this.plugin) {
      const savedReview = this.plugin.getStageReview(stage);
      if (savedReview) {
        this.currentStageReview = savedReview;
      } else {
        this.currentStageReview = {};
      }
    }

    this.saveCurrentState(); // V14: 保存状态
    this.refreshAllPanels();
  }

  private switchProblemAssetType(type: ProblemAssetType): void {
    if (this.activeProblemAssetType === type) return;

    this.activeProblemAssetType = type;
    this.selectedAssetId = null; // V8: 切换类型时重置选中状态

    this.refreshAllPanels();
  }

  private setCurrentStep(step: ProblemStep): void {
    if (this.currentStep === step) return;
    this.currentStep = step;
    this.saveCurrentState(); // V14: 保存状态
    this.refreshRightPanel();
  }

  private setSelectedSkill(skillId: AISkillType): void {
    if (this.selectedSkillId === skillId) return;
    this.selectedSkillId = skillId;
    this.refreshRightPanel();
  }

  private refreshRightPanel(): void {
    if (this.rightPanelEl) {
      this.rightPanelEl.empty();
      this.renderRightPanel(this.rightPanelEl);
    }
  }

  private refreshAllPanels(): void {
    if (this.leftPanelEl) {
      this.leftPanelEl.empty();
      this.renderLeftPanel(this.leftPanelEl);
    }

    if (this.centerPanelEl) {
      this.centerPanelEl.empty();
      this.renderCenterPanel(this.centerPanelEl);
    }

    this.refreshRightPanel();
  }

  private refreshCenterPanel(): void {
    if (this.centerPanelEl) {
      this.centerPanelEl.empty();
      this.renderCenterPanel(this.centerPanelEl);
    }
  }

  // ============================================
  // FOOTER - 最小化
  // ============================================
  private renderFooter(parent: HTMLElement): void {
    const footer = parent.createDiv({ cls: 'wb-ops-footer' });
    footer.createDiv({
      cls: 'wb-ops-footer-note',
      text: '[MOCK] 数据为占位示意 · V7'
    });
  }

  async onClose() {
    this.contentEl.empty();
  }
}
