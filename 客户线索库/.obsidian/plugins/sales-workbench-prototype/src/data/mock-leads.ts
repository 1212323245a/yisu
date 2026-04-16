// Mock data for development and testing

import { LeadCardData, LeadGroupData, LeadStats, LeadIntentCategory, LeadTag } from '../types/lead';

// Generate random lead tags
function generateTags(): LeadTag[] {
  const tagTypes: LeadTag[] = [
    { type: 'product', text: '产品咨询' },
    { type: 'price', text: '价格敏感' },
    { type: 'need', text: '有痛点' },
    { type: 'negative', text: '暂无意向' }
  ];

  const count = Math.floor(Math.random() * 3) + 1;
  const selected: LeadTag[] = [];
  const available = [...tagTypes];

  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    selected.push(available.splice(idx, 1)[0]);
  }

  return selected;
}

// Mock lead data
export const mockLeads: LeadCardData[] = [
  // High intent leads (积极命中)
  {
    id: 'lead-001',
    name: '王主任',
    company: '某科技公司',
    phone: '138****1234',
    tags: [{ type: 'product', text: '产品咨询' }, { type: 'need', text: '明确痛点' }],
    durationSeconds: 180,
    matchReason: '提及"数字化转型"、"效率提升"',
    originalLink: 'https://example.com/call/001',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    category: 'high-intent'
  },
  {
    id: 'lead-002',
    name: '孙总监',
    company: '某制造企业',
    phone: '139****5678',
    tags: [{ type: 'price', text: '询价意向' }],
    durationSeconds: 120,
    matchReason: '询问"价格区间"、"实施周期"',
    originalLink: 'https://example.com/call/002',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    category: 'high-intent'
  },
  {
    id: 'lead-003',
    name: '赵副总',
    company: '某投资公司',
    phone: '136****9012',
    tags: [{ type: 'need', text: '痛点明确' }, { type: 'product', text: '竞品对比' }],
    durationSeconds: 240,
    matchReason: '对比"三家供应商"、"决策周期"',
    originalLink: 'https://example.com/call/003',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    category: 'high-intent'
  },

  // Low intent leads (负向待复核)
  {
    id: 'lead-004',
    name: '李经理',
    company: '某贸易公司',
    phone: '137****3456',
    tags: [{ type: 'negative', text: '暂无意向' }],
    durationSeconds: 45,
    matchReason: '表示"暂时不考虑"、"预算已锁定"',
    originalLink: 'https://example.com/call/004',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    category: 'low-intent'
  },
  {
    id: 'lead-005',
    name: '张助理',
    company: '某咨询公司',
    phone: '135****7890',
    tags: [{ type: 'negative', text: '仅询价' }],
    durationSeconds: 30,
    matchReason: '仅询问"大概多少钱"，无深度交流',
    originalLink: 'https://example.com/call/005',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    category: 'low-intent'
  },

  // Pending leads (长通话无关键词/其余)
  {
    id: 'lead-006',
    name: '周采购',
    company: '某零售企业',
    phone: '138****2345',
    tags: [],
    durationSeconds: 180,
    matchReason: '通话长但无关键词命中',
    originalLink: 'https://example.com/call/006',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    category: 'pending'
  },
  {
    id: 'lead-007',
    name: '吴秘书',
    company: '某政府机构',
    phone: '139****6789',
    tags: [],
    durationSeconds: 90,
    matchReason: '仅确认基本信息',
    originalLink: 'https://example.com/call/007',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    category: 'pending'
  },
  {
    id: 'lead-008',
    name: '陈老板',
    company: '某餐饮连锁',
    phone: '136****0123',
    tags: [],
    durationSeconds: 60,
    matchReason: '其他类型线索',
    originalLink: 'https://example.com/call/008',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    category: 'pending'
  }
];

// Group leads by category
export function groupLeadsByCategory(leads: LeadCardData[]): LeadGroupData[] {
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

// Calculate stats
export function calculateLeadStats(leads: LeadCardData[]): LeadStats {
  return {
    totalLeads: leads.length,
    highIntentCount: leads.filter(l => l.category === 'high-intent').length,
    pendingImportCount: 0 // Will be updated by selection state
  };
}