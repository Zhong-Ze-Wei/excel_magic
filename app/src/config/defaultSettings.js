// 默认的 API 平台和模型配置
export const DEFAULT_API_PLATFORMS = {
  siliconflow: {
    name: '硅基流动',
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    registerUrl: 'https://cloud.siliconflow.cn/i/S8pG3891',
    keyUrl: 'https://cloud.siliconflow.cn/me/account/ak',
    inviteCode: 'S8pG3891',
    translateModels: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3 (推荐)' },
      { id: 'Tencent/Hunyuan-MT-7B', name: 'Hunyuan-MT (腾讯专业翻译)' },
      { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen2.5-7B' }
    ],
    workModels: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3 (最新)' },
      { id: 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B', name: 'DeepSeek-R1 (推理)' },
      { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4-9B' }
    ]
  },
  aiping: {
    name: 'aiping.cn',
    url: 'https://www.aiping.cn/api/v1/chat/completions',
    registerUrl: 'https://www.aiping.cn/#?invitation_code=UVPGQPBMWB',
    keyUrl: 'https://www.aiping.cn/user/apikey',
    inviteCode: 'UVPGQPBMWB',
    translateModels: [
      { id: 'DeepSeek-V4-Flash', name: 'DeepSeek-V4-Flash (默认)' },
      { id: 'GLM-4.7', name: 'GLM-4.7' },
      { id: 'MiniMax-M2.1', name: 'MiniMax-M2.1' },
      { id: 'Qwen3-235B-A22B', name: 'Qwen3-235B-A22B' },
      { id: 'DeepSeek-V3.2', name: 'DeepSeek-V3.2' }
    ],
    workModels: [
      { id: 'DeepSeek-V4-Flash', name: 'DeepSeek-V4-Flash (默认)' },
      { id: 'GLM-4.7', name: 'GLM-4.7' },
      { id: 'MiniMax-M2.1', name: 'MiniMax-M2.1' },
      { id: 'Qwen3-235B-A22B', name: 'Qwen3-235B-A22B' },
      { id: 'DeepSeek-V3.2', name: 'DeepSeek-V3.2' }
    ]
  }
}

// 默认的数据清洗规则配置参数
export const DEFAULT_RULES_CONFIG = {
  empty: { enable: true },
  tooShort: { enable: true, minLength: 2 },
  duplicate: { enable: true, minCount: 3 },
  pureEmoji: { enable: true },
  pureSymbol: { enable: true },
  linkOnly: { enable: true },
  topicOnly: { enable: true, ratioThreshold: 0.8 },
  shortMeaningless: {
    enable: true,
    phrasesStr: '好,顶,赞,666,支持,牛,哈哈,笑死,打卡,占位,顶贴',
    phrases: ['好', '顶', '赞', '666', '支持', '牛', '哈哈', '笑死', '打卡', '占位', '顶贴']
  },
  adLink: {
    enable: true,
    keywordsStr: '加微信,私信,领取,优惠,下单,代理,链接,看主页,找我',
    keywords: ['加微信', '私信', '领取', '优惠', '下单', '代理', '链接', '看主页', '找我']
  },
  garbledText: { enable: true, threshold: 0.4 },
  weakPolicy: 'mark',
  customFilters: []
}

// 初始化、恢复默认与备份共用的设置默认值。
export const DEFAULT_SETTINGS = {
  apiPlatform: 'aiping',
  apiKeys: { siliconflow: '', aiping: '' },
  selectedTranslateModel: { siliconflow: 'deepseek-ai/DeepSeek-V4-Flash', aiping: 'DeepSeek-V4-Flash' },
  selectedWorkModel: { siliconflow: 'deepseek-ai/DeepSeek-V4-Flash', aiping: 'DeepSeek-V4-Flash' },
  concurrency: 3,
  autoIntentAnalysis: true,
  cleaningMode: 'simple',
  processMode: 'simple'
}
