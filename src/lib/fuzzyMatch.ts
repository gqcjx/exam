// 填空题模糊匹配工具函数

/**
 * 标准化答案文本（去除空格、标点、转换为小写）
 */
function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.,，。、；;：:！!？?（）()【】\[\]""''《》<>]/g, '')
}

/**
 * 计算两个字符串的相似度（Levenshtein距离）
 */
function similarity(str1: string, str2: string): number {
  const s1 = normalizeAnswer(str1)
  const s2 = normalizeAnswer(str2)
  
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0

  const len1 = s1.length
  const len2 = s2.length
  const matrix: number[][] = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  const distance = matrix[len1][len2]
  const maxLen = Math.max(len1, len2)
  return 1 - distance / maxLen
}

/**
 * 常见同义词映射（可根据需要扩展）
 */
const synonymMap: Record<string, string[]> = {
  // 城市名称
  北京: ['北京市', '首都', '京城'],
  上海: ['上海市', '申城'],
  广州: ['广州市', '羊城'],
  深圳: ['深圳市'],
  
  // 常见词汇
  正确: ['对', '是的', '是', '对的'],
  错误: ['错', '不对', '否', '错的'],
  是: ['对', '正确', '是的'],
  否: ['不对', '错误', '错的'],
  
  // 数字
  一: ['1', '壹'],
  二: ['2', '贰'],
  三: ['3', '叁'],
  四: ['4', '肆'],
  五: ['5', '伍'],
  六: ['6', '陆'],
  七: ['7', '柒'],
  八: ['8', '捌'],
  九: ['9', '玖'],
  十: ['10', '拾'],
}

/**
 * 获取同义词列表
 */
function getSynonyms(text: string): string[] {
  const normalized = normalizeAnswer(text)
  const synonyms: string[] = [normalized]
  
  // 查找同义词映射
  for (const [key, values] of Object.entries(synonymMap)) {
    if (normalizeAnswer(key) === normalized) {
      values.forEach((v) => synonyms.push(normalizeAnswer(v)))
    }
    values.forEach((v) => {
      if (normalizeAnswer(v) === normalized) {
        synonyms.push(normalizeAnswer(key))
        values.forEach((v2) => synonyms.push(normalizeAnswer(v2)))
      }
    })
  }
  
  return [...new Set(synonyms)]
}

/**
 * 检查用户答案是否匹配标准答案（支持模糊匹配）
 * @param userAnswer 用户答案
 * @param correctAnswer 标准答案
 * @param threshold 相似度阈值（0-1），默认0.8
 * @returns 是否匹配
 */
export function fuzzyMatch(
  userAnswer: string,
  correctAnswer: string,
  threshold: number = 0.8,
): boolean {
  // 完全匹配
  if (normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)) {
    return true
  }

  // 包含匹配（如"北京"匹配"北京市"）
  const normalizedUser = normalizeAnswer(userAnswer)
  const normalizedCorrect = normalizeAnswer(correctAnswer)
  
  if (normalizedCorrect.includes(normalizedUser) || normalizedUser.includes(normalizedCorrect)) {
    return true
  }

  // 同义词匹配
  const userSynonyms = getSynonyms(userAnswer)
  const correctSynonyms = getSynonyms(correctAnswer)
  
  for (const userSyn of userSynonyms) {
    for (const correctSyn of correctSynonyms) {
      if (userSyn === correctSyn) {
        return true
      }
    }
  }

  // 相似度匹配
  const sim = similarity(userAnswer, correctAnswer)
  return sim >= threshold
}

/**
 * 批量匹配填空题答案
 * @param userAnswers 用户答案数组
 * @param correctAnswers 标准答案数组
 * @param threshold 相似度阈值
 * @returns 是否全部匹配
 */
export function fuzzyMatchArray(
  userAnswers: string[],
  correctAnswers: string[],
  threshold: number = 0.8,
): boolean {
  if (userAnswers.length !== correctAnswers.length) {
    return false
  }

  return userAnswers.every((userAns, idx) => {
    const correctAns = correctAnswers[idx]
    return fuzzyMatch(userAns, correctAns, threshold)
  })
}

