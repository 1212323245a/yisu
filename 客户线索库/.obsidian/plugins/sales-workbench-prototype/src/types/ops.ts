// Ops Workbench Types - 经营复盘与策略纠偏台
// Layout: 左选 / 中操 / 右辅 三栏结构
// 版本: V6 - 阶段页重组 + 问题资产页

// ============================================
// 核心视图类型
// ============================================

export type ActiveMainView = 'market' | 'sales';

// 市场话术复盘 - 3个阶段页
export type MarketStage = 'opening' | 'hook' | 'wechat';

// 销售认知复盘 - 问题资产类型
export type ProblemAssetType = 'high-frequency' | 'breakthrough' | 'new-anomaly' | 'verified' | 'rejudged';

// ============================================
// 问题闭环相关类型
// ============================================

export type ProblemStatus = 'open' | 'rejudged' | 'resolved';

export type ProblemStep = 'discovery' | 'analysis' | 'samples' | 'suggestion' | 'validation';

export type AnomalyDirection = 'positive' | 'negative' | 'normal';

// ============================================
// 市场阶段页配置
// ============================================

export interface MarketStageConfig {
  id: MarketStage;
  name: string;
  timeRange: string;
  goal: string;
  keyMetrics: string[];
  relatedNodes: string[];
}

export const MARKET_STAGE_CONFIGS: MarketStageConfig[] = [
  {
    id: 'opening',
    name: '开场白',
    timeRange: '0-13s',
    goal: '先让客户愿意继续听，不急着讲产品',
    keyMetrics: ['0-5秒挂断率', '5-13秒挂断率', '13秒进入率'],
    relatedNodes: ['16', '5']
  },
  {
    id: 'hook',
    name: '产品钩子',
    timeRange: '13-27s',
    goal: '用一句话把客户推进到愿意收案例、愿意继续了解',
    keyMetrics: ['13-27秒挂断率', '钩子接受率', '进入加微信推进率'],
    relatedNodes: ['12', '10', '8', '6']
  },
  {
    id: 'wechat',
    name: '加微信推进',
    timeRange: '27s+',
    goal: '把口头同意变成真正加到微信',
    keyMetrics: ['口头同意率', '微信确认率', '错号/换号率', '最终加微完成率'],
    relatedNodes: ['7', '15', '11', '2']
  }
];

// ============================================
// 问题资产类型配置
// ============================================

export interface ProblemAssetConfig {
  id: ProblemAssetType;
  name: string;
  description: string;
  icon: string;
  colorVar: string;
}

export const PROBLEM_ASSET_CONFIGS: ProblemAssetConfig[] = [
  {
    id: 'high-frequency',
    name: '高频问题',
    description: '反复出现的共性问题',
    icon: '🔥',
    colorVar: 'neon-orange'
  },
  {
    id: 'breakthrough',
    name: '突破机会',
    description: '正向异常，值得学习的突破点',
    icon: '⭐',
    colorVar: 'neon-green'
  },
  {
    id: 'new-anomaly',
    name: '新异常',
    description: '新发现的异常信号',
    icon: '⚡',
    colorVar: 'neon-yellow'
  },
  {
    id: 'verified',
    name: '已验证有效',
    description: '经过验证的解决方案',
    icon: '✓',
    colorVar: 'neon-cyan'
  },
  {
    id: 'rejudged',
    name: '已改判',
    description: '重新定义的问题',
    icon: '↻',
    colorVar: 'neon-purple'
  }
];

// ============================================
// 客户反应归类
// ============================================

export interface ReactionCategory {
  id: string;
  name: string;
  description: string;
  meaning: string;
  targetStage: string;
  mdReference: string;
  sampleCount: number;
}

export const REACTION_CATEGORIES: ReactionCategory[] = [
  {
    id: 'agree',
    name: '同意/可继续',
    description: '客户有初步意向，可以继续推进',
    meaning: '正向信号，应顺势推进到课程内容或给钩子',
    targetStage: '课程内容 → 给钩子',
    mdReference: 'reactions/agree-continue.md',
    sampleCount: 216
  },
  {
    id: 'reject',
    name: '拒绝/不需要',
    description: '客户明确拒绝，意向度低',
    meaning: '负向信号，应礼貌结束并标记为低意向',
    targetStage: '结束语',
    mdReference: 'reactions/reject-no-need.md',
    sampleCount: 317
  },
  {
    id: 'busy',
    name: '忙/暂时不方便',
    description: '客户时间不合适，但未明确拒绝',
    meaning: '中性信号，应确认合适时间后预约',
    targetStage: '确认时间 → 预约',
    mdReference: 'reactions/busy-later.md',
    sampleCount: 384
  },
  {
    id: 'who',
    name: '你是谁/做什么',
    description: '客户需要更多信息建立信任',
    meaning: '机会信号，客户有兴趣但需先建立信任',
    targetStage: '身份解释',
    mdReference: 'reactions/who-are-you.md',
    sampleCount: 145
  },
  {
    id: 'robot',
    name: '你是机器人吗',
    description: '客户对声音/话术产生质疑',
    meaning: '风险信号，需要自然应对解除质疑',
    targetStage: '机器人应对',
    mdReference: 'reactions/are-you-robot.md',
    sampleCount: 89
  },
  {
    id: 'content',
    name: '发什么/什么资料',
    description: '客户想要具体内容，意向信号',
    meaning: '强意向信号，应立即推进到加微信',
    targetStage: '给钩子 → 加微信',
    mdReference: 'reactions/what-content.md',
    sampleCount: 167
  },
  {
    id: 'wrong-number',
    name: '不是这个号/换号',
    description: '客户表示需要添加其他微信',
    meaning: '需要确认正确微信号后推进',
    targetStage: '确认微信号',
    mdReference: 'reactions/wrong-number.md',
    sampleCount: 45
  },
  // V8: 新增反应分类用于滚动测试
  {
    id: 'already-have',
    name: '已有类似资源',
    description: '客户表示已有类似产品或服务',
    meaning: '需要差异化切入，询问现有资源痛点',
    targetStage: '差异化说明',
    mdReference: 'reactions/already-have.md',
    sampleCount: 78
  },
  {
    id: 'how-much',
    name: '多少钱/费用',
    description: '客户询问价格',
    meaning: '购买意向信号，但需先建立价值再谈价格',
    targetStage: '价值建立 → 价格说明',
    mdReference: 'reactions/how-much.md',
    sampleCount: 134
  },
  {
    id: 'compare',
    name: '和其他对比',
    description: '客户要求与其他产品对比',
    meaning: '客户在做决策比较，需要提供对比优势',
    targetStage: '优势说明',
    mdReference: 'reactions/compare.md',
    sampleCount: 56
  },
  {
    id: 'need-consider',
    name: '需要考虑',
    description: '客户表示需要时间考虑',
    meaning: '决策犹豫，需要了解顾虑点并推动',
    targetStage: '了解顾虑 → 推动决策',
    mdReference: 'reactions/need-consider.md',
    sampleCount: 92
  }
];

// ============================================
// 问题资产数据模型
// ============================================

export interface ProblemAsset {
  id: string;
  title: string;
  type: ProblemAssetType;
  relatedStage?: MarketStage;
  anomalyDirection: AnomalyDirection;
  description: string;
  whyItMatters: string;
  currentJudgement: string;

  // 关键指标
  metrics: {
    impact: string;
    frequency: string;
    trend: string;
  };

  // 样本证据
  sampleCount: number;
  sampleSales: string[];
  sampleCustomers: string[];

  // 模式归纳
  patterns: {
    highFrequencyScene?: string;
    likelyCustomerPattern?: string;
    failurePattern?: string;
    breakthroughPattern?: string;
  };

  // 经验沉淀
  experience: {
    triedMethods: string[];
    currentConclusion: string;
    worthSaving: boolean;
    needMoreValidation: boolean;
  };

  // 状态
  status: ProblemStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 阶段复盘相关类型
// ============================================

export interface StageReviewEntry {
  problemId: string;
  problemTitle: string;
  whyThisIsAProblem: string;
  rootCauseGuesses: RootCauseGuess[];
  solutionPlan?: string;
  testSubmission?: string;
  validationResult?: 'valid' | 'partial' | 'invalid' | 'misjudged';
  isRejudged: boolean;
  createdAt: Date;
}

export interface RootCauseGuess {
  id: string;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  selected: boolean;
}

// ============================================
// 样本客户数据
// ============================================

export interface SampleCustomerData {
  id: string;
  name: string;
  company?: string;
  sourceRecord: string;
  reaction: string;
  timestamp: Date;
}

// ============================================
// AI Skill 类型
// ============================================

export type AISkillType = 'analyze' | 'suggest' | 'validate' | 'history';

export interface AISkillConfig {
  id: AISkillType;
  label: string;
  icon: string;
  description: string;
}

export const AI_SKILL_CONFIGS: AISkillConfig[] = [
  { id: 'analyze', label: '根因分析', icon: '🔬', description: '分析异常根因' },
  { id: 'suggest', label: '策略建议', icon: '💡', description: '生成调整建议' },
  { id: 'validate', label: '验证设计', icon: '✓', description: '设计验证方案' },
  { id: 'history', label: '历史检索', icon: '📚', description: '检索类似问题' },
  { id: 'pattern', label: '模式识别', icon: '🔍', description: '识别行为模式' },
  { id: 'compare', label: '对比分析', icon: '📊', description: '多维度对比' },
  { id: 'predict', label: '趋势预测', icon: '📈', description: '预测发展趋势' },
  { id: 'summarize', label: '智能摘要', icon: '📝', description: '生成内容摘要' }
];

// ============================================
// 阶段复盘持久化数据结构 - V14: 最小保存方案
// ============================================

export interface StageReviewData {
  stageId: MarketStage;
  problem: string;
  whyThisIsAProblem: string;
  rootCauseGuesses: RootCauseGuess[];
  solutionPlan: string;
  testSubmission: string;
  validationResult?: 'valid' | 'partial' | 'invalid' | 'misjudged';
  conclusion?: 'keep' | 'adjust' | 'promote' | 'rejudge';
  updatedAt: string; // ISO 8601 format
}

export interface OpsWorkbenchSaveData {
  version: 'v14';
  lastUpdated: string;
  stageReviews: Record<string, StageReviewData>; // key: stageId
  currentState: {
    activeMainView: ActiveMainView;
    activeMarketStage: MarketStage;
    activeProblemAssetType: ProblemAssetType;
    showProblemReview: boolean;
    currentStep: ProblemStep;
  };
}

// 默认空数据
export const DEFAULT_OPS_SAVE_DATA: OpsWorkbenchSaveData = {
  version: 'v14',
  lastUpdated: new Date().toISOString(),
  stageReviews: {},
  currentState: {
    activeMainView: 'market',
    activeMarketStage: 'opening',
    activeProblemAssetType: 'high-frequency',
    showProblemReview: false,
    currentStep: 'discovery'
  }
};
// ============================================

export const PROBLEM_STEP_CONFIGS: Record<ProblemStep, { label: string; icon: string; order: number }> = {
  discovery: { label: '发现问题', icon: '🔍', order: 1 },
  analysis: { label: '原因分析', icon: '🔬', order: 2 },
  samples: { label: '样本链接', icon: '🔗', order: 3 },
  suggestion: { label: '建议调整', icon: '💡', order: 4 },
  validation: { label: '待验证', icon: '✓', order: 5 }
};

// ============================================
// 状态门流转规则
// ============================================

export const STATUS_GATE_RULES = {
  normalFlow: ['discovery', 'analysis', 'samples', 'suggestion', 'validation'] as ProblemStep[],

  specialFlow: ['pending-confirmation', 'rejudged', 'new-problem'] as const,

  validationStates: ['valid', 'partial', 'invalid', 'misjudged'] as const,

  rules: {
    lockNextIfPreviousIncomplete: true,
    allowManualProblemCreation: true,
    requireHumanConfirmationForAI: true,
    requireHistoryCheckForUnresolved: true
  }
};

// ============================================
// Mock 数据生成器 - V9: 结构回正，销售认知复盘问题资产禁止混入市场话术问题
// ============================================

export const generateMockProblemAssets = (): ProblemAsset[] => [
  {
    id: 'PA-001',
    title: '张明深度链接转化率高',
    type: 'breakthrough',
    relatedStage: undefined, // 销售认知问题，不关联市场阶段
    anomalyDirection: 'positive',
    description: '张明深度链接率73.7%，显著高于团队平均55%。这是一个值得深入研究学习的正向异常案例。通过对比分析发现，张明在信息收集后的跟进环节有独特的方法论，能够在客户表达初步意向后迅速建立深度链接，推动客户进入下一步。',
    whyItMatters: '正向异常代表可复制的成功经验。如果能够提炼出方法论并在团队内推广，预计整体深度链接率可以从55%提升至65%以上，对应每月增加30-40个高质量线索。',
    currentJudgement: '跟进节奏和信息收集方式有优势，特别是"三问三确认"的话术结构效果显著。',
    metrics: {
      impact: '同等微信数下成交率提升35%',
      frequency: '持续性表现',
      trend: '稳定优秀'
    },
    sampleCount: 45,
    sampleSales: ['张明'],
    sampleCustomers: ['李总科技', '王经理咨询', '赵总监建设', '孙主任教育'],
    patterns: {
      highFrequencyScene: '信息收集后的跟进环节，特别是客户表达"了解一下"意向后',
      breakthroughPattern: '快速响应（5分钟内）+ 精准需求匹配 + 案例佐证'
    },
    experience: {
      triedMethods: ['复盘张明的话术节奏', '提炼方法论', '小规模试点推广'],
      currentConclusion: '值得在团队内推广，已整理成SOP文档',
      worthSaving: true,
      needMoreValidation: false
    },
    status: 'resolved',
    createdAt: new Date('2026-04-05'),
    updatedAt: new Date('2026-04-12')
  },
  {
    id: 'PA-002',
    title: '王强促单要求率偏低',
    type: 'high-frequency',
    relatedStage: undefined,
    anomalyDirection: 'negative',
    description: '王强促单要求率18.5%，低于团队平均28%。分析发现，王强在跟进过程中过于注重关系维护，担心催促会引起客户反感，导致多次跟进后仍未能明确提出成交要求。',
    whyItMatters: '促单要求率直接影响成交转化。过低的促单率意味着潜在成交机会的流失，即使线索质量良好也无法转化为实际业绩。',
    currentJudgement: '销售心态问题，需要调整跟进策略，建立明确的促单节点意识。',
    metrics: {
      impact: '同等线索量下成交率低40%',
      frequency: '持续存在',
      trend: '稳定低位'
    },
    sampleCount: 67,
    sampleSales: ['王强', '刘芳'],
    sampleCustomers: ['多位潜在客户'],
    patterns: {
      highFrequencyScene: '跟进3次以上仍未促单的情况',
      failurePattern: '过度维护关系，迟迟不进入成交阶段',
      likelyCustomerPattern: '意向明确但决策周期长的客户'
    },
    experience: {
      triedMethods: ['培训促单话术', '设定促单节点检查点', '同行旁听学习'],
      currentConclusion: '需要建立促单意识，明确每通电话的目标',
      worthSaving: true,
      needMoreValidation: true
    },
    status: 'open',
    createdAt: new Date('2026-04-08'),
    updatedAt: new Date('2026-04-14')
  },
  {
    id: 'PA-003',
    title: '李云杰信息获取率异常高',
    type: 'breakthrough',
    relatedStage: undefined,
    anomalyDirection: 'positive',
    description: '李云杰信息获取率82%，显著高于团队平均65%。通过对比分析，发现其在开场3分钟内能够快速建立信任并引导客户透露关键信息，特别是客户预算范围和决策流程。',
    whyItMatters: '信息获取是后续跟进的基础。充足的信息能够精准匹配方案，提高成交概率。',
    currentJudgement: '开场信任建立和问题设计有优势，值得提炼为团队标准动作。',
    metrics: {
      impact: '客户画像完整度提升45%',
      frequency: '持续性表现',
      trend: '稳定优秀'
    },
    sampleCount: 52,
    sampleSales: ['李云杰'],
    sampleCustomers: ['多个行业客户'],
    patterns: {
      highFrequencyScene: '首次跟进电话',
      breakthroughPattern: '先给价值再问信息 + 逐步深入提问策略'
    },
    experience: {
      triedMethods: ['复盘李云杰的开场话术', '提炼信息获取问题清单', '团队分享'],
      currentConclusion: '已形成SOP，正在团队推广',
      worthSaving: true,
      needMoreValidation: false
    },
    status: 'resolved',
    createdAt: new Date('2026-04-06'),
    updatedAt: new Date('2026-04-13')
  },
  {
    id: 'PA-004',
    title: '陈华正式成交率持续低迷',
    type: 'high-frequency',
    relatedStage: undefined,
    anomalyDirection: 'negative',
    description: '陈华正式成交率8.2%，低于团队平均15%。分析发现，虽然陈华促单要求率正常，但在客户表示"考虑一下"后缺乏有效跟进，导致大量潜在客户流失。',
    whyItMatters: '成交率是销售漏斗的最后一环。前面环节表现正常但成交率低，意味着临门一脚存在问题。',
    currentJudgement: '异议处理和临门促单能力不足，需要针对性训练。',
    metrics: {
      impact: '每月少成交5-8单',
      frequency: '持续存在',
      trend: '低位徘徊'
    },
    sampleCount: 89,
    sampleSales: ['陈华'],
    sampleCustomers: ['多位潜在客户'],
    patterns: {
      highFrequencyScene: '客户表示"考虑一下"后',
      failurePattern: '跟进间隔过长，或缺乏有效推进手段'
    },
    experience: {
      triedMethods: ['异议处理培训', '设定跟进检查点', '案例复盘'],
      currentConclusion: '需要建立标准化异议处理流程',
      worthSaving: true,
      needMoreValidation: true
    },
    status: 'open',
    createdAt: new Date('2026-04-10'),
    updatedAt: new Date('2026-04-14')
  },
  {
    id: 'PA-005',
    title: '新人销售深度链接率普遍低',
    type: 'new-anomaly',
    relatedStage: undefined,
    anomalyDirection: 'negative',
    description: '新入职销售（入职3个月内）深度链接率平均42%，显著低于老销售的68%。问题主要出在对客户需求的理解和方案匹配能力不足。',
    whyItMatters: '新人占比30%，如果深度链接率不能提升，将直接影响团队整体业绩和新人留存。',
    currentJudgement: '需要加强新人培训中的案例分析和实战演练环节。',
    metrics: {
      impact: '新人月均业绩比老销售低60%',
      frequency: '新人普遍存在',
      trend: '上升趋势（新人增多）'
    },
    sampleCount: 34,
    sampleSales: ['周杰', '吴明', '郑晓'],
    sampleCustomers: ['多位潜在客户'],
    patterns: {
      highFrequencyScene: '客户提出具体需求后',
      failurePattern: '无法快速匹配到合适的方案或案例'
    },
    experience: {
      triedMethods: ['增加案例培训', '老带新机制', '模拟演练'],
      currentConclusion: '正在试点新的培训方案',
      worthSaving: true,
      needMoreValidation: true
    },
    status: 'open',
    createdAt: new Date('2026-04-13'),
    updatedAt: new Date('2026-04-14')
  }
];
