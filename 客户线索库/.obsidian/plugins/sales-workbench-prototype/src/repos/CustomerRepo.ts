// Customer Repository - 只读接线层
// 从 客户总库 目录读取真实客户摘要数据

import { App, TFile, TFolder } from 'obsidian';
import { RealCustomerData, CustomerMatchResult, CustomerContext } from './types';

const CUSTOMER_ROOT = '客户总库';
const SUMMARY_FILE_NAME = '客户总览.md';

export class CustomerRepo {
  /**
   * 通过手机号精确匹配客户
   */
  static async findByPhone(app: App, phone: string): Promise<CustomerMatchResult | null> {
    // 标准化手机号（去除空格和横线）
    const normalizedPhone = phone.replace(/[\s-]/g, '');

    const allCustomers = await this.getAllCustomers(app);

    for (const customer of allCustomers) {
      const customerPhone = customer.phone.replace(/[\s-]/g, '');
      if (customerPhone === normalizedPhone) {
        return {
          customerId: customer.id,
          customerName: customer.leadName,
          company: customer.company,
          phone: customer.phone,
          matchConfidence: 'high',
          summaryFilePath: customer.summaryFilePath
        };
      }
    }

    return null;
  }

  /**
   * 通过关键词搜索客户（姓名/公司模糊匹配）
   */
  static async search(app: App, keyword: string): Promise<CustomerMatchResult[]> {
    const lowerKeyword = keyword.toLowerCase();
    const results: CustomerMatchResult[] = [];

    const allCustomers = await this.getAllCustomers(app);

    for (const customer of allCustomers) {
      const nameMatch = customer.leadName.toLowerCase().includes(lowerKeyword);
      const companyMatch = customer.company.toLowerCase().includes(lowerKeyword);
      const phoneMatch = customer.phone.includes(keyword);

      if (nameMatch || companyMatch || phoneMatch) {
        results.push({
          customerId: customer.id,
          customerName: customer.leadName,
          company: customer.company,
          phone: customer.phone,
          matchConfidence: nameMatch && companyMatch ? 'high' : 'medium',
          summaryFilePath: customer.summaryFilePath
        });
      }
    }

    // 按匹配置信度排序
    results.sort((a, b) => {
      if (a.matchConfidence === 'high' && b.matchConfidence !== 'high') return -1;
      if (a.matchConfidence !== 'high' && b.matchConfidence === 'high') return 1;
      return 0;
    });

    return results;
  }

  /**
   * 获取客户上下文（用于右侧显示）
   */
  static async getContext(app: App, customerId: string): Promise<CustomerContext | null> {
    const customer = await this.getCustomerById(app, customerId);
    if (!customer) {
      return null;
    }

    // 读取客户总览文件内容，提取摘要信息
    const summaryContent = await this.readSummaryFile(app, customer.summaryFilePath);

    return {
      customerId: customer.id,
      customerName: customer.leadName,
      company: customer.company,
      contactPhone: customer.phone,
      summary: summaryContent?.summary || `${customer.leadName}，${customer.company}`,
      // CTX-PATCH-001: fallback 用方括号标记，与真实摘要字段区分
      // 真实值来自 frontmatter sales_owner/source_pool，fallback 用 [待补充] 标记
      salesOwner: summaryContent?.salesOwner || '[摘要缺失-待补充]',
      sourcePool: summaryContent?.sourcePool || '[摘要缺失-待判断]',
      lastFollowUp: summaryContent?.lastFollowUp,
      totalFollowUps: summaryContent?.followupCount || 0,
      tags: summaryContent?.tags || []
    };
  }

  /**
   * 获取所有客户（遍历目录）
   */
  static async getAllCustomers(app: App): Promise<RealCustomerData[]> {
    const customers: RealCustomerData[] = [];
    const rootFolder = app.vault.getAbstractFileByPath(CUSTOMER_ROOT);

    if (!(rootFolder instanceof TFolder)) {
      console.warn('[CustomerRepo] 目录不存在:', CUSTOMER_ROOT);
      return customers;
    }

    // 遍历年月/周/日期目录
    this.walkCustomerFolders(rootFolder, customers);

    return customers;
  }

  // === Private helpers ===

  private static walkCustomerFolders(folder: TFolder, customers: RealCustomerData[]): void {
    for (const child of folder.children) {
      if (child instanceof TFolder) {
        // 检查是否是客户文件夹（命名格式：{姓名}-{公司}-{手机号}）
        const folderName = child.name;
        const phoneMatch = folderName.match(/1\d{10}$/);

        if (phoneMatch) {
          // 这是客户文件夹，查找客户总览文件
          const summaryFile = child.children.find(
            c => c instanceof TFile && c.name === SUMMARY_FILE_NAME
          );

          if (summaryFile instanceof TFile) {
            customers.push({
              id: child.path,
              folderPath: child.path,
              summaryFilePath: summaryFile.path,
              leadName: this.extractNameFromFolder(folderName),
              company: this.extractCompanyFromFolder(folderName),
              phone: phoneMatch[0],
              // CTX-PATCH-001: 目录扫描阶段不伪装真实业务值
              // salesOwner/sourcePool 设为 undefined，由 getContext 从真实摘要读取
              salesOwner: undefined as any,
              sourcePool: undefined as any
            });
          }
        } else {
          // 继续递归子目录
          this.walkCustomerFolders(child, customers);
        }
      }
    }
  }

  private static extractNameFromFolder(folderName: string): string {
    // 格式：{姓名}-{公司}-{手机号}
    const parts = folderName.split('-');
    if (parts.length >= 3) {
      return parts[0];
    }
    return folderName;
  }

  private static extractCompanyFromFolder(folderName: string): string {
    // 格式：{姓名}-{公司}-{手机号}
    const phoneMatch = folderName.match(/1\d{10}$/);
    if (phoneMatch) {
      const withoutPhone = folderName.replace(phoneMatch[0], '');
      const parts = withoutPhone.split('-');
      if (parts.length >= 2) {
        return parts.slice(1).join('-').replace(/^-/, '');
      }
    }
    return '';
  }

  private static async getCustomerById(app: App, customerId: string): Promise<RealCustomerData | null> {
    const allCustomers = await this.getAllCustomers(app);
    return allCustomers.find(c => c.id === customerId) || null;
  }

  private static async readSummaryFile(app: App, filePath: string): Promise<{
    summary?: string;
    salesOwner?: string;
    sourcePool?: string;
    followupCount?: number;
    lastFollowUp?: { date: string; action: string; result: string };
    tags?: string[];
  } | null> {
    try {
      const file = app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        return null;
      }

      const cache = app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter || {};
      const content = await app.vault.read(file);

      // 从 frontmatter 提取真实字段
      const salesOwner = this.readString(frontmatter.sales_owner);
      const followupCount = this.readNumber(frontmatter.followup_count) || 0;
      const lastFollowupAt = this.readString(frontmatter.last_followup_at);
      const sourcePool = this.readString(frontmatter.current_pool) || this.readString(frontmatter.source_pool);

      // 从正文提取摘要（## 客户概览 下的内容）
      const summaryMatch = content.match(/##\s*客户概览\s*\n([\s\S]*?)(?:\n##|$)/);
      let summary = '';
      if (summaryMatch) {
        // 提取关键信息行
        const overviewLines = summaryMatch[1].split('\n').filter(l => l.startsWith('-'));
        summary = overviewLines.slice(0, 5).join('\n');
      }

      // 构建 lastFollowUp
      const lastFollowUp = lastFollowupAt ? {
        date: lastFollowupAt.split(' ')[0] || lastFollowupAt,
        action: '跟进',
        result: frontmatter.followup_status || '待跟进'
      } : undefined;

      // 返回真实字段，字段缺失时返回 undefined（显式缺失，不是伪装值）
      return {
        summary: summary || `${frontmatter.lead_name || '客户'}，${frontmatter.company || '公司'}，销售：${salesOwner || '未知'}`,
        salesOwner: salesOwner || undefined,  // 有真实值才返回
        sourcePool: sourcePool || undefined,  // 有真实值才返回
        followupCount,
        lastFollowUp,
        tags: []
      };
    } catch (err) {
      console.warn('[CustomerRepo] 读取摘要失败:', filePath, err);
      return null;
    }
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

  private static readNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
}