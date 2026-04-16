// Review Workbench View - 审核链路工作台

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { REVIEW_VIEW_TYPE, VIEW_CONFIGS } from '../../types/index';
import {
  ReviewStage,
  STAGE_CONFIGS,
  ReviewStats,
  CustomerContext,
  AIRecalculationResult,
  RecalcStatus,
  FreezeStatus,
  FreezeInfo,
  SyncStatus,
  ReviewStatus,
  SyncPreviewField,
  STATUS_DISPLAY,
  QueueItemData,
  SalesSupervisorData,
  CompanyTrackingData
} from '../../types/review';
import { CustomerRepo } from '../../repos/CustomerRepo';
import { CustomerMatchResult as RealCustomerMatch } from '../../repos/types';
import { createCyberHeader, createMiniStat } from '../../utils/dom-helpers';

// 手机号提取和客户匹配状态
interface PhoneRoutingResult {
  filename: string;
  normalizedFilename: string;
  extractedPhone: string | null;
  matchedCustomer: CustomerMatchResult | null;
  routingDecision: 'auto-routing' | 'manual-identify';
}

interface CustomerMatchResult {
  customerId: string;
  customerName: string;
  company: string;
  phone: string;
  matchConfidence: 'high' | 'medium' | 'low';
  summaryFilePath?: string;
}

export class ReviewWorkbenchView extends ItemView {
  private currentStage: ReviewStage = 'identify';
  private stageSwitcher: HTMLElement | null = null;
  private stageContentContainer: HTMLElement | null = null;
  private recalcStatus: RecalcStatus = 'pending';
  private freezeInfo: FreezeInfo = { status: 'unfreezed', canUnfreeze: true };
  // US-003: 子视图状态 - 监督销售视图
  private showSupervisionView: boolean = false;
  private mainContainer: HTMLElement | null = null;
  // 真实音频元素
  private audioElement: HTMLAudioElement | null = null;
  private audioCurrentTimeEl: HTMLElement | null = null;
  private audioProgressFill: HTMLElement | null = null;
  private audioProgressHandle: HTMLElement | null = null;
  private audioTotalDurationEl: HTMLElement | null = null;
  // 手机号提取结果（用于人工识别辅助）
  private currentRoutingResult: PhoneRoutingResult | null = null;
  private selectedQueueItem: QueueItemData | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return REVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return VIEW_CONFIGS[REVIEW_VIEW_TYPE].title;
  }

  getIcon(): string {
    return VIEW_CONFIGS[REVIEW_VIEW_TYPE].icon;
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass('cyber-workbench-root');
    this.contentEl.style.padding = '0';
    // US-001: 移除 overflow hidden，让 Obsidian leaf 的滚动链正常工作
    // 原问题是：父容器 overflow hidden 阻断了子面板的 overflow-y auto
    this.contentEl.style.overflow = 'visible';

    const container = this.contentEl.createDiv({ cls: 'wb-review-container' });
    this.mainContainer = container;

    // US-003: 监督销售面板不再在主页渲染，改为独立子视图入口
    // 1. Top bar (with supervision entry button)
    this.renderTopBar(container);

    // 2. Main layout
    this.renderMainLayout(container);

    // 3. Stage switcher
    this.renderStageSwitcher(container);

    // Show initial stage
    this.switchStage('identify');
  }

  // === US-006: Sales Supervisor Panel - 按销售单独复制 ===
  private renderSupervisorPanel(parent: HTMLElement): void {
    // 极简化容器 - 只显示"谁还没交录音"
    const panel = parent.createDiv({ cls: 'wb-review-supervisor-panel-simple' });

    // 简洁标题
    const header = panel.createDiv({ cls: 'wb-review-supervisor-simple-header' });
    header.createDiv({ cls: 'wb-review-supervisor-simple-title', text: '今日追录音' });
    header.createDiv({ cls: 'wb-review-supervisor-simple-subtitle', text: '点击销售复制提醒' });

    // 待收录音列表（按销售单独复制）
    const listContainer = panel.createDiv({ cls: 'wb-review-supervisor-simple-list' });

    // 三位真实销售中还没交录音的
    const pendingSales: Array<{ name: string; count: number }> = [
      { name: '李云杰', count: 3 },
      { name: '杜燕', count: 2 },
      { name: '韦宽国', count: 1 }
    ];

    for (const sales of pendingSales) {
      const row = listContainer.createDiv({ cls: 'wb-review-supervisor-simple-row' });
      row.createDiv({ cls: 'wb-review-supervisor-simple-name', text: sales.name });
      row.createDiv({ cls: 'wb-review-supervisor-simple-count', text: `${sales.count} 条待收` });
      row.createDiv({ cls: 'wb-review-supervisor-simple-status', text: '⚠' });

      // 每个销售单独的复制按钮（关键改动：按销售单独复制）
      const copyBtn = row.createEl('button', { cls: 'cyber-btn cyber-btn-small wb-review-copy-btn-single' });
      copyBtn.createSpan({ cls: 'wb-review-copy-icon', text: '📋' });

      // 复制功能（只复制该销售的提醒）
      copyBtn.addEventListener('click', () => {
        const reminderText = `${sales.name}: 还有 ${sales.count} 条录音待交，请尽快提交`;
        navigator.clipboard.writeText(reminderText).then(() => {
          const originalIcon = copyBtn.querySelector('.wb-review-copy-icon')?.textContent;
          if (copyBtn.querySelector('.wb-review-copy-icon')) {
            copyBtn.querySelector('.wb-review-copy-icon')!.textContent = '✓';
            setTimeout(() => {
              if (copyBtn.querySelector('.wb-review-copy-icon')) {
                copyBtn.querySelector('.wb-review-copy-icon')!.textContent = originalIcon || '📋';
              }
            }, 2000);
          }
        }).catch(err => {
          console.error('复制失败:', err);
        });
      });
    }

    // 返回审核台按钮
    const actionArea = panel.createDiv({ cls: 'wb-review-supervisor-simple-action' });
    const backBtn = actionArea.createEl('button', { cls: 'cyber-btn cyber-btn-secondary', text: '返回审核台' });
    backBtn.addEventListener('click', () => {
      this.toggleSupervisionView();
    });
  }

  // US-006: 删除旧的复杂销售卡片设计
  private renderSalesCardV2(parent: HTMLElement, sales: SalesSupervisorData): void {
    // 已废弃，不再使用复杂的仪表设计
  }

  private renderTopBar(parent: HTMLElement): void {
    const topBar = parent.createDiv({ cls: 'wb-review-top-bar' });

    const left = topBar.createDiv({ cls: 'wb-review-top-bar-left' });
    const title = left.createDiv({ cls: 'wb-review-title', text: '审核链路' });

    // US-001: 顶部阶段链路 - 只显示业务名称，不显示误导性数字
    const stageChain = left.createDiv({ cls: 'wb-review-stage-chain' });
    const stageNames = [
      { key: 'identify', name: '待人工识别', color: 'var(--neon-yellow)' },
      { key: 'ai-processing', name: 'AI处理中', color: 'var(--neon-purple)' },
      { key: 'confirm', name: '待确认', color: 'var(--neon-cyan)' },
      { key: 'sync', name: '待同步', color: 'var(--neon-green)' }
    ];

    for (let i = 0; i < stageNames.length; i++) {
      const stage = stageNames[i];
      const item = stageChain.createDiv({ cls: 'wb-review-stage-chain-item' });
      item.dataset.stage = stage.key;
      item.createSpan({ text: stage.name });

      // 当前阶段高亮
      if (stage.key === this.currentStage) {
        item.addClass('active');
      }

      // 点击跳转到对应阶段
      item.addEventListener('click', () => {
        this.switchStage(stage.key as ReviewStage);
        // 更新高亮状态
        stageChain.querySelectorAll('.wb-review-stage-chain-item').forEach(el => el.removeClass('active'));
        item.addClass('active');
      });

      // 添加箭头（最后一个不加）
      if (i < stageNames.length - 1) {
        stageChain.createDiv({ cls: 'wb-review-stage-chain-arrow', text: '→' });
      }
    }

    // Right: control buttons - US-003/US-004: 只保留监控面板和今日追录音
    const right = topBar.createDiv({ cls: 'wb-review-top-bar-right' });

    // US-003: 移除上传录音、新增客户、新增跟进按钮
    // US-004: 监控面板作为真正的录音入口和提醒中心
    const monitorBtn = right.createEl('button', { cls: 'wb-review-control-btn wb-review-monitor-btn' });
    monitorBtn.createSpan({ cls: 'wb-review-monitor-icon', text: '📊' });
    monitorBtn.createSpan({ text: '监控面板' });
    // US-004: 添加提醒标记（初始显示）
    const badge = monitorBtn.createSpan({ cls: 'wb-review-monitor-badge', text: '3' });
    badge.style.display = 'inline-flex';

    // US-007: 监控面板点击 - 将新录音推入左侧队列并清除红点
    monitorBtn.addEventListener('click', () => {
      // 模拟检测到新录音
      const newRecordings = [
        { id: 'new-1', filename: '张经理_新录音1.mp3' },
        { id: 'new-2', filename: '刘总监_新录音2.mp3' },
        { id: 'new-3', filename: '陈主任_新录音3.mp3' }
      ];

      // 将新录音添加到左侧队列
      this.addNewRecordingsToQueue(newRecordings);

      // 清除红点/角标
      badge.style.display = 'none';
      badge.textContent = '0';

      // 切换到待人工识别阶段
      this.switchStage('identify');

      console.log('监控面板：已将新录音推入左侧待人工识别队列');
    });

    // US-003: 今日追录音入口
    const supervisionBtn = right.createEl('button', { cls: 'wb-review-control-btn wb-review-supervision-entry' });
    supervisionBtn.createSpan({ text: '🎯 今日追录音' });
    supervisionBtn.addEventListener('click', () => {
      this.toggleSupervisionView();
    });
  }

  // US-003: 切换监督销售子视图
  private toggleSupervisionView(): void {
    this.showSupervisionView = !this.showSupervisionView;
    if (this.mainContainer) {
      this.mainContainer.empty();
      if (this.showSupervisionView) {
        this.renderSupervisionSubview(this.mainContainer);
      } else {
        this.renderTopBar(this.mainContainer);
        this.renderMainLayout(this.mainContainer);
        this.renderStageSwitcher(this.mainContainer);
        this.switchStage(this.currentStage);
      }
    }
  }

  // US-003: 监督销售独立子视图 - US-006: frontend-design 重设计
  private renderSupervisionSubview(parent: HTMLElement): void {
    const view = parent.createDiv({ cls: 'wb-review-supervision-view' });

    // US-006: 精致的头部设计
    const header = view.createDiv({ cls: 'wb-review-supervision-view-header' });
    const backBtn = header.createEl('button', { cls: 'wb-review-back-btn' });
    backBtn.createSpan({ cls: 'wb-review-back-icon', text: '←' });
    backBtn.createSpan({ text: '返回审核台' });
    backBtn.addEventListener('click', () => {
      this.toggleSupervisionView();
    });

    // US-006: 主标题区域 - 更有层次感
    const titleArea = header.createDiv({ cls: 'wb-review-supervision-title-area' });
    titleArea.createDiv({ cls: 'wb-review-supervision-main-title', text: '今日追录音' });
    titleArea.createDiv({ cls: 'wb-review-supervision-sub-title', text: '录音收集台 · 监督销售工作区' });

    // US-006: 时间和状态指示
    const statusArea = header.createDiv({ cls: 'wb-review-supervision-status-area' });
    const todayDate = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    statusArea.createDiv({ cls: 'wb-review-supervision-date', text: todayDate });
    const statusBadge = statusArea.createDiv({ cls: 'wb-review-supervision-live-badge' });
    statusBadge.createSpan({ cls: 'wb-review-live-dot' });
    statusBadge.createSpan({ text: '实时监控' });

    // US-006: 重新设计的监督面板
    this.renderSupervisorPanel(view);
  }

  private renderMainLayout(parent: HTMLElement): void {
    const main = parent.createDiv({ cls: 'wb-review-main' });
    this.stageContentContainer = main.createDiv({ cls: 'wb-review-stage-content-container' });

    // STORY-01: 初始渲染待人工识别阶段（使用独立阶段模板）
    this.renderIdentifyStageFull(this.stageContentContainer);
  }

  // ============================================
  // STORY-01: 拆掉公共骨架，改为阶段级独立模板
  // 每个阶段有自己的完整渲染方法，不再共享同一套中心壳子
  // ============================================

  // STORY-01: 待人工识别阶段 - 独立完整模板
  private renderIdentifyStageFull(parent: HTMLElement): void {
    const content = parent.createDiv({ cls: 'wb-review-stage-content stage-identify' });

    // Left panel - 待处理队列
    const left = content.createDiv({ cls: 'wb-review-left-panel' });
    left.createDiv({ cls: 'wb-review-left-panel-header', text: '待处理队列' });
    this.renderQueueList(left);

    // Center panel - 待人工识别专属内容区
    const center = content.createDiv({ cls: 'wb-review-center-panel stage-identify-center' });
    this.renderIdentifyCenter(center);

    // Right panel - 待人工识别专属右侧面板
    const right = content.createDiv({ cls: 'wb-review-right-panel stage-identify-right' });
    this.renderIdentifyRight(right);
  }

  // STORY-01: AI处理中阶段 - 独立完整模板
  private renderAIProcessingStageFull(parent: HTMLElement): void {
    const content = parent.createDiv({ cls: 'wb-review-stage-content stage-ai-processing' });

    // Left panel
    const left = content.createDiv({ cls: 'wb-review-left-panel' });
    left.createDiv({ cls: 'wb-review-left-panel-header', text: '待处理队列' });
    this.renderQueueList(left);

    // Center panel - AI处理中专属内容区
    const center = content.createDiv({ cls: 'wb-review-center-panel stage-ai-center' });
    this.renderAIProcessingCenter(center);

    // Right panel - AI处理中专属右侧面板（无音频播放器）
    const right = content.createDiv({ cls: 'wb-review-right-panel stage-ai-right' });
    this.renderAIProcessingRight(right);
  }

  // STORY-01: 待确认阶段 - 独立完整模板
  private renderConfirmStageFull(parent: HTMLElement): void {
    const content = parent.createDiv({ cls: 'wb-review-stage-content stage-confirm' });

    // Left panel
    const left = content.createDiv({ cls: 'wb-review-left-panel' });
    left.createDiv({ cls: 'wb-review-left-panel-header', text: '待处理队列' });
    this.renderQueueList(left);

    // Center panel - 待确认专属内容区
    const center = content.createDiv({ cls: 'wb-review-center-panel stage-confirm-center' });
    this.renderConfirmCenter(center);

    // Right panel - 待确认专属右侧面板（有音频和转写）
    const right = content.createDiv({ cls: 'wb-review-right-panel stage-confirm-right' });
    this.renderConfirmRight(right);
  }

  // STORY-01: 待同步阶段 - 独立完整模板
  private renderSyncStageFull(parent: HTMLElement): void {
    const content = parent.createDiv({ cls: 'wb-review-stage-content stage-sync' });

    // Left panel
    const left = content.createDiv({ cls: 'wb-review-left-panel' });
    left.createDiv({ cls: 'wb-review-left-panel-header', text: '待处理队列' });
    this.renderQueueList(left);

    // Center panel - 待同步专属内容区
    const center = content.createDiv({ cls: 'wb-review-center-panel stage-sync-center' });
    this.renderSyncCenter(center);

    // Right panel - 待同步专属右侧面板
    const right = content.createDiv({ cls: 'wb-review-right-panel stage-sync-right' });
    this.renderSyncRight(right);
  }

  // 旧的公共骨架方法已废弃，改为阶段级独立模板
  private renderStagePlaceholder(stage: ReviewStage, parent: HTMLElement): void {
    // 此方法已废弃，保留以兼容旧代码调用，实际渲染由阶段级独立方法处理
  }

  // === US-002: Simplified Queue as Customer Selector ===
  private renderQueueList(parent: HTMLElement): void {
    // US-007: 给列表添加 id，以便后续动态添加项目
    const list = parent.createDiv({ cls: 'queue-list', attr: { id: 'wb-review-queue-list' } });

    // Mock queue items - US-002: 左栏只承担选客户，移除流程状态标签
    const items: QueueItemData[] = [
      {
        id: 'q1',
        filename: '王主任_20260412.mp3',
        status: 'pending',
        reviewStatus: 'pending_review',
        syncStatus: 'unsynced',
        freezeStatus: 'unfreezed',
        currentStage: 'identify',
        salesOwner: '李云杰'
      },
      {
        id: 'q2',
        filename: '孙总监_20260411.mp3',
        status: 'processing',
        reviewStatus: 'in_review',
        syncStatus: 'unsynced',
        freezeStatus: 'unfreezed',
        currentStage: 'ai-processing',
        salesOwner: '杜燕'
      },
      {
        id: 'q3',
        filename: '赵副总_20260410.mp3',
        status: 'confirming',
        reviewStatus: 'in_review',
        syncStatus: 'unsynced',
        freezeStatus: 'unfreezed',
        currentStage: 'confirm',
        salesOwner: '韦宽国'
      }
    ];

    for (const item of items) {
      const queueItem = list.createDiv({ cls: 'queue-item' });
      queueItem.dataset.itemId = item.id;
      queueItem.dataset.stage = item.currentStage || 'identify';

      // US-002: 只显示客户/文件名，移除所有状态标签
      queueItem.createDiv({ cls: 'queue-item-title', text: item.filename });

      // US-002: 移除 status tags row 和 stage indicator，让队列更简洁

      // US-005: 队列选择不再自动跳转阶段，保持当前阶段
      queueItem.addEventListener('click', () => {
        list.querySelectorAll('.queue-item').forEach(i => i.removeClass('active'));
        queueItem.addClass('active');
        // US-005: 移除自动跳转逻辑，只在队列内标记选中状态
        // 不调用 this.switchStage(item.currentStage)
      });
    }
  }

  // === 手机号自动分流辅助方法 ===

  /**
   * 从录音文件名提取手机号
   * 规则：先删除空格，再检查是否存在连在一起的、1开头的11位手机号
   */
  private extractPhoneFromFilename(filename: string): PhoneRoutingResult {
    // 1. 删除空格
    const normalizedFilename = filename.replace(/\s+/g, '');

    // 2. 提取11位手机号（中国大陆手机号，1开头）
    const phoneRegex = /1\d{10}/g;
    const phoneMatch = normalizedFilename.match(phoneRegex);

    let extractedPhone: string | null = null;
    let matchedCustomer: CustomerMatchResult | null = null;

    if (phoneMatch && phoneMatch.length > 0) {
      // 取第一个匹配到的手机号
      extractedPhone = phoneMatch[0];

      // 3. 匹配客户库
      matchedCustomer = this.matchCustomerByPhone(extractedPhone);
    }

    // 4. 决定分流方向
    const routingDecision: 'auto-routing' | 'manual-identify' =
      (extractedPhone && matchedCustomer && matchedCustomer.matchConfidence === 'high')
        ? 'auto-routing'
        : 'manual-identify';

    return {
      filename,
      normalizedFilename,
      extractedPhone,
      matchedCustomer,
      routingDecision
    };
  }

  /**
   * 在客户库中匹配手机号（使用真实 CustomerRepo）
   * 注意：这是异步方法，调用处需使用 await 或 then
   */
  private async matchCustomerByPhoneAsync(phone: string): Promise<CustomerMatchResult | null> {
    const realMatch = await CustomerRepo.findByPhone(this.app, phone);
    if (realMatch) {
      return {
        customerId: realMatch.customerId,
        customerName: realMatch.customerName,
        company: realMatch.company,
        phone: realMatch.phone,
        matchConfidence: realMatch.matchConfidence,
        summaryFilePath: realMatch.summaryFilePath
      };
    }
    return null;
  }

  /**
   * 同步版本的手机号匹配（用于 extractPhoneFromFilename 的即时判断）
   * 注意：由于真实搜索是异步的，此方法返回 null 表示需要异步处理
   */
  private matchCustomerByPhone(phone: string): CustomerMatchResult | null {
    // 真实数据搜索是异步的，这里返回 null 表示需要人工识别
    // 实际匹配在 renderManualIdentifyPanel 中通过异步调用完成
    return null;
  }

  /**
   * 关键词搜索客户（使用真实 CustomerRepo）
   */
  private async searchCustomersByKeywordAsync(keyword: string): Promise<CustomerMatchResult[]> {
    const realMatches = await CustomerRepo.search(this.app, keyword);
    return realMatches.map(m => ({
      customerId: m.customerId,
      customerName: m.customerName,
      company: m.company,
      phone: m.phone,
      matchConfidence: m.matchConfidence,
      summaryFilePath: m.summaryFilePath
    }));
  }

  /**
   * 同步版本的关键词搜索（已废弃，改用异步版本）
   */
  private searchCustomersByKeyword(keyword: string): CustomerMatchResult[] {
    return [];
  }

  /**
   * 异步关键词搜索客户（使用真实 CustomerRepo）
   */
  private async searchCustomersByKeywordAsync(keyword: string): Promise<CustomerMatchResult[]> {
    const realMatches = await CustomerRepo.search(this.app, keyword);
    return realMatches.map(m => ({
      customerId: m.customerId,
      customerName: m.customerName,
      company: m.company,
      phone: m.phone,
      matchConfidence: m.matchConfidence,
      summaryFilePath: m.summaryFilePath
    }));
  }

  /**
   * 更新右侧客户上下文（使用真实 CustomerRepo）
   * 只做轻量展示，不写入客户摘要
   */
  private async updateCustomerContext(customer: CustomerMatchResult): Promise<void> {
    const realContext = await CustomerRepo.getContext(this.app, customer.customerId);
    if (realContext) {
      // 更新右侧面板的客户上下文卡片
      const contextCard = this.contentEl.querySelector('.wb-review-customer-context .cyber-card-body');
      if (contextCard) {
        contextCard.empty();
        // 当前摘要
        const summarySection = contextCard.createDiv({ cls: 'wb-review-context-summary' });
        summarySection.createDiv({ cls: 'wb-review-context-section-title', text: '当前摘要' });
        summarySection.createDiv({ cls: 'wb-review-context-value', text: realContext.summary });

        // 销售归属
        const salesRow = contextCard.createDiv({ cls: 'wb-review-context-row' });
        salesRow.createDiv({ cls: 'wb-review-context-label', text: '销售归属' });
        salesRow.createDiv({ cls: 'wb-review-context-value', text: realContext.salesOwner });

        // 客户池
        const poolRow = contextCard.createDiv({ cls: 'wb-review-context-row' });
        poolRow.createDiv({ cls: 'wb-review-context-label', text: '客户池' });
        poolRow.createDiv({ cls: 'wb-review-context-value', text: realContext.sourcePool });

        // 上次跟进（如有）
        if (realContext.lastFollowUp) {
          const followUpSection = contextCard.createDiv({ cls: 'wb-review-context-last-followup' });
          followUpSection.createDiv({ cls: 'wb-review-context-section-title', text: '上次跟进' });
          const followUpRow = followUpSection.createDiv({ cls: 'wb-review-context-row' });
          followUpRow.createDiv({ cls: 'wb-review-context-date', text: realContext.lastFollowUp.date });
          followUpRow.createDiv({ cls: 'wb-review-context-action', text: realContext.lastFollowUp.action });
          followUpRow.createDiv({ cls: 'wb-review-context-result', text: realContext.lastFollowUp.result });
        }

        // 累计跟进次数
        const totalRow = contextCard.createDiv({ cls: 'wb-review-context-total' });
        totalRow.createDiv({ text: `累计跟进 ${realContext.totalFollowUps} 次` });
      }
    }
  }

  /**
   * 创建新客户模板文件（模拟）
   * 实际实现需要调用 Obsidian API 创建文件
   */
  private createNewCustomerFiles(customerName: string, company: string, phone: string): void {
    console.log('创建新客户文件:', { customerName, company, phone });
    // 模拟创建文件
    // 实际实现：
    // 1. 创建客户摘要文件
    // 2. 创建初次跟进记录
    // 3. 设置默认值：source_pool = 情况未知, stage = 待建立联系
  }

  private renderStatusTag(parent: HTMLElement, config: { text: string; colorVar: string }): void {
    const tag = parent.createDiv({ cls: 'queue-item-status-tag' });
    tag.createDiv({ cls: 'queue-item-status-dot', attr: { style: `background: var(--${config.colorVar})` } });
    tag.createDiv({ cls: 'queue-item-status-text', text: config.text });
    tag.style.color = `var(--${config.colorVar})`;
  }

  // ============================================
  // 旧的公共渲染方法已废弃，由阶段级独立方法替代
  // ============================================
  private renderCenterContent(stage: ReviewStage, parent: HTMLElement): void {
    // 已废弃，保留兼容
  }

  private renderRightPanel(stage: ReviewStage, parent: HTMLElement): void {
    // 已废弃，保留兼容
  }

  private renderIdentifyStage(parent: HTMLElement): void {
    // 已废弃，由 renderIdentifyCenter 替代
  }

  // STORY-02: 待人工识别阶段中心内容 - 修复顺序：销售归属在前，搜索并确认归属在后
  private renderIdentifyCenter(parent: HTMLElement): void {
    // 模拟当前处理的录音文件
    const currentFilename = '王主任_13800138000_20260412.mp3';
    this.currentRoutingResult = this.extractPhoneFromFilename(currentFilename);

    // === 1. 归库定位标题 ===
    const titleCard = parent.createDiv({ cls: 'cyber-card' });
    titleCard.createDiv({ cls: 'cyber-card-header', text: '人工识别 - 归库定位' });
    const titleBody = titleCard.createDiv({ cls: 'cyber-card-body' });
    titleBody.createDiv({ cls: 'wb-review-identify-hint', text: '此录音需要人工判断归属，确认后将进入 AI处理 → 待确认 → 待同步 链路' });

    // === 2. 销售归属卡片（REVIEW-PROBLEM-01: 移到前面）===
    const salesCard = parent.createDiv({ cls: 'cyber-card wb-review-sales-card' });
    salesCard.createDiv({ cls: 'cyber-card-header', text: '销售归属' });
    const salesBody = salesCard.createDiv({ cls: 'cyber-card-body wb-review-sales-body' });

    const currentRow = salesBody.createDiv({ cls: 'wb-review-sales-current-row' });
    currentRow.createDiv({ cls: 'wb-review-sales-current-label', text: '当前归属' });
    currentRow.createDiv({ cls: 'wb-review-sales-current-value', text: '李云杰' });

    const salesFieldRow = salesBody.createDiv({ cls: 'field-row wb-review-sales-row' });
    salesFieldRow.createDiv({ cls: 'field-label', text: '调整归属' });

    const salesSelect = salesFieldRow.createEl('select', { cls: 'field-editable wb-review-sales-select' });
    const realSalesOptions = ['李云杰', '杜燕', '韦宽国'];
    for (const opt of realSalesOptions) {
      const optionEl = salesSelect.createEl('option', { value: opt, text: opt });
      if (opt === '李云杰') optionEl.selected = true;
    }

    // === 3. 搜索客户 + 归库定位核心功能（REVIEW-PROBLEM-01: 移到后面）===
    this.renderManualIdentifyPanel(parent, this.currentRoutingResult);
  }

  // STORY-05: 待人工识别阶段右侧内容 - 参考备份基线
  private renderIdentifyRight(parent: HTMLElement): void {
    // 客户上下文卡片
    this.renderCustomerContextCard(parent);

    // 音频播放器
    this.renderAudioPlayer(parent);

    // 辅助信息卡片（参考备份风格）
    const assistCard = parent.createDiv({ cls: 'cyber-card' });
    assistCard.createDiv({ cls: 'cyber-card-header', text: '辅助信息' });
    const assistBody = assistCard.createDiv({ cls: 'cyber-card-body' });
    assistBody.createDiv({ cls: 'field-value', text: '客户历史跟进 3 次' });
  }

  // 需人工识别时的归库定位面板（US-002: 职责收口，只做搜索+确认）
  private renderManualIdentifyPanel(parent: HTMLElement, routing: PhoneRoutingResult): void {
    const manualCard = parent.createDiv({ cls: 'cyber-card wb-review-attribution-card' });
    // US-002: 简化标题，聚焦"归库定位"
    manualCard.createDiv({ cls: 'cyber-card-header', text: '搜索并确认归属' });
    const manualBody = manualCard.createDiv({ cls: 'cyber-card-body' });

    // US-002: 移除警告文字，只保留搜索功能

    // === 关键词搜索客户（使用真实 CustomerRepo）===
    const searchSection = manualBody.createDiv({ cls: 'wb-review-search-section' });
    searchSection.createDiv({ cls: 'wb-review-search-title', text: '搜索已有客户' });

    const searchRow = searchSection.createDiv({ cls: 'wb-review-search-row' });
    const searchInput = searchRow.createEl('input', {
      cls: 'wb-review-search-input',
      attr: { placeholder: '输入客户名、公司名或关键词...', type: 'text' }
    });
    const searchBtn = searchRow.createEl('button', { cls: 'cyber-btn cyber-btn-secondary wb-review-search-btn', text: '搜索' });

    // 搜索结果容器
    const searchResults = searchSection.createDiv({ cls: 'wb-review-search-results hidden' });

    // 搜索功能实现（异步调用真实 CustomerRepo）
    searchBtn.addEventListener('click', async () => {
      const keyword = searchInput.value.trim();
      if (keyword) {
        searchResults.empty();
        searchResults.removeClass('hidden');
        searchResults.createDiv({ cls: 'wb-review-search-loading', text: '正在搜索...' });

        const results = await this.searchCustomersByKeywordAsync(keyword);
        searchResults.empty();

        if (results.length > 0) {
          searchResults.createDiv({ cls: 'wb-review-search-results-header', text: `找到 ${results.length} 个匹配客户` });
          for (const customer of results) {
            const resultItem = searchResults.createDiv({ cls: 'wb-review-search-result-item' });
            resultItem.createDiv({ cls: 'wb-review-search-result-name', text: customer.customerName });
            resultItem.createDiv({ cls: 'wb-review-search-result-company', text: customer.company });
            resultItem.createDiv({ cls: 'wb-review-search-result-phone', text: customer.phone });

            // 点击选择客户
            resultItem.addEventListener('click', async () => {
              searchResults.querySelectorAll('.wb-review-search-result-item').forEach(item => item.removeClass('selected'));
              resultItem.addClass('selected');
              // 更新归属选择状态
              const existOpt = manualBody.querySelector('.wb-review-attribution-option:first-child');
              if (existOpt) {
                manualBody.querySelectorAll('.wb-review-attribution-option').forEach(opt => opt.removeClass('selected'));
                existOpt.addClass('selected');
              }
              // 更新右侧客户上下文
              await this.updateCustomerContext(customer);
            });
          }
        } else {
          searchResults.createDiv({ cls: 'wb-review-search-no-results', text: '未找到匹配客户，建议新增客户' });
        }
      }
    });

    // 实时搜索（输入时自动触发异步搜索）
    searchInput.addEventListener('input', async () => {
      const keyword = searchInput.value.trim();
      if (keyword.length >= 2) {
        searchResults.empty();
        searchResults.removeClass('hidden');
        searchResults.createDiv({ cls: 'wb-review-search-loading', text: '搜索中...' });

        const results = await this.searchCustomersByKeywordAsync(keyword);
        searchResults.empty();

        if (results.length > 0) {
          searchResults.createDiv({ cls: 'wb-review-search-results-header', text: `找到 ${results.length} 个匹配` });
          for (const customer of results) {
            const resultItem = searchResults.createDiv({ cls: 'wb-review-search-result-item' });
            resultItem.createDiv({ cls: 'wb-review-search-result-name', text: customer.customerName });
            resultItem.createDiv({ cls: 'wb-review-search-result-company', text: customer.company });
            resultItem.addEventListener('click', async () => {
              searchResults.querySelectorAll('.wb-review-search-result-item').forEach(item => item.removeClass('selected'));
              resultItem.addClass('selected');
              // 更新右侧客户上下文
              await this.updateCustomerContext(customer);
            });
          }
        } else {
          searchResults.createDiv({ cls: 'wb-review-search-no-results', text: '未找到，建议新增客户' });
        }
      } else if (keyword.length === 0) {
        searchResults.addClass('hidden');
      }
    });

    // === 归属选择区 ===
    const attrOptions = manualBody.createDiv({ cls: 'wb-review-attribution-options' });

    // 选项1: 归入现有客户
    const existOpt = attrOptions.createDiv({ cls: 'wb-review-attribution-option selected' });
    existOpt.createDiv({ cls: 'wb-review-attribution-opt-radio', text: '◉' });
    existOpt.createDiv({ cls: 'wb-review-attribution-opt-label', text: '归入现有客户' });
    existOpt.createDiv({ cls: 'wb-review-attribution-opt-desc', text: '匹配已有客户或为其新增跟进' });

    // 选项2: 新增客户
    const newCustOpt = attrOptions.createDiv({ cls: 'wb-review-attribution-option' });
    newCustOpt.createDiv({ cls: 'wb-review-attribution-opt-radio', text: '○' });
    newCustOpt.createDiv({ cls: 'wb-review-attribution-opt-label', text: '新增客户' });
    newCustOpt.createDiv({ cls: 'wb-review-attribution-opt-desc', text: '创建新客户档案并建档' });

    // 切换交互
    existOpt.addEventListener('click', () => {
      attrOptions.querySelectorAll('.wb-review-attribution-option').forEach(opt => {
        opt.removeClass('selected');
        const radio = opt.querySelector('.wb-review-attribution-opt-radio');
        if (radio) radio.textContent = '○';
      });
      existOpt.addClass('selected');
      const radio = existOpt.querySelector('.wb-review-attribution-opt-radio');
      if (radio) radio.textContent = '◉';
      // 隐藏新增客户表单
      const newCustomerForm = manualBody.querySelector('.wb-review-new-customer-form');
      if (newCustomerForm) newCustomerForm.addClass('hidden');
    });

    newCustOpt.addEventListener('click', () => {
      attrOptions.querySelectorAll('.wb-review-attribution-option').forEach(opt => {
        opt.removeClass('selected');
        const radio = opt.querySelector('.wb-review-attribution-opt-radio');
        if (radio) radio.textContent = '○';
      });
      newCustOpt.addClass('selected');
      const radio = newCustOpt.querySelector('.wb-review-attribution-opt-radio');
      if (radio) radio.textContent = '◉';
      // 显示新增客户表单
      const existingForm = manualBody.querySelector('.wb-review-new-customer-form');
      if (existingForm) existingForm.removeClass('hidden');
      else this.renderNewCustomerForm(manualBody, routing);
    });

    // === 确认操作 ===
    const attrActions = manualBody.createDiv({ cls: 'wb-review-attribution-actions' });
    const confirmBtn = attrActions.createEl('button', { cls: 'cyber-btn cyber-btn-primary', text: '确认处理' });
    confirmBtn.addEventListener('click', () => {
      // 检查当前选择
      const isNewCustomer = newCustOpt.hasClass('selected');
      if (isNewCustomer) {
        // 新增客户：调用模板建档
        const nameInput = manualBody.querySelector('.wb-review-new-customer-name input') as HTMLInputElement;
        const companyInput = manualBody.querySelector('.wb-review-new-customer-company input') as HTMLInputElement;
        const phoneInput = manualBody.querySelector('.wb-review-new-customer-phone input') as HTMLInputElement;

        if (nameInput && companyInput && phoneInput) {
          this.createNewCustomerFiles(nameInput.value, companyInput.value, phoneInput.value || routing.extractedPhone || '');
          // 推进到待确认阶段
          this.switchStage('confirm');
        }
      } else {
        // 归入现有客户：推进到AI处理
        this.switchStage('ai-processing');
      }
    });
  }

  // 新增客户表单
  private renderNewCustomerForm(parent: HTMLElement, routing: PhoneRoutingResult): void {
    const form = parent.createDiv({ cls: 'wb-review-new-customer-form' });

    form.createDiv({ cls: 'wb-review-new-customer-title', text: '新建客户信息' });

    // 客户名
    const nameRow = form.createDiv({ cls: 'wb-review-new-customer-name' });
    nameRow.createDiv({ cls: 'wb-review-new-customer-label', text: '客户名' });
    nameRow.createEl('input', {
      cls: 'wb-review-new-customer-input',
      attr: { placeholder: '请输入客户名', type: 'text' }
    });

    // 公司名
    const companyRow = form.createDiv({ cls: 'wb-review-new-customer-company' });
    companyRow.createDiv({ cls: 'wb-review-new-customer-label', text: '公司名' });
    companyRow.createEl('input', {
      cls: 'wb-review-new-customer-input',
      attr: { placeholder: '请输入公司名', type: 'text' }
    });

    // 手机号（如果已提取则自动填充）
    const phoneRow = form.createDiv({ cls: 'wb-review-new-customer-phone' });
    phoneRow.createDiv({ cls: 'wb-review-new-customer-label', text: '手机号' });
    const phoneInput = phoneRow.createEl('input', {
      cls: 'wb-review-new-customer-input',
      attr: { placeholder: '请输入手机号', type: 'text', value: routing.extractedPhone || '' }
    });

    // 后续流程说明
    const flowHint = form.createDiv({ cls: 'wb-review-new-customer-flow-hint' });
    flowHint.createDiv({ text: '建档后将自动进入：' });
    const flowSteps = flowHint.createDiv({ cls: 'wb-review-new-customer-flow-steps' });
    flowSteps.createDiv({ cls: 'wb-review-flow-step', text: '创建客户摘要' });
    flowSteps.createDiv({ cls: 'wb-review-flow-arrow', text: '→' });
    flowSteps.createDiv({ cls: 'wb-review-flow-step', text: '创建初次跟进' });
    flowSteps.createDiv({ cls: 'wb-review-flow-arrow', text: '→' });
    flowSteps.createDiv({ cls: 'wb-review-flow-step', text: '字段确认' });
    flowSteps.createDiv({ cls: 'wb-review-flow-arrow', text: '→' });
    flowSteps.createDiv({ cls: 'wb-review-flow-step', text: '同步封板' });

    // 默认值说明
    const defaultHint = form.createDiv({ cls: 'wb-review-new-customer-default-hint' });
    defaultHint.createDiv({ text: '默认设置：客户池 = 情况未知 | stage = 待建立联系' });
  }

  // === US-001: Customer Context Block - 只读接线，等待客户选择后异步加载 ===
  private renderCustomerContextCard(parent: HTMLElement): void {
    const contextCard = parent.createDiv({ cls: 'cyber-card wb-review-customer-context' });
    contextCard.createDiv({ cls: 'cyber-card-header', text: '客户上下文' });
    const body = contextCard.createDiv({ cls: 'cyber-card-body' });

    // 初始状态：等待客户选择
    // 当用户在搜索结果中选择客户后，通过 updateCustomerContext 方法异步更新此区域
    body.createDiv({ cls: 'wb-review-context-placeholder', text: '搜索并选择客户后显示上下文' });
  }

  // STORY-01: AI处理中阶段中心内容 - 独立模板
  private renderAIProcessingCenter(parent: HTMLElement): void {
    parent.addClass('stage-ai-processing');

    // 当前处理项上下文块
    const contextCard = parent.createDiv({ cls: 'cyber-card wb-review-ai-context-card' });
    contextCard.createDiv({ cls: 'cyber-card-header', text: '当前处理项' });
    const contextBody = contextCard.createDiv({ cls: 'cyber-card-body' });

    const itemInfo = contextBody.createDiv({ cls: 'wb-review-ai-item-info' });
    itemInfo.createDiv({ cls: 'wb-review-ai-item-name', text: '王主任_20260412.mp3' });
    itemInfo.createDiv({ cls: 'wb-review-ai-item-meta', text: '时长: 07:00 | 销售: 李云杰' });

    const statusRow = contextBody.createDiv({ cls: 'wb-review-ai-status-row' });
    statusRow.createDiv({ cls: 'wb-review-ai-status-badge', text: 'AI自动处理中' });
    statusRow.createDiv({ cls: 'wb-review-ai-status-time', text: '预计耗时: 30-60秒' });

    // 分阶段进度链路
    const progressCard = parent.createDiv({ cls: 'cyber-card wb-review-ai-progress-card' });
    progressCard.createDiv({ cls: 'cyber-card-header', text: '处理进度' });
    const progressBody = progressCard.createDiv({ cls: 'cyber-card-body' });

    const progressChain = progressBody.createDiv({ cls: 'wb-review-ai-progress-chain' });
    const steps = [
      { name: '提取转写', desc: '从音频提取文字内容', status: 'completed' },
      { name: '分析意图', desc: '识别客户意向和动作', status: 'completed' },
      { name: '匹配规则', desc: '根据池规则生成建议', status: 'active' },
      { name: '生成建议', desc: '输出下一步行动建议', status: 'pending' }
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepNode = progressChain.createDiv({ cls: `wb-review-ai-step ${step.status}` });
      stepNode.createDiv({ cls: 'wb-review-ai-step-num', text: `${i + 1}` });
      const stepContent = stepNode.createDiv({ cls: 'wb-review-ai-step-content' });
      stepContent.createDiv({ cls: 'wb-review-ai-step-name', text: step.name });
      stepContent.createDiv({ cls: 'wb-review-ai-step-desc', text: step.desc });
      if (step.status === 'completed') {
        stepNode.createDiv({ cls: 'wb-review-ai-step-icon completed', text: '✓' });
      } else if (step.status === 'active') {
        stepNode.createDiv({ cls: 'wb-review-ai-step-icon active', text: '⋯' });
      }
      if (i < steps.length - 1) {
        const arrow = progressChain.createDiv({ cls: 'wb-review-ai-step-arrow' });
        if (steps[i].status === 'completed' && steps[i + 1].status !== 'pending') {
          arrow.addClass('active');
        }
      }
    }

    // 当前步骤说明
    const currentStepCard = parent.createDiv({ cls: 'cyber-card wb-review-ai-current-card' });
    currentStepCard.createDiv({ cls: 'cyber-card-header', text: '当前步骤说明' });
    const currentBody = currentStepCard.createDiv({ cls: 'cyber-card-body' });
    currentBody.createDiv({ cls: 'wb-review-ai-explain-title', text: '匹配规则' });
    currentBody.createDiv({ cls: 'wb-review-ai-explain-text', text: '系统正在根据已提取的信息，匹配客户池规则和stage建议逻辑。此步骤自动完成，无需人工干预。' });
    currentBody.createDiv({ cls: 'wb-review-ai-explain-detail', text: '• 读取已提取的需求字段状态\n• 根据客户池规则生成source_pool建议\n• 根据stage规则生成next_action建议\n• 输出异常命中提示（如有）' });

    // 后续流转
    const flowCard = parent.createDiv({ cls: 'cyber-card wb-review-ai-flow-card' });
    flowCard.createDiv({ cls: 'cyber-card-header', text: '后续流转' });
    const flowBody = flowCard.createDiv({ cls: 'cyber-card-body' });
    const flowSteps = flowBody.createDiv({ cls: 'wb-review-ai-flow-steps' });
    flowSteps.createDiv({ cls: 'wb-review-ai-flow-item current', text: 'AI处理中' });
    flowSteps.createDiv({ cls: 'wb-review-ai-flow-arrow', text: '→' });
    flowSteps.createDiv({ cls: 'wb-review-ai-flow-item next', text: '待确认' });
    flowSteps.createDiv({ cls: 'wb-review-ai-flow-arrow', text: '→' });
    flowSteps.createDiv({ cls: 'wb-review-ai-flow-item', text: '待同步' });
    flowBody.createDiv({ cls: 'wb-review-ai-flow-explain', text: '处理完成后，系统将自动推进到「待确认」阶段，届时您需要人工确认AI提取结果和建议字段。' });

    // 操作提示
    const hintCard = parent.createDiv({ cls: 'cyber-card wb-review-ai-hint-card' });
    hintCard.createDiv({ cls: 'cyber-card-header', text: '操作提示' });
    const hintBody = hintCard.createDiv({ cls: 'cyber-card-body' });
    hintBody.createDiv({ cls: 'wb-review-ai-hint-text', text: '此阶段为AI自动处理，您可切换查看其他待处理项。处理完成后系统会自动提醒并推进到下一阶段。' });

    // 底部快捷操作
    const actionRow = parent.createDiv({ cls: 'wb-review-ai-action-row' });
    actionRow.createEl('button', { cls: 'cyber-btn cyber-btn-secondary', text: '查看其他待处理项' });
    actionRow.createEl('button', { cls: 'cyber-btn cyber-btn-primary', text: '等待处理完成', attr: { disabled: 'true' } });
  }

  // STORY-01: AI处理中阶段右侧内容 - 无音频播放器
  private renderAIProcessingRight(parent: HTMLElement): void {
    // AI处理中阶段不显示音频播放器，显示辅助信息即可
    const assistCard = parent.createDiv({ cls: 'cyber-card' });
    assistCard.createDiv({ cls: 'cyber-card-header', text: '辅助信息' });
    const assistBody = assistCard.createDiv({ cls: 'cyber-card-body' });
    assistBody.createDiv({ cls: 'field-value', text: 'AI 处理中，无需人工干预' });
    assistBody.createDiv({ cls: 'field-value', text: '系统将在完成后自动提醒' });
  }

  // STORY-01: 待确认阶段中心内容 - 独立模板
  private renderConfirmCenter(parent: HTMLElement): void {
    // AI提取结果卡片
    const aiCard = parent.createDiv({ cls: 'cyber-card priority-high' });
    aiCard.createDiv({ cls: 'cyber-card-header', text: 'AI提取结果' });
    const aiBody = aiCard.createDiv({ cls: 'cyber-card-body' });

    // 需求维度确认
    const needsCard = parent.createDiv({ cls: 'cyber-card' });
    needsCard.createDiv({ cls: 'cyber-card-header', text: '需求维度确认' });
    const needsBody = needsCard.createDiv({ cls: 'cyber-card-body' });

    const needDimensions: Array<{ key: string; label: string; status: string; content: string }> = [
      { key: 'pain', label: '痛点', status: '已问清', content: '效率瓶颈是目前最大的痛点' },
      { key: 'pain_attitude', label: '对痛态度', status: '没问', content: '' },
      { key: 'solution', label: '解决方案期望', status: '已问清', content: '希望能有数字化解决方案' },
      { key: 'decision', label: '决策权', status: '已问清', content: '我作为技术总监，这事我来拍板' },
      { key: 'budget', label: '预算', status: '已问清', content: '预算大概50万左右' },
      { key: 'urgency', label: '紧迫度', status: '没问清', content: '提到时间紧迫但未确认具体日期' },
      { key: 'concern', label: '顾虑', status: '没问', content: '' }
    ];

    for (const need of needDimensions) {
      const row = needsBody.createDiv({ cls: 'field-row wb-review-need-row' });
      row.dataset.dimensionKey = need.key;
      row.createDiv({ cls: 'field-label wb-review-need-label', text: need.label });
      const statusSelect = row.createEl('select', { cls: 'field-editable wb-review-need-status' });
      const statusOptions = ['没问', '没问清', '已问清'];
      for (const opt of statusOptions) {
        const optionEl = statusSelect.createEl('option', { value: opt, text: opt });
        if (opt === need.status) optionEl.selected = true;
      }
      const contentDiv = row.createDiv({ cls: 'wb-review-need-content' });
      contentDiv.textContent = need.content || '(无内容)';
      const statusIndicator = row.createDiv({ cls: 'wb-review-need-status-indicator' });
      this.updateStatusIndicator(statusIndicator, need.status);

      row.addEventListener('click', (e) => {
        if (!(e.target instanceof HTMLElement && e.target.closest('.wb-review-need-status'))) {
          needsBody.querySelectorAll('.wb-review-need-row').forEach(r => r.removeClass('selected'));
          row.addClass('selected');
          this.highlightDimensionEvidence(need.key);
        }
      });

      statusSelect.addEventListener('change', () => {
        const newStatus = statusSelect.value;
        need.status = newStatus;
        this.updateStatusIndicator(statusIndicator, newStatus);
        if (newStatus === '没问') {
          contentDiv.textContent = '(无内容)';
        }
        this.triggerRecalculation(need.key);
        row.addClass('modified');
        this.showModificationFeedback(row, need.label, newStatus);
      });
    }

    // AI重算面板
    this.renderRecalculationPanel(parent);

    // 推进动作卡片
    const actionCard = parent.createDiv({ cls: 'cyber-card' });
    actionCard.createDiv({ cls: 'cyber-card-header', text: '推进动作' });
    const actionBody = actionCard.createDiv({ cls: 'cyber-card-body' });
    actionBody.createDiv({ cls: 'field-row' });
    actionBody.createDiv({ cls: 'field-label', text: '下一步' });
    actionBody.createEl('input', { cls: 'field-editable', attr: { value: '发送方案文档' } });
  }

  // STORY-01: 待确认阶段右侧内容 - 有音频和转写
  private renderConfirmRight(parent: HTMLElement): void {
    // 音频播放器
    this.renderAudioPlayer(parent);

    // 转写正文
    this.renderReadingLoop(parent);

    // 辅助信息
    const assistCard = parent.createDiv({ cls: 'cyber-card' });
    assistCard.createDiv({ cls: 'cyber-card-header', text: '辅助信息' });
    const assistBody = assistCard.createDiv({ cls: 'cyber-card-body' });
    assistBody.createDiv({ cls: 'field-value', text: '客户历史跟进 3 次' });
  }

  // === US-002: AI Recalculation + New-Old Comparison ===
  private renderRecalculationPanel(parent: HTMLElement): void {
    const panel = parent.createDiv({ cls: 'wb-review-recalc-panel' });

    // Trigger section
    const triggerSection = panel.createDiv({ cls: 'wb-review-recalc-trigger' });
    triggerSection.createEl('button', { cls: 'cyber-btn cyber-btn-secondary', text: '触发AI重算' });

    const statusText = this.recalcStatus === 'pending' ? '待重算' :
                       this.recalcStatus === 'calculating' ? '计算中...' :
                       this.recalcStatus === 'ready' ? '重算完成' : '已确认';
    triggerSection.createDiv({ cls: 'wb-review-recalc-status', text: statusText });

    // Comparison table
    const compareTable = panel.createDiv({ cls: 'wb-review-recalc-compare' });
    compareTable.createDiv({ cls: 'wb-review-recalc-compare-header', text: '新旧对比' });

    const tableBody = compareTable.createDiv({ cls: 'wb-review-recalc-compare-body' });

    // Mock comparison data
    const rows: AIRecalculationResult[] = [
      { fieldKey: 'intent', fieldName: '意向等级', oldValue: '中等', newValue: '高', changed: true, confidence: 0.85 },
      { fieldKey: 'next_action', fieldName: '下一步建议', oldValue: '发送资料', newValue: '安排演示', changed: true, confidence: 0.92 },
      { fieldKey: 'urgency', fieldName: '紧迫度', oldValue: '一般', newValue: '紧急', changed: true, confidence: 0.78 }
    ];

    for (const row of rows) {
      this.renderCompareRow(tableBody, row);
    }

    // Confirm button
    const confirmSection = panel.createDiv({ cls: 'wb-review-recalc-confirm' });
    confirmSection.createEl('button', { cls: 'cyber-btn cyber-btn-primary', text: '确认写入建议字段' });
  }

  private renderCompareRow(parent: HTMLElement, row: AIRecalculationResult): void {
    const rowEl = parent.createDiv({ cls: 'wb-review-recalc-row' });
    if (row.changed) rowEl.addClass('changed');

    rowEl.createDiv({ cls: 'wb-review-recalc-field', text: row.fieldName });
    rowEl.createDiv({ cls: 'wb-review-recalc-old', text: row.oldValue });
    rowEl.createDiv({ cls: 'wb-review-recalc-arrow', text: '→' });
    rowEl.createDiv({ cls: 'wb-review-recalc-new', text: row.newValue });

    // Confidence indicator
    const confidenceBar = rowEl.createDiv({ cls: 'wb-review-recalc-confidence' });
    confidenceBar.createDiv({
      cls: 'wb-review-recalc-confidence-fill',
      attr: { style: `width: ${row.confidence * 100}%` }
    });
  }

  // STORY-01: 待同步阶段中心内容 - 独立模板
  private renderSyncCenter(parent: HTMLElement): void {
    // 封板状态卡片
    const freezeCard = parent.createDiv({ cls: 'cyber-card wb-review-freeze-card' });
    freezeCard.createDiv({ cls: 'cyber-card-header', text: '封板状态' });
    const freezeBody = freezeCard.createDiv({ cls: 'cyber-card-body' });

    const freezeStatusRow = freezeBody.createDiv({ cls: 'wb-review-freeze-status-row' });
    const statusDisplay = STATUS_DISPLAY[this.freezeInfo.status];
    freezeStatusRow.createDiv({ cls: 'wb-review-freeze-status', text: statusDisplay.text });

    const metaText = this.freezeInfo.status === 'unfreezed' ?
      '封板后数据将锁定并准备同步' :
      this.freezeInfo.status === 'freezed' ?
        `已于 ${this.freezeInfo.freezedAt || '未知时间'} 封板` : '封板处理中';
    freezeStatusRow.createDiv({ cls: 'wb-review-freeze-meta', text: metaText });

    // 同步预览表格
    const previewCard = parent.createDiv({ cls: 'cyber-card' });
    previewCard.createDiv({ cls: 'cyber-card-header', text: '同步预览（完整字段）' });
    const previewBody = previewCard.createDiv({ cls: 'cyber-card-body' });

    this.renderSyncFieldTable(previewBody);

    // 最终操作卡片
    const actionCard = parent.createDiv({ cls: 'cyber-card priority-high' });
    actionCard.createDiv({ cls: 'cyber-card-header', text: '封板与同步' });
    const actionBody = actionCard.createDiv({ cls: 'cyber-card-body' });

    const freezeBtn = actionBody.createEl('button', { cls: 'cyber-btn cyber-btn-primary', text: '确认封板' });
    freezeBtn.addEventListener('click', () => {
      this.freezeInfo = {
        status: 'freezed',
        freezedAt: new Date().toISOString(),
        freezedBy: 'operator',
        canUnfreeze: false
      };
      this.switchStage('sync');
    });

    const syncBtn = actionBody.createEl('button', {
      cls: 'cyber-btn cyber-btn-secondary',
      text: '执行同步',
      attr: { disabled: this.freezeInfo.status !== 'freezed' ? 'true' : '' }
    });

    actionBody.createDiv({
      cls: 'wb-review-sync-hint',
      text: this.freezeInfo.status !== 'freezed' ? '封板后方可执行同步操作' : '点击执行同步到客户摘要'
    });
  }

  // STORY-01: 待同步阶段右侧内容
  private renderSyncRight(parent: HTMLElement): void {
    // 音频播放器
    this.renderAudioPlayer(parent);

    // 辅助信息
    const assistCard = parent.createDiv({ cls: 'cyber-card' });
    assistCard.createDiv({ cls: 'cyber-card-header', text: '辅助信息' });
    const assistBody = assistCard.createDiv({ cls: 'cyber-card-body' });
    assistBody.createDiv({ cls: 'field-value', text: '准备同步到客户摘要' });
    assistBody.createDiv({ cls: 'field-value', text: '封板后不可修改' });
  }

  // === US-003: Full sync field table ===
  private renderSyncFieldTable(parent: HTMLElement): void {
    const table = parent.createDiv({ cls: 'wb-review-sync-table' });

    // Header
    const header = table.createDiv({ cls: 'wb-review-sync-table-header' });
    header.createDiv({ text: '字段' });
    header.createDiv({ text: '原值' });
    header.createDiv({ text: '新值' });
    header.createDiv({ text: '目标笔记' });
    header.createDiv({ text: '状态' });

    // Mock full field list
    const fields: SyncPreviewField[] = [
      { key: 'intent', label: '意向等级', oldValue: '未知', newValue: '高', targetNote: '客户卡片', changed: true, syncStatus: 'unsynced' },
      { key: 'next_action', label: '下一步动作', oldValue: '无', newValue: '安排演示', targetNote: '跟进记录', changed: true, syncStatus: 'unsynced' },
      { key: 'next_date', label: '下次日期', oldValue: '无', newValue: '2026-04-20', targetNote: '跟进记录', changed: true, syncStatus: 'unsynced' },
      { key: 'pain', label: '痛点', oldValue: '未记录', newValue: '效率瓶颈', targetNote: '客户卡片', changed: true, syncStatus: 'unsynced' },
      { key: 'budget', label: '预算', oldValue: '未问', newValue: '50万', targetNote: '客户卡片', changed: true, syncStatus: 'unsynced' },
      { key: 'source_pool', label: '客户池', oldValue: '情况未知', newValue: '优先跟进', targetNote: '客户卡片', changed: true, syncStatus: 'unsynced' }
    ];

    for (const field of fields) {
      const row = table.createDiv({ cls: 'wb-review-sync-row' });
      if (field.changed) row.addClass('changed');

      row.createDiv({ cls: 'wb-review-sync-cell', text: field.label });
      row.createDiv({ cls: 'wb-review-sync-cell wb-review-sync-old', text: field.oldValue });
      row.createDiv({ cls: 'wb-review-sync-cell wb-review-sync-new', text: field.newValue });
      row.createDiv({ cls: 'wb-review-sync-cell wb-review-sync-target', text: field.targetNote });

      const statusDisplay = STATUS_DISPLAY[field.syncStatus];
      row.createDiv({
        cls: 'wb-review-sync-cell wb-review-sync-status',
        attr: { style: `color: var(--${statusDisplay.colorVar})` },
        text: statusDisplay.text
      });
    }
  }

  private renderRightPanel(stage: ReviewStage, parent: HTMLElement): void {
    // US-003: identify 阶段右侧显示客户上下文作为辅助信息
    if (stage === 'identify') {
      this.renderCustomerContextCard(parent);
    }

    if (stage !== 'ai-processing') {
      this.renderAudioPlayer(parent);
    }

    if (stage === 'confirm') {
      this.renderReadingLoop(parent);
    }

    const assistCard = parent.createDiv({ cls: 'cyber-card' });
    assistCard.createDiv({ cls: 'cyber-card-header', text: '辅助信息' });
    const assistBody = assistCard.createDiv({ cls: 'cyber-card-body' });
    assistBody.createDiv({ cls: 'field-value', text: '客户历史跟进 3 次' });
  }

  private renderAudioPlayer(parent: HTMLElement): void {
    const player = parent.createDiv({ cls: 'wb-review-audio-player' });
    player.id = 'wb-review-audio-player-container';

    // US-001: 使用 Obsidian vault API 正确解析音频源路径
    // 直接相对路径在插件视图内无法正确解析，需要使用 vault.getResourcePath
    this.audioElement = player.createEl('audio', {
      attr: {
        preload: 'metadata'
      }
    });
    this.audioElement.style.display = 'none';

    // US-001: 异步获取正确的 vault 资源路径
    this.resolveAudioSource();

    // US-004: 当前时间显示（可联动更新）
    const info = player.createDiv({ cls: 'wb-review-audio-info' });
    this.audioCurrentTimeEl = info.createDiv({ cls: 'wb-review-audio-current-time', text: '00:00' });
    this.audioTotalDurationEl = info.createDiv({ text: '加载中...' });

    // US-004: 进度条（与真实音频同步）
    const progressContainer = player.createDiv({ cls: 'wb-review-audio-progress-container' });
    this.audioProgressFill = progressContainer.createDiv({ cls: 'wb-review-audio-progress-fill' });
    this.audioProgressFill.style.width = '0%';

    this.audioProgressHandle = progressContainer.createDiv({ cls: 'wb-review-audio-progress-handle' });
    this.audioProgressHandle.style.left = '0%';

    // 真实音频事件监听
    if (this.audioElement) {
      // US-001: 加载元数据后显示总时长
      this.audioElement.addEventListener('loadedmetadata', () => {
        if (this.audioElement && this.audioTotalDurationEl) {
          const duration = this.audioElement.duration;
          if (duration && duration > 0) {
            this.audioTotalDurationEl.textContent = this.formatTime(Math.floor(duration));
          } else {
            this.audioTotalDurationEl.textContent = '加载失败';
          }
        }
      });

      // US-003: 时间更新时同步进度条
      this.audioElement.addEventListener('timeupdate', () => {
        if (this.audioElement && this.audioProgressFill && this.audioCurrentTimeEl && this.audioProgressHandle) {
          const currentTime = this.audioElement.currentTime;
          const duration = this.audioElement.duration || 0;
          if (duration > 0) {
            const percent = (currentTime / duration) * 100;

            this.audioProgressFill.style.width = `${percent}%`;
            this.audioProgressHandle.style.left = `${percent}%`;
            this.audioCurrentTimeEl.textContent = this.formatTime(Math.floor(currentTime));
          }
        }
      });

      // US-002: 播放结束 - 恢复按钮状态
      this.audioElement.addEventListener('ended', () => {
        const playBtn = player.querySelector('.wb-review-audio-play-btn');
        if (playBtn) {
          playBtn.textContent = '▶ 播放';
          playBtn.removeClass('playing');
        }
      });

      // US-002: 播放错误处理
      this.audioElement.addEventListener('error', (e) => {
        console.error('音频加载/播放错误:', e);
        if (this.audioTotalDurationEl) {
          this.audioTotalDurationEl.textContent = '加载失败';
        }
        // 确保按钮状态正确
        const playBtn = player.querySelector('.wb-review-audio-play-btn');
        if (playBtn) {
          playBtn.textContent = '▶ 播放';
          playBtn.removeClass('playing');
        }
      });
    }

    // 进度条点击跳转
    progressContainer.addEventListener('click', (e) => {
      if (this.audioElement && this.audioElement.duration > 0) {
        const rect = progressContainer.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width);
        const duration = this.audioElement.duration;
        this.audioElement.currentTime = percent * duration;
      }
    });

    const controls = player.createDiv({ cls: 'wb-review-audio-controls' });
    const playBtn = controls.createEl('button', { cls: 'wb-review-audio-play-btn', text: '▶ 播放' });

    // US-002: 正确处理播放 Promise，按钮状态与真实播放同步
    playBtn.addEventListener('click', async () => {
      if (this.audioElement) {
        if (this.audioElement.paused) {
          try {
            // 等待 play Promise 完成
            await this.audioElement.play();
            // Promise 成功后才切换按钮状态
            playBtn.textContent = '⏸ 暂停';
            playBtn.addClass('playing');
          } catch (err) {
            // Promise 失败，保持按钮在播放状态
            console.warn('音频播放失败:', err);
            playBtn.textContent = '▶ 播放';
            playBtn.removeClass('playing');
          }
        } else {
          // 暂停操作是同步的，不需要等待 Promise
          this.audioElement.pause();
          playBtn.textContent = '▶ 播放';
          playBtn.removeClass('playing');
        }
      }
    });
  }

  // US-001: 使用 Obsidian API 解析 vault 内音频文件的真实可播放路径
  private async resolveAudioSource(): Promise<void> {
    if (!this.audioElement) return;

    try {
      // 音频文件在 vault 内的相对路径
      const audioPath = 'plugins-assets/test-audio.m4a';

      // 方式1: 尝试直接使用 vault 资源路径 API
      // Obsidian 0.15+ 版本支持 getResourcePath
      try {
        const file = this.app.vault.getAbstractFileByPath(audioPath);
        if (file) {
          // 使用 vault.getResourcePath 获取可播放的资源 URL
          const resourceUrl = this.app.vault.getResourcePath(file as any);
          if (resourceUrl) {
            this.audioElement.src = resourceUrl;
            this.audioElement.load();
            console.log('音频源通过 vault.getResourcePath 设置:', resourceUrl);
            return;
          }
        }
      } catch (e) {
        console.warn('getResourcePath 方式失败:', e);
      }

      // 方式2: 使用 DataAdapter 的 basePath (私有属性，但实际存在)
      // @ts-ignore 因为 basePath 在 Obsidian 内部实现中确实存在
      const adapter = this.app.vault.adapter as any;
      if (adapter.basePath) {
        const fullPath = `${adapter.basePath}/${audioPath}`;
        // 使用 app:// 协议
        this.audioElement.src = `file:///${fullPath.replace(/\\/g, '/')}`;
        this.audioElement.load();
        console.log('音频源通过 basePath 设置');
        return;
      }

      // 方式3: 尝试读取文件并创建 Blob URL
      try {
        const file = this.app.vault.getAbstractFileByPath(audioPath);
        if (file) {
          const fileContent = await this.app.vault.readBinary(file as any);
          const blob = new Blob([fileContent], { type: 'audio/mp4' });
          const blobUrl = URL.createObjectURL(blob);
          this.audioElement.src = blobUrl;
          this.audioElement.load();
          console.log('音频源通过 Blob URL 设置成功');
        }
      } catch (blobErr) {
        console.warn('Blob 方式也失败:', blobErr);
      }

    } catch (err) {
      console.error('解析音频源路径失败:', err);
    }
  }

  // US-004: 时间格式化辅助函数
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // US-004: 时间戳解析辅助函数
  private parseTimestamp(timestamp: string): number {
    const parts = timestamp.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  }

  // US-004: 联动真实音频到指定时间戳并播放
  private async seekAudioToTimestamp(timestamp: string): Promise<void> {
    const seconds = this.parseTimestamp(timestamp);

    if (this.audioElement) {
      // US-004: 检查音频是否已正确加载
      if (!this.audioElement.duration || this.audioElement.duration <= 0) {
        console.warn('音频尚未加载完成，无法 seek');
        // 尝试等待加载完成后再 seek
        this.audioElement.addEventListener('loadedmetadata', () => {
          this.performSeekAndPlay(seconds, timestamp);
        }, { once: true });
        return;
      }

      // 执行 seek 和 play
      await this.performSeekAndPlay(seconds, timestamp);
    }
  }

  // US-004: 执行 seek 和 play 操作，处理 Promise
  private async performSeekAndPlay(seconds: number, timestamp: string): Promise<void> {
    if (!this.audioElement) return;

    try {
      // 设置真实音频的当前时间
      this.audioElement.currentTime = seconds;

      // 自动开始播放，等待 Promise
      await this.audioElement.play();

      // 同步进度条和时间显示（真实播放成功后才更新）
      if (this.audioProgressFill && this.audioCurrentTimeEl && this.audioProgressHandle) {
        const duration = this.audioElement.duration;
        if (duration > 0) {
          const percent = Math.min(100, (seconds / duration) * 100);

          this.audioProgressFill.style.width = `${percent}%`;
          this.audioProgressHandle.style.left = `${percent}%`;
        }
        // timeupdate 会自动更新时间显示，这里只做初始设置
        this.audioCurrentTimeEl.textContent = timestamp;
      }

      // US-002: 同步更新播放按钮状态
      const playBtn = document.querySelector('.wb-review-audio-play-btn');
      if (playBtn) {
        playBtn.textContent = '⏸ 暂停';
        playBtn.addClass('playing');
      }
    } catch (err) {
      console.warn('时间戳 seek/play 失败:', err);
      // seek 失败时，确保按钮状态正确
      const playBtn = document.querySelector('.wb-review-audio-play-btn');
      if (playBtn) {
        playBtn.textContent = '▶ 播放';
        playBtn.removeClass('playing');
      }
    }
  }

  private renderReadingLoop(parent: HTMLElement): void {
    const loop = parent.createDiv({ cls: 'wb-review-reading-loop' });

    const header = loop.createDiv({ cls: 'wb-review-loop-header' });
    header.createDiv({ cls: 'wb-review-loop-title', text: '转写正文' });
    // US-009: 删除"已读 0%"无效信息，改为显示编辑状态提示
    const editHint = header.createDiv({ cls: 'wb-review-loop-edit-hint', text: '正文可编辑' });
    editHint.style.color = 'var(--neon-green)';
    editHint.style.fontFamily = 'var(--font-tech)';
    editHint.style.fontSize = 'var(--size-tag)';

    const body = loop.createDiv({ cls: 'wb-review-loop-body' });
    body.id = 'wb-review-transcript-body';

    // US-001: 更真实的转写内容，减少省略号
    // US-002: 添加时间戳映射
    // US-003: 时间戳和说话人只读，正文可编辑
    // US-004: 时间戳点击联动音频进度
    const transcriptSegments: Array<{ time: string; speaker: string; text: string; evidenceKey?: string; modified?: boolean }> = [
      { time: '00:00', speaker: '王主任', text: '你好，我是王主任，负责我们公司的技术部门。', evidenceKey: 'intro' },
      { time: '00:15', speaker: '销售', text: '王主任您好，请问您这边目前在做什么项目？' },
      { time: '00:30', speaker: '王主任', text: '我们公司目前在做数字化转型，这是今年的核心项目。', evidenceKey: 'importance' },
      { time: '01:00', speaker: '销售', text: '数字化转型过程中遇到什么问题了吗？' },
      { time: '01:20', speaker: '王主任', text: '效率瓶颈是目前最大的痛点，各个部门协作效率太低了。', evidenceKey: 'pain' },
      { time: '02:00', speaker: '销售', text: '您对解决这个问题有什么期望？' },
      { time: '02:30', speaker: '王主任', text: '希望能有数字化解决方案，能把各部门的数据打通。', evidenceKey: 'solution' },
      { time: '03:00', speaker: '销售', text: '这个项目的决策流程是怎样的？' },
      { time: '03:30', speaker: '王主任', text: '我作为技术总监，这事我来拍板，老板也支持。', evidenceKey: 'decision' },
      { time: '04:00', speaker: '销售', text: '预算方面大概有多少？' },
      { time: '04:20', speaker: '王主任', text: '预算大概50万左右，如果效果好可以追加。', evidenceKey: 'budget' },
      { time: '05:00', speaker: '销售', text: '时间上有什么要求吗？' },
      { time: '05:20', speaker: '王主任', text: '最好在下个月前能上线，时间比较紧。', evidenceKey: 'urgency' },
      { time: '06:00', speaker: '销售', text: '有没有什么顾虑？' },
      { time: '06:15', speaker: '王主任', text: '主要是担心实施周期和效果，这个需要你们给个明确的方案。', evidenceKey: 'concern' },
      { time: '06:45', speaker: '销售', text: '好的，我这边会准备一份详细方案给您。' },
      { time: '07:00', speaker: '王主任', text: '好的，期待你的方案，我们下周再沟通。' }
    ];

    // US-003: 渲染只读时间戳和说话人，可编辑正文
    for (const segment of transcriptSegments) {
      const segmentDiv = body.createDiv({ cls: 'wb-review-transcript-row' });
      segmentDiv.dataset.time = segment.time;

      // US-003: 时间戳只读显示 + US-004: 点击联动音频
      const timeSpan = segmentDiv.createSpan({ cls: 'wb-review-transcript-time-readonly', text: segment.time });
      timeSpan.addEventListener('click', () => {
        // 清除所有高亮
        body.querySelectorAll('.wb-review-transcript-row').forEach(row => row.removeClass('active-timestamp'));
        // 高亮当前行
        segmentDiv.addClass('active-timestamp');
        // 联动音频进度
        this.seekAudioToTimestamp(segment.time);
        // 更新顶部编辑提示
        const hintEl = loop.querySelector('.wb-review-loop-edit-hint');
        if (hintEl) {
          hintEl.textContent = `定位: ${segment.time}`;
          (hintEl as HTMLElement).style.color = 'var(--neon-purple)';
        }
      });

      // US-003: 说话人只读显示（轻量灰色）
      const speakerSpan = segmentDiv.createSpan({ cls: 'wb-review-transcript-speaker-readonly', text: segment.speaker });

      // REVIEW-FIX-013: 正文可编辑 textarea - 使用 auto-resize
      const textInput = segmentDiv.createEl('textarea', { cls: 'wb-review-transcript-text-editable' });
      textInput.value = segment.text;
      // REVIEW-FIX-013: 移除 rows=1，改用 CSS field-sizing 和 JS auto-resize

      // REVIEW-FIX-013: JS auto-resize 降级方案（浏览器不支持 field-sizing 时使用）
      const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      };

      // 初始调整高度
      setTimeout(() => autoResizeTextarea(textInput), 0);

      // 输入时自动调整高度
      textInput.addEventListener('input', () => {
        autoResizeTextarea(textInput);
        segment.modified = true;
        segmentDiv.addClass('modified');
        // 更新顶部提示
        editHint.textContent = '有修改';
        editHint.style.color = 'var(--neon-yellow)';
      });

      if (segment.evidenceKey) {
        segmentDiv.dataset.evidence = segment.evidenceKey;
      }
    }

    // US-008: 维度快捷方式与证据映射 - 完整映射
    const summary = parent.createDiv({ cls: 'wb-review-summary-row' });

    // 维度快捷方式映射（英文 key -> 中文显示名）
    const dimensionToEvidence: Array<{ key: string; label: string; hasEvidence: boolean }> = [
      { key: 'pain', label: '痛点', hasEvidence: true },
      { key: 'pain_attitude', label: '对痛态度', hasEvidence: false },
      { key: 'solution', label: '方案期望', hasEvidence: true },
      { key: 'decision', label: '决策权', hasEvidence: true },
      { key: 'budget', label: '预算', hasEvidence: true },
      { key: 'urgency', label: '紧迫度', hasEvidence: true },
      { key: 'concern', label: '顾虑', hasEvidence: true }
    ];

    for (const item of dimensionToEvidence) {
      const summaryItem = summary.createDiv({ cls: 'wb-review-summary-item' });
      summaryItem.dataset.evidenceKey = item.key;
      summaryItem.textContent = item.label;

      // US-008: 无证据维度显示特殊样式
      if (!item.hasEvidence) {
        summaryItem.addClass('no-evidence');
        summaryItem.createDiv({ cls: 'wb-review-summary-item-tag', text: '未涉及' });
      }

      summaryItem.addEventListener('click', () => {
        // 清除其他快捷方式的 active 状态
        summary.querySelectorAll('.wb-review-summary-item').forEach(s => s.removeClass('active'));
        summaryItem.addClass('active');
        this.highlightDimensionEvidence(item.key);
      });
    }
  }

  // US-008: 高亮指定维度的证据或显示"没问"
  private highlightDimensionEvidence(dimensionKey: string): void {
    const body = document.getElementById('wb-review-transcript-body');
    if (!body) {
      console.warn('转写正文容器不存在');
      return;
    }

    // 清除所有高亮（适配新的 CSS 类名）
    body.querySelectorAll('.wb-review-transcript-row, .wb-review-transcript-segment, .wb-review-transcript-editable').forEach(seg => {
      seg.removeClass('active-highlight');
    });

    // 清除快捷方式的 active 状态
    document.querySelectorAll('.wb-review-summary-item').forEach(item => {
      item.removeClass('active');
    });

    // 清除之前的"没问"提示
    body.querySelectorAll('.wb-review-no-evidence-msg').forEach(msg => msg.remove());

    // 维度名称映射（英文 key -> 中文名称）
    const dimensionNames: Record<string, string> = {
      'pain': '痛点',
      'pain_attitude': '对痛态度',
      'solution': '期望解决方式',
      'decision': '决策链',
      'budget': '预算',
      'urgency': '时间紧迫度',
      'concern': '其他顾虑',
      'intro': '开场介绍',
      'importance': '重要性'
    };

    // 设置当前快捷方式为 active（如果有）
    document.querySelectorAll(`.wb-review-summary-item[data-evidence-key="${dimensionKey}"]`).forEach(item => {
      item.addClass('active');
    });

    // 查找对应证据
    const evidenceSegment = body.querySelector(`[data-evidence="${dimensionKey}"]`);

    if (evidenceSegment) {
      evidenceSegment.addClass('active-highlight');
      evidenceSegment.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // US-008: 如果没有对应证据，显示明确的"没问"提示
      const dimensionName = dimensionNames[dimensionKey] || dimensionKey;
      const noEvidenceMsg = body.createDiv({
        cls: 'wb-review-no-evidence-msg'
      });

      // 创建结构化的提示内容
      const header = noEvidenceMsg.createDiv({ cls: 'wb-review-no-evidence-header' });
      header.createDiv({ cls: 'wb-review-no-evidence-icon', text: '⚠' });
      header.createDiv({ cls: 'wb-review-no-evidence-title', text: `【${dimensionName}】` });

      const bodyText = noEvidenceMsg.createDiv({ cls: 'wb-review-no-evidence-body' });
      bodyText.createDiv({ text: '该维度尚未在通话中获得可用信息' });
      bodyText.createDiv({ cls: 'wb-review-no-evidence-status', text: '当前状态：没问 / 未涉及' });

      // 5秒后自动移除提示
      setTimeout(() => {
        noEvidenceMsg.addClass('fade-out');
        setTimeout(() => noEvidenceMsg.remove(), 500);
      }, 4500);
    }
  }

  // US-007: 触发 AI 重算流程
  private triggerRecalculation(dimensionKey: string): void {
    this.recalcStatus = 'calculating';

    // 更新重算状态显示
    const statusEl = document.querySelector('.wb-review-recalc-status');
    if (statusEl) {
      statusEl.textContent = '计算中...';
      statusEl.addClass('calculating');
    }

    // 模拟 AI 重算延迟
    setTimeout(() => {
      this.recalcStatus = 'ready';
      if (statusEl) {
        statusEl.textContent = '重算完成';
        statusEl.removeClass('calculating');
        statusEl.addClass('ready');
      }
    }, 1500);
  }

  // US-007: 更新状态指示器颜色
  private updateStatusIndicator(indicator: HTMLElement, status: string): void {
    indicator.removeClass('status-not-asked', 'status-unclear', 'status-clear');
    switch (status) {
      case '没问':
        indicator.addClass('status-not-asked');
        break;
      case '没问清':
        indicator.addClass('status-unclear');
        break;
      case '已问清':
        indicator.addClass('status-clear');
        break;
    }
  }

  // US-007: 显示修改反馈
  private showModificationFeedback(row: HTMLElement, label: string, newStatus: string): void {
    // 创建临时反馈气泡
    const feedback = row.createDiv({ cls: 'wb-review-modification-feedback' });
    feedback.textContent = `已更新：${label} → ${newStatus}`;

    // 2秒后自动消失
    setTimeout(() => {
      feedback.remove();
      row.removeClass('modified');
    }, 2000);
  }

  private renderStageSwitcher(parent: HTMLElement): void {
    const switcher = parent.createDiv({ cls: 'wb-review-stage-switcher' });
    this.stageSwitcher = switcher;

    for (const [stageName, config] of Object.entries(STAGE_CONFIGS)) {
      const stageConfig = config as { name: ReviewStage; displayName: string; colorVar: string };
      const btn = switcher.createEl('button', {
        cls: 'wb-review-stage-btn',
        attr: { 'data-stage': stageName }
      });
      btn.createSpan({ text: stageConfig.displayName });

      btn.addEventListener('click', () => {
        this.switchStage(stageName as ReviewStage);
      });
    }
  }

  private switchStage(stage: ReviewStage): void {
    this.currentStage = stage;

    if (this.stageSwitcher) {
      this.stageSwitcher.querySelectorAll('.wb-review-stage-btn').forEach((btnEl: Element) => {
        const btnStage = btnEl.getAttribute('data-stage');
        (btnEl as HTMLElement).toggleClass('active', btnStage === stage);
      });
    }

    // STORY-01: 使用阶段级独立模板，不再走公共骨架
    if (this.stageContentContainer) {
      this.stageContentContainer.empty();
      switch (stage) {
        case 'identify':
          this.renderIdentifyStageFull(this.stageContentContainer);
          break;
        case 'ai-processing':
          this.renderAIProcessingStageFull(this.stageContentContainer);
          break;
        case 'confirm':
          this.renderConfirmStageFull(this.stageContentContainer);
          break;
        case 'sync':
          this.renderSyncStageFull(this.stageContentContainer);
          break;
      }
    }
  }

  // US-007: 将新录音添加到左侧待处理队列
  private addNewRecordingsToQueue(newRecordings: Array<{ id: string; filename: string }>): void {
    const queueList = document.getElementById('wb-review-queue-list');
    if (!queueList) {
      console.warn('队列列表不存在，无法添加新录音');
      return;
    }

    // 为每个新录音创建队列项
    for (const recording of newRecordings) {
      const queueItem = queueList.createDiv({ cls: 'queue-item new-item' });
      queueItem.dataset.itemId = recording.id;
      queueItem.dataset.stage = 'identify';

      // 只显示文件名（遵循 US-002 的简化原则）
      queueItem.createDiv({ cls: 'queue-item-title', text: recording.filename });

      // 添加新项目标识
      const newTag = queueItem.createDiv({ cls: 'queue-item-new-tag', text: '新' });

      // 点击选中（遵循 US-005 的原则，不自动跳转阶段）
      queueItem.addEventListener('click', () => {
        queueList.querySelectorAll('.queue-item').forEach(i => i.removeClass('active'));
        queueItem.addClass('active');
      });
    }

    // 添加动画效果，让用户感知到新项目加入
    queueList.querySelectorAll('.queue-item.new-item').forEach((item: Element) => {
      (item as HTMLElement).style.animation = 'newItemSlideIn 0.5s ease';
      setTimeout(() => {
        (item as HTMLElement).removeClass('new-item');
      }, 3000);
    });
  }

  async onClose() {
    this.contentEl.empty();
  }
}