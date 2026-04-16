// Review chain types

// Review stages
export type ReviewStage = 'identify' | 'ai-processing' | 'confirm' | 'sync';

export interface StageConfig {
  name: ReviewStage;
  displayName: string;
  colorVar: string;
}

// US-003: 正确的业务命名
export const STAGE_CONFIGS: Record<ReviewStage, StageConfig> = {
  'identify': { name: 'identify', displayName: '待人工识别', colorVar: 'neon-yellow' },
  'ai-processing': { name: 'ai-processing', displayName: 'AI处理中', colorVar: 'neon-purple' },
  'confirm': { name: 'confirm', displayName: '待确认', colorVar: 'neon-cyan' },
  'sync': { name: 'sync', displayName: '待同步', colorVar: 'neon-green' }
};

// Customer context (US-001)
export interface LastFollowUp {
  date: string;
  action: string;
  result: string;
  notes?: string;
  nextPlannedDate?: string;
}

export interface CustomerContext {
  customerId: string;
  customerName: string;
  company: string;
  contactPhone?: string;
  summary: string;
  lastFollowUp: LastFollowUp;
  totalFollowUps: number;
  tags: string[];
}

// AI recalculation (US-002)
export interface AIRecalculationResult {
  fieldKey: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changed: boolean;
  confidence: number;
  reason?: string;
}

export type RecalcStatus = 'pending' | 'calculating' | 'ready' | 'confirmed';

export interface RecalculationState {
  status: RecalcStatus;
  results: AIRecalculationResult[];
  triggeredBy: string[];
}

// Freeze status (US-003)
export type FreezeStatus = 'unfreezed' | 'freezing' | 'freezed';

export interface FreezeInfo {
  status: FreezeStatus;
  freezedAt?: string;
  freezedBy?: string;
  canUnfreeze: boolean;
}

// Sync status (US-003, US-005)
export type SyncStatus = 'unsynced' | 'syncing' | 'synced' | 'failed';
export type ReviewStatus = 'pending_review' | 'in_review' | 'review_completed';

// Sync preview field (US-003)
export interface SyncPreviewField {
  key: string;
  label: string;
  oldValue: string;
  newValue: string;
  targetNote: string;
  changed: boolean;
  syncStatus: SyncStatus;
}

// Status display config (US-005)
export const STATUS_DISPLAY: Record<string, { text: string; colorVar: string }> = {
  'pending_review': { text: '待审核', colorVar: 'neon-yellow' },
  'in_review': { text: '审核中', colorVar: 'neon-cyan' },
  'review_completed': { text: '已审核', colorVar: 'neon-green' },
  'unsynced': { text: '未同步', colorVar: 'neon-orange' },
  'syncing': { text: '同步中', colorVar: 'neon-purple' },
  'synced': { text: '已同步', colorVar: 'neon-green' },
  'failed': { text: '同步失败', colorVar: 'neon-red' },
  'unfreezed': { text: '未封板', colorVar: 'neon-yellow' },
  'freezing': { text: '封板中', colorVar: 'neon-purple' },
  'freezed': { text: '已封板', colorVar: 'neon-green' }
};

// Queue item
export interface QueueItemData {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'confirming' | 'synced';
  salesOwner?: string;
  anomalyType?: string;
  // Extended fields (US-005)
  reviewStatus?: ReviewStatus;
  syncStatus?: SyncStatus;
  freezeStatus?: FreezeStatus;
  currentStage?: ReviewStage;
}

// Sales supervisor (US-006)
export interface SalesSupervisorData {
  salesName: string;
  pendingRecordings: number;
  processingRecordings: number;
  completedRecordings: number;
  needsFeedback: boolean;
  lastActiveTime?: string;
  companies?: CompanyTrackingData[];
}

// Company tracking (US-007)
export interface CompanyTrackingData {
  companyName: string;
  customerId?: string;
  pendingItems: number;
  lastActivity?: string;
  priority: 'high' | 'medium' | 'low';
}

// Field types
export interface EditableField {
  key: string;
  label: string;
  value: string;
  type: 'text' | 'select' | 'linkable';
  options?: string[];
  sourceHighlightId?: string;
}

// AI extraction result
export interface AIExtractionResult {
  actionTags: string[];
  intentStatus: string;
  pushStatus: string;
  needs: Record<string, { status: string; content: string }>;
  nextActionSuggestion: string;
  nextDateSuggestion: string;
}

// Sync preview
export interface SyncPreviewItem {
  field: string;
  oldValue: string;
  newValue: string;
  changed: boolean;
}

// Stats
export interface ReviewStats {
  pendingIdentify: number;
  aiProcessing: number;
  pendingConfirm: number;
  pendingSync: number;
}