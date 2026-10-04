// 产品页与界面截图共用的预设打标结果；不代表实际模型输出。
export const DEMO_OUTPUT_COLUMNS = [
  { key: 'sentiment', name: '情感倾向', type: 'enum', options: ['正向', '负向', '中性', '褒贬混合'], required: true },
  { key: 'topic', name: '反馈主题', type: 'text', required: true },
  { key: 'resolved', name: '售后已解决', type: 'boolean', required: true }
]

export const DEMO_LABELS = {
  R001: ['正向', '连接、续航', false],
  R002: ['正向', '噪声、稳定性', false],
  R003: ['正向', '保温、清洗', false],
  R004: ['褒贬混合', '音质、佩戴', false],
  R005: ['褒贬混合', '风量、噪声', false],
  R006: ['褒贬混合', '物流、包装', false],
  R007: ['负向', '故障、售后', false],
  R008: ['负向', '噪声、故障', false],
  R009: ['负向', '漏水、退货', false],
  R010: ['褒贬混合', '音质、做工', false],
  R011: ['正向', '续航、便携', false],
  R012: ['中性', '色差、保温', false],
  R013: ['负向', '通话、麦克风', false],
  R014: ['负向', '指示灯', false],
  R015: ['中性', '清洗、密封', false],
  R016: ['褒贬混合', '故障、售后', true],
  R017: ['正向', '易用性、性价比', false],
  R018: ['褒贬混合', '保温、重量', false],
  R019: ['负向', '续航', false],
  R020: ['中性', '物流、包装', false],
  R021: ['负向', '清洗', false],
  R022: ['褒贬混合', '佩戴、通话', false],
  R023: ['正向', '气味', false],
  R024: ['褒贬混合', '密封、售后', true]
}
