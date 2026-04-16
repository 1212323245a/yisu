// Lead screening types

// Lead intent categories
export type LeadIntentCategory = 'high-intent' | 'low-intent' | 'pending';

// Lead tag types
export type LeadTagType = 'product' | 'price' | 'need' | 'negative';

export interface LeadTag {
  type: LeadTagType;
  text: string;
}

export interface LeadCardData {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  tags: LeadTag[];
  durationSeconds: number;
  matchReason?: string;
  originalLink?: string;
  timestamp: Date;
  category: LeadIntentCategory;
}

export interface LeadGroupData {
  category: LeadIntentCategory;
  title: string;
  leads: LeadCardData[];
}

export interface TransferItem {
  leadId: string;
  name: string;
  company?: string;
}

export interface RecycleItem {
  leadId: string;
  name: string;
  deletedAt: Date;
  restoreCountdown: number; // seconds remaining
}

// Stats
export interface LeadStats {
  totalLeads: number;
  highIntentCount: number;
  pendingImportCount: number;
}