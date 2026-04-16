// Repository layer types - 只读接线专用

import { LeadIntentCategory } from '../types/lead';

// === Lead Repo Types ===

export interface RealLeadData {
  id: string;              // 文件路径作为 ID
  filePath: string;
  leadName: string;
  company: string;
  phone: string;
  category: string;
  source: string;
  // 正文提取字段
  recordId?: string;
  durationSeconds: number;
  score?: 'A' | 'B' | 'C';
  classReason?: string;
  audioFilePath?: string;
  transcript?: string;
  // 时间信息
  callDate?: string;
  createdTime: number;     // 文件创建时间戳
}

export interface TranscriptItem {
  time: string;
  speaker: string;
  text: string;
}

// LeadIntentCategory 映射
export const CATEGORY_TO_INTENT: Record<string, LeadIntentCategory> = {
  '1潜在意向客户': 'pending',
  '积极命中': 'high-intent',
  '负向待复核': 'low-intent',
  '长通话无关键词': 'pending',
  '其余': 'pending'
};

// === Customer Repo Types ===

export interface RealCustomerData {
  id: string;              // 客户文件夹路径作为 ID
  folderPath: string;
  summaryFilePath: string;
  leadName: string;
  company: string;
  phone: string;
  salesOwner: string;
  sourcePool: string;
  // 可选扩展字段
  wechatStatus?: string;
  followupCount?: number;
  lastFollowupAt?: string;
}

export interface CustomerMatchResult {
  customerId: string;
  customerName: string;
  company: string;
  phone: string;
  matchConfidence: 'high' | 'medium' | 'low';
  summaryFilePath?: string;
}

export interface CustomerContext {
  customerId: string;
  customerName: string;
  company: string;
  contactPhone?: string;
  summary: string;
  salesOwner: string;
  sourcePool: string;
  lastFollowUp?: {
    date: string;
    action: string;
    result: string;
  };
  totalFollowUps: number;
  tags: string[];
}