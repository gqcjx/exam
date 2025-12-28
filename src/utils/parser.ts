import mammoth from 'mammoth'
import type { QuestionItem, QuestionType } from '../types'

/**
 * 根据系统时间推断当前学期
 */
export function getCurrentSemester(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  return month >= 9 || month <= 1 ? '上学期' : '下学期'
}

/**
 * 生成随机难度（1-5之间）
 */
export function getRandomDifficulty(): number {
  return Math.floor(Math.random() * 5) + 1
}

/**
 * 解析 CSV 内容
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('CSV 内容为空')
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows = lines.slice(1).map((line) => line.split(','))

  return rows.map((cols) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? ''
    })
    return obj
  })
}

/**
 * 规范化题目数据
 */
export function normalizeQuestion(q: any): Partial<QuestionItem> {
  let type: QuestionType = q.type || 'single'
  
  if (!q.options || q.options.length === 0) {
    if (type === 'true_false') {
      // 保持
    } else if (q.stem.includes('____') || q.stem.includes('______')) {
      type = 'fill'
    } else {
      type = 'short'
    }
  }

  const options = q.options && q.options.length > 0 
    ? q.options.map((opt: any, idx: number) => ({
        label: opt.label || String.fromCharCode(65 + idx),
        text: opt.text || '',
      }))
    : null

  return {
    subject: q.subject || '未分类',
    grade: q.grade || null,
    semester: q.semester || getCurrentSemester(),
    textbook_version: q.textbook_version || '人教版',
    type,
    stem: q.stem.trim(),
    options,
    answer: q.answer || [],
    analysis: q.analysis || null,
    difficulty: q.difficulty || getRandomDifficulty(),
    tags: q.tags || [],
  }
}

/**
 * 解析 Word 文档
 */
export async function parseWordDocument(file: File): Promise<any[]> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = result.value

  if (!text || text.trim().length === 0) {
    throw new Error('Word 文档内容为空')
  }

  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalizedText.split('\n')
  
  let globalSubject: string | null = null
  let globalGrade: string | null = null
  let globalSemester: string | null = null
  let globalTextbookVersion: string | null = null

  // 提取全局元数据
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim()
    const subjectMatch = line.match(/(?:学科|科目|课程)[：:]\s*(.+)/)
    if (subjectMatch && !globalSubject) globalSubject = subjectMatch[1].trim()
    
    const gradeMatch = line.match(/(?:年级|学段)[：:]\s*(.+)/)
    if (gradeMatch && !globalGrade) globalGrade = gradeMatch[1].trim()
    
    const semesterMatch = line.match(/(?:学期)[：:]\s*(上|下)学期/)
    if (semesterMatch && !globalSemester) globalSemester = semesterMatch[1] === '上' ? '上学期' : '下学期'
    
    const versionMatch = line.match(/(?:版本|教材版本|教材)[：:]\s*(.+?)(?:版|版本)?/)
    if (versionMatch && !globalTextbookVersion) {
      let version = versionMatch[1].trim()
      if (!version.endsWith('版')) version += '版'
      globalTextbookVersion = version
    }
  }

  const blocks = normalizedText.split(/(?=\n\s*\d+[\.、．）)]|^\d+[\.、．）)])/).filter((b) => b.trim())
  const questions: any[] = []

  for (const block of blocks) {
    if (!block.trim()) continue
    const titlePattern = /(?:^[一二三四五六七八九十]+[、\.]|大题|共\s*\d+\s*(?:小题|分)|本大题)/
    if (titlePattern.test(block.trim())) continue

    const ansDelim = /【?答案】?[:：\s]*/
    const anaDelim = /【?(?:解析|分析|解答|详解)】?[:：\s]*/

    let body = block
    let answerPart = ''
    let analysisPart = ''

    const ansMatch = block.match(ansDelim)
    if (ansMatch && ansMatch.index !== undefined) {
      body = block.substring(0, ansMatch.index)
      const rest = block.substring(ansMatch.index + ansMatch[0].length)
      const anaMatch = rest.match(anaDelim)
      if (anaMatch && anaMatch.index !== undefined) {
        answerPart = rest.substring(0, anaMatch.index)
        analysisPart = rest.substring(anaMatch.index + anaMatch[0].length)
      } else {
        answerPart = rest
      }
    }

    const firstOptIdx = body.search(/[A-H][\.．、\s]/)
    let stem = (firstOptIdx !== -1 ? body.substring(0, firstOptIdx) : body).trim()
    stem = stem.replace(/^\d+[\.、．）)]\s*/, '').replace(/^\[(?:单选|多选|判断|填空|简答|选择题|判断题|填空题|简答题)\]?\s*/, '').trim()

    if (!stem || titlePattern.test(stem)) continue

    const options: any[] = []
    if (firstOptIdx !== -1) {
      const optionsText = body.substring(firstOptIdx)
      const optRegex = /([A-H])[\.．、）:：\s]([\s\S]+?)(?=[A-H][\.．、）:：\s]|$)/g
      let m
      while ((m = optRegex.exec(optionsText)) !== null) {
        options.push({ label: m[1].toUpperCase(), text: m[2].trim() })
      }
    }

    let answer: string[] = []
    if (answerPart) {
      const letters = answerPart.match(/[A-H]/gi)
      answer = letters ? letters.map(l => l.toUpperCase()) : [answerPart.trim()]
    }

    const analysis = analysisPart.replace(/^【?(?:解析|分析|解答|详解)】?[:：\s]*/g, '').trim() || null

    questions.push(normalizeQuestion({
      stem,
      options,
      answer,
      analysis,
      subject: globalSubject,
      grade: globalGrade,
      semester: globalSemester,
      textbook_version: globalTextbookVersion
    }))
  }

  return questions
}
