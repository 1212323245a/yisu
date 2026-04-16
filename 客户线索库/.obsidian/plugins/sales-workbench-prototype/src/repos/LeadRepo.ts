// Lead Repository - 只读接线层
// 从 1潜在意向客户 目录读取真实线索数据

import { App, TFile, TFolder } from 'obsidian';
import { RealLeadData, TranscriptItem, CATEGORY_TO_INTENT } from './types';
import { LeadCardData, LeadIntentCategory } from '../types/lead';

const LEAD_ROOT = '1潜在意向客户';
const EXCLUDE_FILES = ['_客户筛选清单.md', '索引.md', 'README.md'];

export class LeadRepo {
  /**
   * 获取所有线索列表（转换为 View 可用的 LeadCardData）
   */
  static async getAllLeads(app: App): Promise<LeadCardData[]> {
    const leads: LeadCardData[] = [];
    const rootFolder = app.vault.getAbstractFileByPath(LEAD_ROOT);

    if (!(rootFolder instanceof TFolder)) {
      console.warn('[LeadRepo] 目录不存在:', LEAD_ROOT);
      return leads;
    }

    // 递归获取所有 .md 文件
    const allFiles = this.getAllMarkdownFiles(rootFolder);

    for (const file of allFiles) {
      // 排除非线索文件
      if (EXCLUDE_FILES.some(name => file.name.includes(name))) {
        continue;
      }

      const leadData = await this.parseLeadFile(app, file);
      if (leadData) {
        leads.push(this.toCardData(leadData));
      }
    }

    // 按创建时间倒序
    leads.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return leads;
  }

  /**
   * 获取线索详情（含转写、录音路径）
   */
  static async getLeadDetail(app: App, leadId: string): Promise<RealLeadData | null> {
    const file = app.vault.getAbstractFileByPath(leadId);
    if (!(file instanceof TFile)) {
      return null;
    }
    return await this.parseLeadFile(app, file);
  }

  /**
   * 获取线索转写内容（解析为带时间戳的 TranscriptItem）
   */
  static async getTranscript(app: App, leadId: string): Promise<TranscriptItem[]> {
    const detail = await this.getLeadDetail(app, leadId);
    if (!detail?.transcript) {
      return [];
    }

    // 当前真实转写格式：纯文本，无时间戳分段
    // 返回单个条目，时间戳为 "00:00"
    // 未来如果转写格式带时间戳，可在此扩展解析逻辑
    return [{
      time: '00:00',
      speaker: '客户',
      text: detail.transcript.trim()
    }];
  }

  /**
   * 获取线索录音路径
   */
  static getAudioPath(app: App, leadId: string): string | null {
    // 从 leadId 解析录音路径需要先读取文件详情
    // 此方法供 View 异步获取后使用
    return null; // 实际在 getLeadDetail 中获取
  }

  // === Private helpers ===

  private static getAllMarkdownFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        files.push(child);
      } else if (child instanceof TFolder) {
        files.push(...this.getAllMarkdownFiles(child));
      }
    }

    return files;
  }

  private static async parseLeadFile(app: App, file: TFile): Promise<RealLeadData | null> {
    try {
      const cache = app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter || {};
      const content = await app.vault.read(file);

      // 提取正文字段
      const bodyData = this.parseBodyContent(content);

      return {
        id: file.path,
        filePath: file.path,
        leadName: this.readString(frontmatter.lead_name) || this.readString(frontmatter.name) || '',
        company: this.readString(frontmatter.company) || this.readString(frontmatter.enterprise) || '',
        phone: this.readString(frontmatter.phone) || '',
        category: this.readString(frontmatter.category) || '1潜在意向客户',
        source: this.readString(frontmatter.source) || 'CallSystem + Aliyun ASR',
        recordId: bodyData.recordId,
        durationSeconds: bodyData.durationSeconds,
        score: bodyData.score,
        classReason: bodyData.classReason,
        audioFilePath: bodyData.audioFilePath,
        transcript: bodyData.transcript,
        callDate: bodyData.callDate,
        createdTime: file.stat.ctime
      };
    } catch (err) {
      console.warn('[LeadRepo] 解析文件失败:', file.path, err);
      return null;
    }
  }

  private static parseBodyContent(content: string): {
    recordId?: string;
    durationSeconds: number;
    score?: 'A' | 'B' | 'C';
    classReason?: string;
    audioFilePath?: string;
    transcript?: string;
    callDate?: string;
  } {
    const result: ReturnType<typeof this.parseBodyContent> = {
      durationSeconds: 0
    };

    // 提取 record_id
    const recordIdMatch = content.match(/record_id:\s*(\d+)/);
    if (recordIdMatch) {
      result.recordId = recordIdMatch[1];
    }

    // 提取通话时长
    const durationMatch = content.match(/通话时长[：:]\s*(\d+)\s*秒/);
    if (durationMatch) {
      result.durationSeconds = parseInt(durationMatch[1], 10);
    }

    // 提取评分
    const scoreMatch = content.match(/评分[：:]\s*([ABC])/);
    if (scoreMatch) {
      result.score = scoreMatch[1] as 'A' | 'B' | 'C';
    }

    // 提取分类原因
    const classReasonMatch = content.match(/分类原因[：:]\s*(.+)$/m);
    if (classReasonMatch) {
      result.classReason = classReasonMatch[1].trim();
    }

    // 提取录音文件路径
    const audioMatch = content.match(/录音文件[：:]\s*(.+)$/m);
    if (audioMatch) {
      result.audioFilePath = audioMatch[1].trim();
    }

    // 提取转写内容（### 转写 标题下的内容）
    const transcriptMatch = content.match(/###\s*转写\s*\n([\s\S]*?)(?:\n##|$)/);
    if (transcriptMatch) {
      result.transcript = transcriptMatch[1].trim();
    }

    // 提取开始时间作为通话日期
    const dateMatch = content.match(/开始时间[：:]\s*(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      result.callDate = dateMatch[1];
    }

    return result;
  }

  private static readString(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return '';
  }

  private static toCardData(lead: RealLeadData): LeadCardData {
    // 根据评分和分类原因映射意向类别
    let category: LeadIntentCategory = CATEGORY_TO_INTENT[lead.category] || 'pending';

    // 如果评分是 A，通常为高意向
    if (lead.score === 'A' && lead.classReason?.includes('命中优先保留')) {
      category = 'high-intent';
    }
    // 如果评分是 B 或有明确拒绝关键词，为低意向
    if (lead.score === 'B' && lead.classReason?.includes('待补充')) {
      category = 'pending';
    }

    return {
      id: lead.id,
      name: lead.leadName || '未知客户',
      company: lead.company || '未知公司',
      phone: lead.phone,
      tags: [], // 当前真实数据无 tags 字段，后续可从 classReason 提取
      durationSeconds: lead.durationSeconds,
      matchReason: lead.classReason || '待补充',
      originalLink: lead.audioFilePath,
      timestamp: new Date(lead.createdTime),
      category
    };
  }
}