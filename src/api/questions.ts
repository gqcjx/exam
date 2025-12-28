import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import type { QuestionItem, QuestionsFilter, QuestionType } from '../types'
import {
  parseCsv,
  parseWordDocument,
  normalizeQuestion,
  getCurrentSemester,
  getRandomDifficulty
} from '../utils/parser'

const mockQuestions: QuestionItem[] = [
  {
    id: 'mock-1',
    subject: '数学',
    grade: '七年级',
    difficulty: 2,
    type: 'single',
    stem: '下列哪一项是质数？',
    options: [
      { label: 'A', text: '21' },
      { label: 'B', text: '23' },
      { label: 'C', text: '25' },
      { label: 'D', text: '27' },
    ],
    answer: ['B'],
    analysis: '23 是质数，其余可分解质因数。',
    tags: ['数论'],
  },
  {
    id: 'mock-2',
    subject: '数学',
    grade: '七年级',
    difficulty: 3,
    type: 'multiple',
    stem: '关于等腰三角形，哪些说法正确？',
    options: [
      { label: 'A', text: '两腰相等' },
      { label: 'B', text: '顶角平分线垂直平分底边' },
      { label: 'C', text: '底角相等' },
      { label: 'D', text: '三边都相等' },
    ],
    answer: ['A', 'B', 'C'],
    analysis: '等腰仅两腰相等，顶角平分线垂直平分底边。',
    tags: ['几何'],
  },
  {
    id: 'mock-3',
    subject: '科学',
    grade: '七年级',
    difficulty: 1,
    type: 'true_false',
    stem: '地球绕太阳公转一周约 365.24 天。',
    answer: ['T'],
    analysis: '恒星年约 365.256 日，近似 365.24 天。',
    tags: ['天文'],
  },
]

export async function listQuestions(filter: QuestionsFilter = {}): Promise<QuestionItem[]> {
  if (!isSupabaseReady) {
    return mockQuestions
  }

  let query = supabase.from('questions').select(`
    id, subject, grade, semester, textbook_version, difficulty, type, stem, options, answer, analysis, tags, created_by
  `)

  if (filter.subject) query = query.eq('subject', filter.subject)
  if (filter.grade) query = query.eq('grade', filter.grade)
  if (filter.type) query = query.eq('type', filter.type)
  if (filter.difficulty) query = query.eq('difficulty', filter.difficulty)
  if (filter.search) query = query.ilike('stem', `%${filter.search}%`)

  const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
  if (error) {
    console.warn('获取题库失败，返回示例数据', error.message)
    return mockQuestions
  }
  return (data as QuestionItem[]) ?? []
}

// 已将解析函数移动到 ../utils/parser.ts

export async function importQuestionsFromFile(file: File) {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法导入题库')
  }

  // 检查用户是否已登录
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('请先登录后再导入题库')
  }

  const ext = file.name.toLowerCase()
  let payload: unknown

  // 支持 JSON / CSV / Word
  if (ext.endsWith('.json')) {
    const text = await file.text()
    try {
      payload = JSON.parse(text)
    } catch (e) {
      throw new Error('JSON 文件格式错误')
    }
  } else if (ext.endsWith('.csv')) {
    const text = await file.text()
    const rows = parseCsv(text)
    // 将 CSV 行转换为 Edge Function 所需的题目结构
    payload = rows.map((row) => normalizeQuestion({
      subject: row.subject,
      grade: row.grade,
      type: row.type as QuestionType,
      stem: row.stem,
      options: row.options
        ? row.options.split('|').map((opt, idx) => ({
          label: String.fromCharCode(65 + idx),
          text: opt.trim(),
        }))
        : null,
      answer: row.answer ? row.answer.split('|').map((a) => a.trim()) : [],
      analysis: row.analysis,
      difficulty: row.difficulty ? Number(row.difficulty) : undefined,
      tags: row.tags ? row.tags.split('|').map((t) => t.trim()) : [],
    }))
  } else if (ext.endsWith('.docx') || ext.endsWith('.doc')) {
    // 解析 Word 文档
    try {
      payload = await parseWordDocument(file)
    } catch (e: any) {
      throw new Error(e?.message || 'Word 文档解析失败')
    }
  } else {
    throw new Error('仅支持 JSON、CSV 或 Word (.docx) 文件')
  }

  // 确保 payload 是数组
  if (!Array.isArray(payload)) {
    payload = Array.isArray((payload as any)?.questions) ? (payload as any).questions : [payload]
  }

  // 调用 Edge Function，Supabase 客户端会自动包含认证 token
  const { data, error } = await supabase.functions.invoke('import-questions', {
    body: payload as any,
  })

  if (error) {
    // 如果是 401 错误，提供更友好的提示
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      throw new Error('认证失败，请重新登录后再试')
    }
    throw new Error(error.message || '导入失败')
  }

  return data
}

export async function createQuestion(question: {
  subject: string
  grade?: string | null
  semester?: string | null
  textbook_version?: string | null
  type: QuestionType
  stem: string
  options?: Array<{ label: string; text: string }> | null
  answer: string[]
  analysis?: string | null
  difficulty?: number
  tags?: string[]
}): Promise<QuestionItem> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法创建题目')
  }

  const { data, error } = await supabase
    .from('questions')
    .insert({
      subject: question.subject,
      grade: question.grade || null,
      semester: question.semester || null,
      textbook_version: question.textbook_version || null,
      type: question.type,
      stem: question.stem,
      options: question.options || null,
      answer: question.answer,
      analysis: question.analysis || null,
      difficulty: question.difficulty || 1,
      tags: question.tags || [],
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as QuestionItem
}

export async function updateQuestion(
  id: string,
  question: {
    subject?: string
    grade?: string | null
    semester?: string | null
    textbook_version?: string | null
    type?: QuestionType
    stem?: string
    options?: Array<{ label: string; text: string }> | null
    answer?: string[]
    analysis?: string | null
    difficulty?: number
    tags?: string[]
  },
): Promise<QuestionItem> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法更新题目')
  }

  const { data, error } = await supabase
    .from('questions')
    .update(question)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as QuestionItem
}

export async function deleteQuestion(id: string) {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法删除题目')
  }

  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteQuestions(ids: string[]) {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法批量删除题目')
  }

  if (ids.length === 0) {
    throw new Error('请选择要删除的题目')
  }

  const { error } = await supabase.from('questions').delete().in('id', ids)
  if (error) {
    throw new Error(error.message)
  }
}

// 批量更新题目
export async function batchUpdateQuestions(
  ids: string[],
  updates: {
    difficulty?: number
    subject?: string
    grade?: string
    semester?: string | null
    textbook_version?: string | null
    tags?: string[]
  },
): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法批量更新题目')
  }

  if (ids.length === 0) {
    throw new Error('请至少选择一个题目')
  }

  const updateData: any = {}
  if (updates.difficulty !== undefined) {
    updateData.difficulty = updates.difficulty
  }
  if (updates.subject !== undefined) {
    updateData.subject = updates.subject
  }
  if (updates.grade !== undefined) {
    updateData.grade = updates.grade
  }
  if (updates.semester !== undefined) {
    updateData.semester = updates.semester
  }
  if (updates.textbook_version !== undefined) {
    updateData.textbook_version = updates.textbook_version
  }
  if (updates.tags !== undefined) {
    updateData.tags = updates.tags
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('请至少选择一个要更新的字段')
  }

  const { error } = await supabase
    .from('questions')
    .update(updateData)
    .in('id', ids)

  if (error) {
    throw new Error(`批量更新失败: ${error.message}`)
  }
}


