// Lead Workbench View - 线索筛选工作台（三栏职责重构版）

import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { LEAD_VIEW_TYPE, VIEW_CONFIGS } from '../../types/index';
import { LeadCardData, LeadGroupData, LeadStats, LeadIntentCategory } from '../../types/lead';
import { LeadRepo } from '../../repos/LeadRepo';
import { RealLeadData, TranscriptItem } from '../../repos/types';
import { createCyberHeader, createCheckbox, createTag, formatDuration, formatDate } from '../../utils/dom-helpers';

// Category colors
const categoryColors: Record<LeadIntentCategory, string> = {
  'high-intent': 'neon-green',
  'low-intent': 'neon-red',
  'pending': 'neon-cyan'
};

export class LeadWorkbenchView extends ItemView {
  private selectedLeads: Set<string> = new Set();
  private selectedLeadId: string | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private audioCurrentTimeEl: HTMLElement | null = null;
  private audioProgressFill: HTMLElement | null = null;
  private audioProgressHandle: HTMLElement | null = null;
  private audioTotalDurationEl: HTMLElement | null = null;
  // 真实数据存储（只读接线）
  private realLeads: LeadCardData[] = [];
  private realLeadDetails: Map<string, RealLeadData> = new Map();
  private isLoading: boolean = true;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return LEAD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return VIEW_CONFIGS[LEAD_VIEW_TYPE].title;
  }

  getIcon(): string {
    return VIEW_CONFIGS[LEAD_VIEW_TYPE].icon;
  }

  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass('cyber-workbench-root');
    this.contentEl.style.padding = '0';
    this.contentEl.style.overflow = 'hidden';

    const container = this.contentEl.createDiv({ cls: 'wb-lead-container-v2' });

    // 1. Header
    this.renderHeader(container);

    // 2. 三栏布局（异步加载真实数据后渲染）
    this.isLoading = true;
    this.renderThreeColumnLayout(container);

    // 异步加载真实线索数据
    await this.loadRealLeads();

    // 数据加载完成后重新渲染线索列表
    this.refreshLeadList();
  }

  /**
   * 加载真实线索数据（只读接线）
   */
  private async loadRealLeads(): Promise<void> {
    try {
      this.realLeads = await LeadRepo.getAllLeads(this.app);
      this.isLoading = false;

      // 预加载选中线索的详情（用于右侧证据区）
      for (const lead of this.realLeads.slice(0, 5)) {
        const detail = await LeadRepo.getLeadDetail(this.app, lead.id);
        if (detail) {
          this.realLeadDetails.set(lead.id, detail);
        }
      }

      console.log('[LeadWorkbench] 已加载真实线索:', this.realLeads.length);
    } catch (err) {
      console.error('[LeadWorkbench] 加载失败:', err);
      this.isLoading = false;
    }
  }

  /**
   * 刷新线索列表（数据加载后调用）
   */
  private refreshLeadList(): void {
    const listContainer = this.contentEl.querySelector('.wb-lead-list-compact');
    if (listContainer) {
      listContainer.empty();
      this.renderCompactLeadItems(listContainer as HTMLElement);
    }
  }

  private renderHeader(parent: HTMLElement): void {
    const header = createCyberHeader(parent, '线索筛选工作台', '三栏职责：左选客户 / 中操作 / 右辅助', [
      { icon: '●', text: '系统在线', animate: true },
      { icon: '⚡', text: '延迟: 23ms' },
      { icon: '🕐', text: this.getCurrentTime() }
    ]);

    // Update clock every second
    setInterval(() => {
      const timeEl = header.querySelector('.cyber-status-item:last-child span:last-child');
      if (timeEl) {
        timeEl.textContent = this.getCurrentTime();
      }
    }, 1000);
  }

  private getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // US-006: 三栏布局重构
  private renderThreeColumnLayout(parent: HTMLElement): void {
    const main = parent.createDiv({ cls: 'wb-lead-three-column' });

    // 左栏：紧凑客户选择列表
    this.renderCompactLeadList(main);

    // 中栏：核心操作台
    this.renderOperationPanel(main);

    // 右栏：辅助证据区（转写 + 音频）
    this.renderEvidencePanel(main);
  }

  // US-006: 左栏 - 紧凑客户选择列表（一行表达）
  private renderCompactLeadList(parent: HTMLElement): void {
    const leftPanel = parent.createDiv({ cls: 'wb-lead-left-panel' });
    leftPanel.createDiv({ cls: 'wb-lead-left-header', text: '线索列表' });

    // 搜索栏
    const searchBar = leftPanel.createDiv({ cls: 'wb-lead-search-compact' });
    const searchInput = searchBar.createEl('input', {
      cls: 'wb-lead-search-input-compact',
      attr: { placeholder: '搜索...', type: 'text' }
    });

    // 分类标签
    const categoryTabs = leftPanel.createDiv({ cls: 'wb-lead-category-tabs' });
    categoryTabs.createDiv({ cls: 'wb-lead-category-tab active', text: '全部', attr: { 'data-category': 'all' } });
    categoryTabs.createDiv({ cls: 'wb-lead-category-tab', text: '高意向', attr: { 'data-category': 'high-intent' } });
    categoryTabs.createDiv({ cls: 'wb-lead-category-tab', text: '低意向', attr: { 'data-category': 'low-intent' } });
    categoryTabs.createDiv({ cls: 'wb-lead-category-tab', text: '待判', attr: { 'data-category': 'pending' } });

    // 紧凑线索列表
    const listContainer = leftPanel.createDiv({ cls: 'wb-lead-list-compact' });
    this.renderCompactLeadItems(listContainer);

    // 搜索功能
    searchInput.addEventListener('input', () => {
      this.filterCompactLeads(listContainer, searchInput.value);
    });

    // 分类切换
    categoryTabs.querySelectorAll('.wb-lead-category-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        categoryTabs.querySelectorAll('.wb-lead-category-tab').forEach(t => t.removeClass('active'));
        tab.addClass('active');
        this.filterByCategory(listContainer, (tab as HTMLElement).dataset.category || 'all');
      });
    });
  }

  // US-006: 紧凑线索条目（一行表达）
  private renderCompactLeadItems(parent: HTMLElement): void {
    // 显示加载状态
    if (this.isLoading) {
      parent.createDiv({ cls: 'wb-lead-loading', text: '正在加载真实线索...' });
      return;
    }

    // 使用真实数据替代 mockLeads
    if (this.realLeads.length === 0) {
      parent.createDiv({ cls: 'wb-lead-empty', text: '暂无线索数据' });
      return;
    }

    // 按 category 分组（复用原有分组逻辑）
    const groups = this.groupRealLeadsByCategory(this.realLeads);

    for (const group of groups) {
      for (const lead of group.leads) {
        const item = parent.createDiv({ cls: 'wb-lead-item-compact' });
        item.dataset.leadId = lead.id;
        item.dataset.category = group.category;

        // 左侧：勾选框
        const checkboxContainer = item.createDiv({ cls: 'wb-lead-item-checkbox' });
        createCheckbox(checkboxContainer, this.selectedLeads.has(lead.id), (checked: boolean) => {
          if (checked) {
            this.selectedLeads.add(lead.id);
            item.addClass('checked');
          } else {
            this.selectedLeads.delete(lead.id);
            item.removeClass('checked');
          }
        });

        // 中间：紧凑信息（姓名 + 公司 + 时长，一行）
        const infoRow = item.createDiv({ cls: 'wb-lead-item-info-row' });
        infoRow.createDiv({ cls: 'wb-lead-item-name', text: lead.name });
        if (lead.company) {
          infoRow.createDiv({ cls: 'wb-lead-item-company', text: `(${lead.company})` });
        }
        infoRow.createDiv({ cls: 'wb-lead-item-duration', text: formatDuration(lead.durationSeconds) });

        // 意向标签
        const intentTag = item.createDiv({ cls: 'wb-lead-item-intent-tag' });
        intentTag.addClass(group.category);
        intentTag.createSpan({ text: group.category === 'high-intent' ? '高' : group.category === 'low-intent' ? '低' : '待' });

        // 点击选中
        item.addEventListener('click', (e) => {
          if (!(e.target instanceof HTMLElement && e.target.closest('.cyber-checkbox'))) {
            this.selectLead(lead.id, item, parent);
          }
        });
      }
    }
  }

  /**
   * 按 category 分组真实线索（复用 mock-leads.ts 的分组逻辑）
   */
  private groupRealLeadsByCategory(leads: LeadCardData[]): LeadGroupData[] {
    const groups: Map<LeadIntentCategory, LeadCardData[]> = new Map();

    for (const lead of leads) {
      if (!groups.has(lead.category)) {
        groups.set(lead.category, []);
      }
      groups.get(lead.category)!.push(lead);
    }

    const categoryTitles: Record<LeadIntentCategory, string> = {
      'high-intent': '积极命中',
      'low-intent': '负向待复核',
      'pending': '长通话无关键词/其余'
    };

    const result: LeadGroupData[] = [];
    const order: LeadIntentCategory[] = ['high-intent', 'low-intent', 'pending'];

    for (const category of order) {
      if (groups.has(category)) {
        result.push({
          category,
          title: categoryTitles[category],
          leads: groups.get(category)!
        });
      }
    }

    return result;
  }

  private selectLead(leadId: string, itemEl: HTMLElement, listContainer: HTMLElement): void {
    // 清除其他选中
    listContainer.querySelectorAll('.wb-lead-item-compact').forEach(el => {
      el.removeClass('selected');
    });
    itemEl.addClass('selected');
    this.selectedLeadId = leadId;

    // 更新右侧证据区
    this.updateEvidencePanel(leadId);
  }

  private filterCompactLeads(container: HTMLElement, query: string): void {
    const lowerQuery = query.toLowerCase();
    container.querySelectorAll('.wb-lead-item-compact').forEach((item: Element) => {
      const name = item.querySelector('.wb-lead-item-name')?.textContent?.toLowerCase() || '';
      const company = item.querySelector('.wb-lead-item-company')?.textContent?.toLowerCase() || '';
      const matches = query === '' || name.includes(lowerQuery) || company.includes(lowerQuery);
      (item as HTMLElement).style.display = matches ? '' : 'none';
    });
  }

  private filterByCategory(container: HTMLElement, category: string): void {
    container.querySelectorAll('.wb-lead-item-compact').forEach((item: Element) => {
      const itemCategory = (item as HTMLElement).dataset.category || '';
      const matches = category === 'all' || itemCategory === category;
      (item as HTMLElement).style.display = matches ? '' : 'none';
    });
  }

  // US-006: 中栏 - 核心操作台（合并决策区）
  private renderOperationPanel(parent: HTMLElement): void {
    const centerPanel = parent.createDiv({ cls: 'wb-lead-center-panel' });
    centerPanel.createDiv({ cls: 'wb-lead-center-title', text: '核心操作台' });

    // US-004: 销售归属区（保留）
    const salesCard = centerPanel.createDiv({ cls: 'cyber-card wb-lead-sales-card' });
    salesCard.createDiv({ cls: 'cyber-card-header', text: '销售归属' });
    const salesBody = salesCard.createDiv({ cls: 'cyber-card-body' });

    // 当前销售显示
    const currentRow = salesBody.createDiv({ cls: 'wb-lead-sales-current-row' });
    currentRow.createDiv({ cls: 'wb-lead-sales-current-label', text: '分配给' });
    const salesSelect = currentRow.createEl('select', { cls: 'wb-lead-sales-select' });
    const realSalesOptions = ['李云杰', '杜燕', '韦宽国'];
    for (const opt of realSalesOptions) {
      const optionEl = salesSelect.createEl('option', { value: opt, text: opt });
      if (opt === '李云杰') optionEl.selected = true;
    }

    // US-004: 底部执行区 - 直接执行按钮（删除上层重复决策）
    const confirmCard = centerPanel.createDiv({ cls: 'cyber-card priority-high wb-lead-action-card' });
    confirmCard.createDiv({ cls: 'cyber-card-header', text: '执行操作' });
    const confirmBody = confirmCard.createDiv({ cls: 'cyber-card-body' });

    // 确认按钮（直接执行，不再有上层重复选择）
    const buttons = confirmBody.createDiv({ cls: 'wb-lead-confirm-buttons' });
    buttons.createEl('button', { cls: 'cyber-btn cyber-btn-primary', text: '执行入库' });
    buttons.createEl('button', { cls: 'cyber-btn cyber-btn-danger', text: '删除线索' });
  }

  
  // US-007: 右栏 - 辅助证据区（复用 ReviewWorkbenchView 的音频联动逻辑）
  private renderEvidencePanel(parent: HTMLElement): void {
    const rightPanel = parent.createDiv({ cls: 'wb-lead-right-panel' });
    rightPanel.createDiv({ cls: 'wb-lead-right-title', text: '辅助证据' });

    // 录音概览卡片
    const overviewCard = rightPanel.createDiv({ cls: 'cyber-card' });
    overviewCard.createDiv({ cls: 'cyber-card-header', text: '录音概览' });
    const overviewBody = overviewCard.createDiv({ cls: 'cyber-card-body' });
    overviewBody.createDiv({ cls: 'wb-lead-recording-placeholder', text: '选中线索后显示录音信息' });

    // 音频播放器（复用 ReviewWorkbenchView 的逻辑）
    this.renderAudioPlayer(rightPanel);

    // 转写正文区（添加 id 以便动态更新）
    const transcriptCard = rightPanel.createDiv({ cls: 'cyber-card wb-lead-transcript-card' });
    transcriptCard.createDiv({ cls: 'cyber-card-header', text: '转写正文' });
    const transcriptBody = transcriptCard.createDiv({ cls: 'cyber-card-body wb-lead-transcript-body', attr: { id: 'wb-lead-transcript-body' } });

    // 默认提示（选中线索后会被替换）
    transcriptBody.createDiv({ cls: 'wb-lead-transcript-placeholder', text: '选中线索后显示转写内容' });
  }

  private updateEvidencePanel(leadId: string): void {
    // 从真实详情数据获取
    const detail = this.realLeadDetails.get(leadId);

    // 尝试获取详情（如果未预加载）
    if (!detail) {
      LeadRepo.getLeadDetail(this.app, leadId).then(d => {
        if (d) {
          this.realLeadDetails.set(leadId, d);
          this.updateEvidencePanel(leadId); // 递归更新
        }
      });
      return;
    }

    // 更新录音概览
    const overviewPlaceholder = this.contentEl.querySelector('.wb-lead-recording-placeholder');
    if (overviewPlaceholder) {
      const infoText = `${detail.leadName} - ${formatDuration(detail.durationSeconds)} | ${detail.callDate || '未知日期'} | 评分: ${detail.score || '待定'}`;
      overviewPlaceholder.textContent = infoText;
    }

    // 更新音频源（优先真实路径）
    this.updateAudioSource(detail.audioFilePath);

    // 更新转写正文区（使用真实转写内容）
    const transcriptBody = this.contentEl.querySelector('#wb-lead-transcript-body');
    if (transcriptBody) {
      transcriptBody.empty();
      if (detail?.transcript) {
        // 真实转写内容渲染
        this.renderRealTranscript(transcriptBody as HTMLElement, detail.transcript);
      } else {
        // 尝试异步获取转写
        LeadRepo.getTranscript(this.app, leadId).then(items => {
          if (items.length > 0 && transcriptBody) {
            transcriptBody.empty();
            this.renderTranscriptItems(transcriptBody as HTMLElement, items);
          } else {
            transcriptBody.createDiv({ cls: 'wb-lead-transcript-placeholder', text: '暂无转写内容' });
          }
        });
      }
    }
  }

  /**
   * 渲染真实转写内容（新布局：会话流格式）
   * 修复 LEAD-PROBLEM-04: 每条记录都有时间戳和说话人标签
   */
  private renderRealTranscript(parent: HTMLElement, transcript: string): void {
    // 解析转写内容，尝试提取时间戳和说话人
    const lines = transcript.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      // 如果没有结构化内容，显示为单条记录
      this.createTranscriptRow(parent, '00:00', '通话', transcript, 'unknown');
      return;
    }

    // 尝试解析每条转写记录
    let currentTime = '00:00';
    for (const line of lines) {
      // 尝试匹配时间戳格式 [MM:SS] 或 (MM:SS)
      const timeMatch = line.match(/[\[\(]?(\d{1,2}:\d{2})[\]\)]?/);
      if (timeMatch) {
        currentTime = timeMatch[1];
      }

      // 尝试检测说话人（销售/客户）
      let speaker = 'unknown';
      let text = line;
      let speakerLabel = '未知';

      if (line.includes('销售') || line.includes('S') || line.includes('A')) {
        speaker = 'sales';
        speakerLabel = '销售';
        text = line.replace(/.*[销售SA]:?\s*/, '');
      } else if (line.includes('客户') || line.includes('C') || line.includes('B')) {
        speaker = 'customer';
        speakerLabel = '客户';
        text = line.replace(/.*[客户CB]:?\s*/, '');
      } else {
        // 根据内容猜测：问句通常是客户，介绍通常是销售
        if (line.includes('?') || line.includes('？') || line.includes('多少钱') || line.includes('怎么')) {
          speaker = 'customer';
          speakerLabel = '客户';
        } else {
          speaker = 'sales';
          speakerLabel = '销售';
        }
      }

      // 清理文本中的时间戳标记
      text = text.replace(/[\[\(]?\d{1,2}:\d{2}[\]\)]?\s*/, '');

      if (text.trim()) {
        this.createTranscriptRow(parent, currentTime, speakerLabel, text, speaker);
      }
    }
  }

  /**
   * 创建单条转写记录（新布局）
   * 修复 LEAD-PROBLEM-04: 清晰的时间戳 + 说话人 + 正文结构
   */
  private createTranscriptRow(
    parent: HTMLElement,
    time: string,
    speakerLabel: string,
    text: string,
    speakerType: string
  ): void {
    const row = parent.createDiv({ cls: 'wb-lead-transcript-row' });
    row.dataset.time = time;

    // 头部：时间戳 + 说话人标签
    const header = row.createDiv({ cls: 'wb-lead-transcript-header' });
    header.createDiv({ cls: 'wb-lead-transcript-time', text: time });
    const speakerEl = header.createDiv({ cls: `wb-lead-transcript-speaker ${speakerType}` });
    speakerEl.textContent = speakerLabel;

    // 正文内容（独立一行，不受时间戳挤占）
    const textEl = row.createDiv({ cls: 'wb-lead-transcript-text', text: text });

    // 时间戳点击跳转音频
    const timeBtn = header.querySelector('.wb-lead-transcript-time');
    if (timeBtn) {
      timeBtn.addEventListener('click', () => {
        this.seekAudioToTimestamp(time);
      });
    }

    // 整行点击也跳转
    row.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).classList.contains('wb-lead-transcript-time')) {
        this.seekAudioToTimestamp(time);
      }
    });
  }

  /**
   * 渲染结构化转写条目（带时间戳格式）
   */
  private renderTranscriptItems(parent: HTMLElement, items: TranscriptItem[]): void {
    for (const item of items) {
      const row = parent.createDiv({ cls: 'wb-lead-transcript-row' });
      row.dataset.time = item.time;

      row.createDiv({ cls: 'wb-lead-transcript-time', text: item.time });
      row.createDiv({ cls: 'wb-lead-transcript-speaker', text: item.speaker });
      row.createDiv({ cls: 'wb-lead-transcript-text', text: item.text });

      row.addEventListener('click', () => {
        this.seekAudioToTimestamp(item.time);
      });
    }
  }

  // US-007: 复用 ReviewWorkbenchView 的音频播放器逻辑
  private renderAudioPlayer(parent: HTMLElement): void {
    const player = parent.createDiv({ cls: 'wb-lead-audio-player' });

    this.audioElement = player.createEl('audio', {
      attr: { preload: 'metadata' }
    });
    this.audioElement.style.display = 'none';

    // 音频信息显示
    const info = player.createDiv({ cls: 'wb-lead-audio-info' });
    this.audioCurrentTimeEl = info.createDiv({ cls: 'wb-lead-audio-current', text: '00:00' });
    this.audioTotalDurationEl = info.createDiv({ text: '加载中...' });

    // 进度条
    const progressContainer = player.createDiv({ cls: 'wb-lead-audio-progress' });
    this.audioProgressFill = progressContainer.createDiv({ cls: 'wb-lead-audio-progress-fill' });
    this.audioProgressFill.style.width = '0%';
    this.audioProgressHandle = progressContainer.createDiv({ cls: 'wb-lead-audio-progress-handle' });
    this.audioProgressHandle.style.left = '0%';

    // 音频事件监听
    if (this.audioElement) {
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

      this.audioElement.addEventListener('ended', () => {
        const playBtn = player.querySelector('.wb-lead-audio-play-btn');
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

    // 控制按钮
    const controls = player.createDiv({ cls: 'wb-lead-audio-controls' });
    const playBtn = controls.createEl('button', { cls: 'wb-lead-audio-play-btn', text: '▶ 播放' });

    playBtn.addEventListener('click', async () => {
      if (this.audioElement) {
        if (this.audioElement.paused) {
          try {
            await this.audioElement.play();
            playBtn.textContent = '⏸ 暂停';
            playBtn.addClass('playing');
          } catch (err) {
            playBtn.textContent = '▶ 播放';
            playBtn.removeClass('playing');
          }
        } else {
          this.audioElement.pause();
          playBtn.textContent = '▶ 播放';
          playBtn.removeClass('playing');
        }
      }
    });

    // 尝试加载音频
    this.resolveAudioSource();
  }

  private async resolveAudioSource(): Promise<void> {
    // 初始渲染时使用固定 demo（选中线索后会调用 updateAudioSource）
    await this.loadAudioFromPath('plugins-assets/test-audio.m4a', 'demo音频');
  }

  /**
   * 更新音频源（选中线索后调用）
   * AUD-001: 优先真实路径，fallback 到 demo
   * AUD-PATCH-002: 明确区分真实录音成功和 fallback
   */
  private async updateAudioSource(audioFilePath?: string): Promise<void> {
    if (!this.audioElement) return;

    // AUD-001: 先判断是否有真实 audioFilePath
    if (audioFilePath) {
      console.log('[LeadWorkbench] 尝试加载真实录音:', audioFilePath);
      const success = await this.loadAudioFromPath(audioFilePath, '真实录音');

      if (success) {
        // AUD-PATCH-002: 区分 vault 内文件成功和 file:// 待验证
        // 检查是否是 vault 内文件（方式1 或方式3 成功）
        const vaultFile = this.app.vault.getAbstractFileByPath(audioFilePath);
        if (vaultFile) {
          console.log('[LeadWorkbench] ✅ 真实录音加载成功（vault 内文件已确认存在）');
        } else {
          // file:// 方式：路径已设置但未确认文件存在
          console.log('[LeadWorkbench] ⚠️ 真实录音路径已设置（file:// 待运行时验证，文件存在性未确认）');
          // 仍然 return，因为已尝试设置真实路径，但如果运行时失败用户会看到播放失败
        }
        return;
      }

      // AUD-PATCH-002: 真实路径失败时明确说明原因
      console.warn('[LeadWorkbench] ❌ 真实录音加载失败（vault 内不存在或路径无法解析），进入显式 fallback');
    } else {
      console.log('[LeadWorkbench] 当前线索无 audioFilePath，使用 demo');
    }

    // AUD-PATCH-002: fallback 到 demo，明确标记这不是真实录音
    console.log('[LeadWorkbench] >>> 进入 fallback 分支，当前播放的不是线索真实录音 <<<');
    const demoSuccess = await this.loadAudioFromPath('plugins-assets/test-audio.m4a', 'demo音频');
    if (demoSuccess) {
      console.log('[LeadWorkbench] demo fallback 加载成功');
    } else {
      console.warn('[LeadWorkbench] demo fallback 也失败，音频功能可能不可用');
    }
  }

  /**
   * 从指定路径加载音频（返回是否成功）
   * AUD-PATCH-001: 修复真假成功判断
   */
  private async loadAudioFromPath(audioPath: string, sourceLabel: string): Promise<boolean> {
    if (!this.audioElement) return false;

    try {
      // 方式1: vault.getResourcePath（vault 内相对路径文件）
      try {
        const file = this.app.vault.getAbstractFileByPath(audioPath);
        if (file) {
          const resourceUrl = this.app.vault.getResourcePath(file as any);
          if (resourceUrl) {
            this.audioElement.src = resourceUrl;
            this.audioElement.load();
            console.log(`[LeadWorkbench] ${sourceLabel} 加载方式: getResourcePath`);
            return true;  // vault 内文件存在且有资源路径，才算成功
          }
        }
      } catch (e) {
        console.warn(`[LeadWorkbench] getResourcePath 失败:`, e);
      }

      // 方式2: file:// 路径（绝对路径无法确认成功，继续走 fallback）
      // AUD-PATCH-FIX: 不能确认 file:// 路径真的存在，不返回 true
      const adapter = this.app.vault.adapter as any;
      if (adapter.basePath) {
        const isAbsolutePath = audioPath.match(/^[A-Za-z]:[\/\\]/) || audioPath.startsWith('/');
        let fullPath: string;

        if (isAbsolutePath) {
          fullPath = audioPath;
          console.log(`[LeadWorkbench] ${sourceLabel} 是绝对路径，当前无法确认文件存在:`, fullPath);
        } else {
          fullPath = `${adapter.basePath}/${audioPath}`;
          console.log(`[LeadWorkbench] ${sourceLabel} 拼接 basePath:`, fullPath);
        }

        // 设置 src 但不返回 true，因为无法确认文件真的存在
        this.audioElement.src = `file:///${fullPath.replace(/\\/g, '/')}`;
        this.audioElement.load();
        console.log(`[LeadWorkbench] ${sourceLabel} 已设置 file:// src，但无法确认成功，继续走 fallback`);
        // 不返回 true，让 caller 走显式 demo fallback
      }

      // 方式3: Blob URL（vault 内文件）
      try {
        const file = this.app.vault.getAbstractFileByPath(audioPath);
        if (file) {
          const fileContent = await this.app.vault.readBinary(file as any);
          const blob = new Blob([fileContent], { type: 'audio/mp4' });
          const blobUrl = URL.createObjectURL(blob);
          this.audioElement.src = blobUrl;
          this.audioElement.load();
          console.log(`[LeadWorkbench] ${sourceLabel} 加载方式: Blob URL`);
          return true;  // vault 内文件存在且能读取，才算成功
        }
      } catch (blobErr) {
        console.warn(`[LeadWorkbench] Blob 方式失败:`, blobErr);
      }

      // 所有方式都失败：vault 内文件不存在、绝对路径无法验证等
      console.warn(`[LeadWorkbench] ${sourceLabel} 所有加载方式均失败，audioPath 可能不存在:`, audioPath);
      return false;
    } catch (err) {
      console.error(`[LeadWorkbench] ${sourceLabel} 加载异常:`, err);
      return false;
    }
  }

  
  // US-007: 时间戳跳转音频（复用逻辑）
  private seekAudioToTimestamp(timestamp: string): void {
    const parts = timestamp.split(':');
    const seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);

    if (this.audioElement) {
      if (!this.audioElement.duration || this.audioElement.duration <= 0) {
        this.audioElement.addEventListener('loadedmetadata', () => {
          this.performSeekAndPlay(seconds);
        }, { once: true });
        return;
      }
      this.performSeekAndPlay(seconds);
    }
  }

  private async performSeekAndPlay(seconds: number): Promise<void> {
    if (!this.audioElement) return;

    try {
      this.audioElement.currentTime = seconds;
      await this.audioElement.play();

      if (this.audioProgressFill && this.audioCurrentTimeEl && this.audioProgressHandle) {
        const duration = this.audioElement.duration;
        if (duration > 0) {
          const percent = Math.min(100, (seconds / duration) * 100);
          this.audioProgressFill.style.width = `${percent}%`;
          this.audioProgressHandle.style.left = `${percent}%`;
        }
      }

      const playBtn = this.contentEl.querySelector('.wb-lead-audio-play-btn');
      if (playBtn) {
        playBtn.textContent = '⏸ 暂停';
        playBtn.addClass('playing');
      }
    } catch (err) {
      console.warn('时间戳 seek/play 失败:', err);
      const playBtn = this.contentEl.querySelector('.wb-lead-audio-play-btn');
      if (playBtn) {
        playBtn.textContent = '▶ 播放';
        playBtn.removeClass('playing');
      }
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async onClose() {
    this.contentEl.empty();
  }
}