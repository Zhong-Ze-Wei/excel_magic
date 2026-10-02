/**
 * 原子规则的元信息（单一事实源）
 *
 * 各字段用途：
 * - key：对应 rulesConfig 的键、runCleaningPipeline 内的分支判断
 * - title：完整名称，用于专家模式规则面板、AI prompt（getSmartFilterPrompt）
 * - shortTitle：简称，用于简易模式 chip 标签、命中统计展示
 * - hitKey：命中时写入 result.hitRule 的标识，用于规则命中计数
 * - description：规则说明，喂给 AI 让其理解每条规则的语义
 * - isWeak：是否为弱规则（受 weakPolicy 影响，可能转 suspect）
 *
 * 顺序与 runCleaningPipeline 内的判定顺序保持一致（强删在前，弱删在后）。
 * 新增/调整规则时，这里与 pipeline 实现、DEFAULT_RULES_CONFIG 三处需同步。
 */
export const ATOMIC_RULES_META = [
  { key: 'empty',           title: '空文本过滤',     shortTitle: '空文本', hitKey: 'empty_text',       description: '标准化后字符为空的单元格自动删除。',                                                       isWeak: false },
  { key: 'tooShort',        title: '字数过短过滤',   shortTitle: '过短',   hitKey: 'text_too_short',   description: '过滤除标点外核心有效字符数少于指定长度的简短无意义单元格。',                             isWeak: false },
  { key: 'duplicate',       title: '全表精确去重',   shortTitle: '重复',   hitKey: 'exact_duplicate',  description: '重复文本数量达到指定阈值时，自动将除首条外的所有重复行标记为删除。',                     isWeak: false },
  { key: 'linkOnly',        title: '纯网址链接过滤', shortTitle: '纯链接', hitKey: 'link_only',        description: '内容为单独一个 HTTP/HTTPS/短链网址的行标记为删除。',                                     isWeak: false },
  { key: 'pureEmoji',       title: '纯表情过滤',     shortTitle: '纯表情', hitKey: 'pure_emoji',       description: '内容全部由表情符号(Emoji)构成的行自动标记为删除。',                                      isWeak: false },
  { key: 'pureSymbol',      title: '纯标点符号过滤', shortTitle: '纯符号', hitKey: 'pure_symbol',      description: '去除空格后全是非字母数字及中文汉字的标点/杂乱字符时标记为删除。',                        isWeak: false },
  { key: 'topicOnly',       title: '纯话题过滤',     shortTitle: '话题',   hitKey: 'topic_only',       description: '包含一个或多个微博/贴吧话题（#话题内容#），但非话题文本比率极低时过滤。',                isWeak: false },
  { key: 'shortMeaningless',title: '无意义短词过滤', shortTitle: '无意义', hitKey: 'short_meaningless',description: '精确匹配水贴词汇（如：哈哈、打卡、顶、赞、支持），清除无营养灌水信息。',                isWeak: false },
  { key: 'adLink',          title: '引流广告过滤',   shortTitle: '广告',   hitKey: 'ad_link',          description: '匹配微商、客服引流关键字。若含链接则直接强删，仅有关键字则转入"待确认"或删除。',         isWeak: true },
  { key: 'garbledText',     title: '疑似乱码清洗',   shortTitle: '乱码',   hitKey: 'suspect_garbled',  description: '统计文本中包含的非汉字英数常规符号占比，超出判定阈值即怀疑为乱码。',                     isWeak: true }
]

/**
 * 文本标准化处理：去除控制字符、不可见字符，压缩连续空白，去除首尾空白
 */
export function normalizeText(text) {
  if (text == null) return ''
  // 1. 过滤不可见控制字符和特殊的 Unicode 空白 (如 \u200b 零宽空格)
  let cleaned = String(text).replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
  // 2. 将多个连续的空白缩减为一个标准空格
  cleaned = cleaned.replace(/\s+/g, ' ')
  return cleaned.trim()
}

/**
 * 原子规则 1：判断是否空文本
 */
export function checkIsEmpty(text) {
  const empty = text === ''
  return {
    hit: empty,
    reason: 'empty_text',
    confidence: empty ? 1.0 : 0
  }
}

/**
 * 原子规则 1.5：判定字数是否过短 (如单个字符 '-', '求', '赞' 等无意义占位符)
 */
export function checkTooShort(text, minLength = 2) {
  // 1. 过滤掉所有非中英文字符和数字后，提取出真正的内容字数
  const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
  // 2. 去除所有空格后，看其非标点的字数是否少于设定阈值，或者剥离空格后的原始文本长度是否为 0
  const noSpace = text.replace(/\s/g, '')
  
  const isShort = cleaned.length < minLength || noSpace.length < 1
  return {
    hit: isShort,
    reason: 'text_too_short',
    confidence: isShort ? 0.95 : 0
  }
}

/**
 * 原子规则 2：完全重复出现判定
 */
export function checkDuplicate(text, index, textFreq, firstIndices, minCount = 3) {
  const count = textFreq[text] || 1
  if (count >= minCount) {
    const isFirst = firstIndices[text] === index
    return {
      hit: !isFirst, // 重复且不是第一次出现的，标记为删除
      reason: 'exact_duplicate',
      confidence: 1.0
    }
  }
  return { hit: false }
}

/**
 * 原子规则 3：判断是否纯表情（纯 Emoji 或 [赞]、[玫瑰] 等占位文字表情）
 */
export function checkPureEmoji(text) {
  const noSpace = text.replace(/\s/g, '')
  if (!noSpace) return { hit: false }
  
  // 1. 匹配微博/贴吧/抖音风格的占位表情，如 [赞], [打call], [玫瑰]
  const placeholderEmojiPattern = /\[[^\]]{1,10}\]/g
  let remain = noSpace.replace(placeholderEmojiPattern, '')
  
  // 2. 如果剔除 [xxx] 后文本为空，说明整行只有文字表情占位符
  if (remain === '') {
    return {
      hit: true,
      reason: 'pure_emoji',
      confidence: 0.99
    }
  }
  
  // 3. 混合校验：检查剔除了 [xxx] 后，剩下的是否全是常规 Emoji 符号
  const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2000}-\u{3299}]+$/u
  const hit = emojiRegex.test(remain)
  return {
    hit,
    reason: 'pure_emoji',
    confidence: hit ? 0.99 : 0
  }
}

/**
 * 原子规则 4：判断是否纯标点符号/特殊符号
 */
export function checkPureSymbol(text) {
  const noSpace = text.replace(/\s/g, '')
  if (!noSpace) return { hit: false }
  
  // 如果剥离空格后完全不包含中文字符、英文字母及阿拉伯数字，则认为是纯符号
  const nonSymbolRegex = /[\u4e00-\u9fa5a-zA-Z0-9]/
  const hit = !nonSymbolRegex.test(noSpace)
  return {
    hit,
    reason: 'pure_symbol',
    confidence: hit ? 0.98 : 0
  }
}

/**
 * 原子规则 5：判断是否纯网址链接
 */
export function checkLinkOnly(text) {
  const noSpace = text.replace(/\s/g, '')
  if (!noSpace) return { hit: false }
  
  if (/[\u4e00-\u9fa5]/.test(noSpace)) {
    return { hit: false }
  }
  
  let isUrl = false
  try {
    let testStr = noSpace
    if (!/^https?:\/\//i.test(testStr)) {
      testStr = 'http://' + testStr
    }
    const parsed = new URL(testStr)
    // 必须包含点号，且必须包含英文字母（防范纯数字如 666 在浏览器中被解析为 IP 包含点号），且不含汉字
    isUrl = parsed.hostname.includes('.') && /[a-zA-Z]/.test(parsed.hostname) && !/[\u4e00-\u9fa5]/.test(parsed.hostname)
  } catch (e) {
    isUrl = false
  }
  
  return {
    hit: isUrl,
    reason: 'link_only',
    confidence: isUrl ? 0.99 : 0
  }
}

/**
 * 原子规则 6：判断纯话题标签（#话题#）
 */
export function checkTopicOnly(text, ratioThreshold = 0.8) {
  const noSpace = text.replace(/\s/g, '')
  if (!noSpace) return { hit: false }
  
  const topicRegex = /#[^#]+#/g
  const matches = noSpace.match(topicRegex)
  const topicLength = matches ? matches.reduce((acc, m) => acc + m.length, 0) : 0
  const ratio = topicLength / noSpace.length
  
  return {
    hit: ratio > ratioThreshold,
    reason: 'topic_only',
    confidence: ratio > ratioThreshold ? parseFloat(ratio.toFixed(2)) : 0
  }
}

/**
 * 原子规则 7：短无意义高频词判定
 */
export function checkShortMeaningless(text, phrases = []) {
  if (phrases.length === 0) {
    phrases = ['好', '顶', '赞', '666', '支持', '牛', '哈哈', '笑死', '打卡']
  }
  
  // 移除所有标点符号与空格后进行精确匹配
  const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
  const hit = phrases.includes(cleaned)
  return {
    hit,
    reason: 'short_meaningless',
    confidence: hit ? 0.98 : 0
  }
}

/**
 * 原子规则 8：疑似引流广告检测 (包含广告词，或引流词+链接组合)
 */
export function checkAdLinkPattern(text, keywords = []) {
  if (keywords.length === 0) {
    keywords = ['加微信', '私信', '领取', '优惠', '下单', '代理', '链接', '看主页', '找我']
  }
  const hasKeyword = keywords.some(kw => text.includes(kw))
  // 采用极其安全的线性检测，查找 http://、https:// 或 www.，绝无回溯风险
  const hasUrl = /https?:\/\/[^\s]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(text)
  
  if (hasKeyword && hasUrl) {
    // 强特征：包含网址且含有营销字眼
    return { hit: true, reason: 'ad_link', confidence: 0.95 }
  } else if (hasKeyword) {
    // 弱特征：仅含有营销字眼，需标记为待确认
    return { hit: true, reason: 'suspect_ad', confidence: 0.70 }
  }
  return { hit: false }
}

/**
 * 原子规则 9：乱码检测 (根据非法/异形字符占比判定)
 */
export function checkGarbledText(text, threshold = 0.4) {
  const total = text.length
  if (total < 4) return { hit: false } // 太短的文本不做乱码判定以防误杀
  
  // 常规合规文本字符库：包含中日韩汉字、英文大小写、阿拉伯数字、常见标点以及常用 Emoji
  const normalPattern = /[\u4e00-\u9fa5a-zA-Z0-9\s,\.\?!"'。，？！“”‘’~@#&*\(\)\[\]\{\}\p{Emoji}]/gu
  const matches = text.match(normalPattern)
  const normalCount = matches ? matches.length : 0
  const ratio = 1 - (normalCount / total)
  
  return {
    hit: ratio > threshold,
    reason: 'suspect_garbled',
    confidence: parseFloat(ratio.toFixed(2))
  }
}

/**
 * 自定义筛选规则评估
 */
export function evaluateCustomFilter(filter, row, normText, sourceColIdx, ctx = {}) {
  const c = filter.config || {}
  // 取目标列的文本：config.column 为 undefined 或 -1 时回退到 sourceColIdx
  const targetCol = (c.column != null && c.column >= 0) ? c.column : sourceColIdx
  const cellText = targetCol === sourceColIdx
    ? normText
    : (row[targetCol] != null ? String(row[targetCol]).trim() : '')

  switch (filter.type) {
    case 'textContains': {
      const kws = c.keywords || []
      if (!kws.length) return { hit: false }
      const text = c.caseSensitive ? cellText : cellText.toLowerCase()
      const result = c.matchAll
        ? kws.map(k => c.caseSensitive ? k : k.toLowerCase()).every(k => text.includes(k))
        : kws.map(k => c.caseSensitive ? k : k.toLowerCase()).some(k => text.includes(k))
      return { hit: result, reason: `包含关键词: ${kws.join(', ')}`, confidence: 0.95 }
    }
    case 'textNotContains': {
      const kws = c.keywords || []
      if (!kws.length) return { hit: false }
      const text = c.caseSensitive ? cellText : cellText.toLowerCase()
      const anyHit = kws.map(k => c.caseSensitive ? k : k.toLowerCase()).some(k => text.includes(k))
      const result = c.matchAll
        ? kws.map(k => c.caseSensitive ? k : k.toLowerCase()).every(k => text.includes(k))
        : anyHit
      return { hit: !result, reason: `不包含关键词: ${kws.join(', ')}`, confidence: 0.90 }
    }
    case 'textEquals': {
      const val = String(c.value ?? '')
      const text = c.caseSensitive ? cellText : cellText.toLowerCase()
      const target = c.caseSensitive ? val : val.toLowerCase()
      return { hit: text === target, reason: `文本等于: ${val}`, confidence: 0.99 }
    }
    case 'regexMatch': {
      if (!c.pattern) return { hit: false }
      try {
        const re = new RegExp(c.pattern)
        return { hit: re.test(cellText), reason: `正则匹配: ${c.pattern}`, confidence: 0.90 }
      } catch { return { hit: false } }
    }
    case 'textLength': {
      const len = cellText.length
      const v = c.value || 0
      const ops = { lt: len < v, gt: len > v, eq: len === v, lte: len <= v, gte: len >= v }
      const opLabels = { lt: '<', gt: '>', eq: '=', lte: '<=', gte: '>=' }
      const hit = ops[c.operator] || false
      return { hit, reason: `文本长度 ${opLabels[c.operator] || '?'} ${v}`, confidence: 0.95 }
    }
    case 'columnEquals': {
      const cellVal = row[c.column] != null ? String(row[c.column]).trim() : ''
      if (Array.isArray(c.values) && c.values.length > 0) {
        const hit = c.values.some(v => cellVal === String(v))
        return { hit, reason: `列[${c.column}]匹配: ${c.values.join('/')}`, confidence: 0.99 }
      }
      return { hit: cellVal === String(c.value ?? ''), reason: `列[${c.column}]等于: ${c.value}`, confidence: 0.99 }
    }
    case 'columnGt': {
      const num = parseFloat(row[c.column])
      return { hit: !isNaN(num) && num > (c.value || 0), reason: `列[${c.column}]大于 ${c.value}`, confidence: 0.95 }
    }
    case 'columnLt': {
      const num = parseFloat(row[c.column])
      return { hit: !isNaN(num) && num < (c.value || 0), reason: `列[${c.column}]小于 ${c.value}`, confidence: 0.95 }
    }
    case 'labelColumnEquals': {
      const lr = ctx?.labelingResults
      if (!lr?.analysisMap) return { hit: false }
      const rowLabel = lr.analysisMap[ctx.rowIdx]
      const val = rowLabel?.values?.[c.outputKey]
      const actual = Array.isArray(val) ? val.join(',') : (val != null ? String(val) : '')
      if (Array.isArray(c.values) && c.values.length > 0) {
        const hit = c.values.some(v => String(v) === actual)
        return { hit, reason: `AI标签[${c.outputKey}]∈${c.values.join('/')}`, confidence: 0.99 }
      }
      return { hit: actual === String(c.value ?? ''), reason: `AI标签[${c.outputKey}]=${c.value}`, confidence: 0.99 }
    }
    default:
      return { hit: false }
  }
}

/**
 * 数据清洗 Pipeline 主控制中心
 */
export function runCleaningPipeline(rows, headers, sourceColIdx, rulesConfig, labelingResults = null) {
  // 1. 文本标准化
  const normalizedTexts = rows.map(row => {
    const val = row[sourceColIdx]
    return normalizeText(val)
  })
  
  // 2. 全表数据频次统计与首次出现索引构建，辅助去重
  const textFreq = Object.create(null)
  const firstIndices = Object.create(null)
  normalizedTexts.forEach((t, idx) => {
    textFreq[t] = (textFreq[t] || 0) + 1
    if (firstIndices[t] === undefined) {
      firstIndices[t] = idx
    }
  })
  
  // 3. 管道判定逻辑
  return rows.map((row, idx) => {
    const originalText = row[sourceColIdx] != null ? String(row[sourceColIdx]) : ''
    const normText = normalizedTexts[idx]
    
    let decision = 'keep' // keep (保留), delete (强删), suspect (待确认)
    let hitRule = '-'
    let confidence = 1.0
    let reasonText = ''
    
    // 一、强删规则组判定
    
    // 1. 空文本判定
    if (rulesConfig.empty?.enable) {
      const res = checkIsEmpty(normText)
      if (res.hit) {
        decision = 'delete'
        hitRule = 'empty_text'
        confidence = res.confidence
        reasonText = '空文本'
      }
    }
    
    // 1.5. 字数过短判定
    if (decision === 'keep' && rulesConfig.tooShort?.enable) {
      const minLength = rulesConfig.tooShort.minLength != null ? rulesConfig.tooShort.minLength : 2
      const res = checkTooShort(normText, minLength)
      if (res.hit) {
        decision = 'delete'
        hitRule = 'text_too_short'
        confidence = res.confidence
        reasonText = `有效字数少于 ${minLength} 个字`
      }
    }
    
    // 2. 精确重复判定
    if (decision === 'keep' && rulesConfig.duplicate?.enable) {
      const minCount = rulesConfig.duplicate.minCount || 3
      const res = checkDuplicate(normText, idx, textFreq, firstIndices, minCount)
      if (res.hit) {
        decision = 'delete'
        hitRule = 'exact_duplicate'
        confidence = res.confidence
        reasonText = `精确重复出现第 ${textFreq[normText]} 次 (阈值:${minCount})`
      }
    }
    
    // 3. 纯网址链接
    if (decision === 'keep' && rulesConfig.linkOnly?.enable) {
      const res = checkLinkOnly(normText)
      if (res.hit) {
        decision = 'delete'
        hitRule = 'link_only'
        confidence = res.confidence
        reasonText = '纯网址链接'
      }
    }
    
    // 4. 纯表情符号
    if (decision === 'keep' && rulesConfig.pureEmoji?.enable) {
      const res = checkPureEmoji(normText)
      if (res.hit) {
        decision = 'delete'
        hitRule = 'pure_emoji'
        confidence = res.confidence
        reasonText = '纯表情符号'
      }
    }
    
    // 5. 纯标点符号
    if (decision === 'keep' && rulesConfig.pureSymbol?.enable) {
      const res = checkPureSymbol(normText)
      if (res.hit) {
        decision = 'delete'
        hitRule = 'pure_symbol'
        confidence = res.confidence
        reasonText = '纯标点/符号'
      }
    }
    
    // 6. 纯话题标签
    if (decision === 'keep' && rulesConfig.topicOnly?.enable) {
      const ratioThreshold = rulesConfig.topicOnly.ratioThreshold || 0.8
      const res = checkTopicOnly(normText, ratioThreshold)
      if (res.hit) {
        decision = 'delete'
        hitRule = 'topic_only'
        confidence = res.confidence
        reasonText = `纯话题标签占比超 ${Math.round(ratioThreshold * 100)}%`
      }
    }
    
    // 7. 短无意义高频词
    if (decision === 'keep' && rulesConfig.shortMeaningless?.enable) {
      const phrases = rulesConfig.shortMeaningless.phrases || []
      const res = checkShortMeaningless(normText, phrases)
      if (res.hit) {
        decision = 'delete'
        hitRule = 'short_meaningless'
        confidence = res.confidence
        reasonText = '短无意义高频词'
      }
    }
    
    // 二、弱删规则组判定 (依据策略进行标记或删除)
    
    // 8. 疑似引流广告检测
    if (decision === 'keep' && rulesConfig.adLink?.enable) {
      const keywords = rulesConfig.adLink.keywords || []
      const res = checkAdLinkPattern(normText, keywords)
      if (res.hit) {
        const policy = rulesConfig.weakPolicy || 'mark' // mark(标记), delete(删除)
        if (res.reason === 'ad_link') {
          // 引流词+链接同时具备，属于强广告直接删除
          decision = 'delete'
          hitRule = 'ad_link'
          confidence = res.confidence
          reasonText = '引流广告且包含网址'
        } else if (policy === 'delete') {
          decision = 'delete'
          hitRule = 'suspect_ad'
          confidence = res.confidence
          reasonText = '疑似引流广告 (策略强删)'
        } else {
          decision = 'suspect'
          hitRule = 'suspect_ad'
          confidence = res.confidence
          reasonText = '疑似引流广告'
        }
      }
    }
    
    // 9. 疑似乱码判定
    if (decision === 'keep' && rulesConfig.garbledText?.enable) {
      const threshold = rulesConfig.garbledText.threshold || 0.4
      const res = checkGarbledText(normText, threshold)
      if (res.hit) {
        const policy = rulesConfig.weakPolicy || 'mark'
        if (policy === 'delete') {
          decision = 'delete'
          hitRule = 'suspect_garbled'
          confidence = res.confidence
          reasonText = `疑似乱码 (策略强删, 乱码率:${Math.round(res.confidence * 100)}%)`
        } else {
          decision = 'suspect'
          hitRule = 'suspect_garbled'
          confidence = res.confidence
          reasonText = `疑似乱码 (乱码率:${Math.round(res.confidence * 100)}%)`
        }
      }
    }

    // 三、自定义过滤规则组判定
    if (decision === 'keep' && rulesConfig.customFilters?.length) {
      for (const filter of rulesConfig.customFilters) {
        if (!filter.enabled) continue
        const res = evaluateCustomFilter(filter, row, normText, sourceColIdx, { labelingResults, rowIdx: idx })
        if (res.hit) {
          decision = filter.policy === 'delete' ? 'delete' : 'suspect'
          hitRule = 'custom:' + filter.name
          confidence = res.confidence
          reasonText = res.reason
          break
        }
      }
    }

    return {
      originalRow: row,
      originalText,
      normalizedText: normText,
      decision,
      hitRule,
      confidence,
      reason: reasonText || '-'
    }
  })
}
