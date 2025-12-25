import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import type { QuestionItem } from '../types'

export interface WrongQuestion {
  id: string
  user_id: string
  question_id: string
  paper_id: string | null
  user_answer: string | null
  wrong_count: number
  last_wrong_at: string
  is_mastered: boolean
  created_at: string
  updated_at: string
  question?: QuestionItem
}

export interface WrongQuestionFilter {
  subject?: string
  grade?: string
  type?: string
  is_mastered?: boolean
}

// 获取错题列表
export async function getWrongQuestions(filter: WrongQuestionFilter = {}): Promise<WrongQuestion[]> {
  if (!isSupabaseReady) {
    return []
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return []
  }

  let query = supabase
    .from('wrong_questions')
    .select(`
      *,
      question:questions(*)
    `)
    .eq('user_id', user.id)
    .order('last_wrong_at', { ascending: false })

  if (filter.is_mastered !== undefined) {
    query = query.eq('is_mastered', filter.is_mastered)
  }

  const { data, error } = await query

  if (error) {
    console.warn('获取错题列表失败', error.message)
    return []
  }

  // 过滤题目
  let wrongQuestions = (data || []) as any[]
  
  if (filter.subject) {
    wrongQuestions = wrongQuestions.filter((wq) => wq.question?.subject === filter.subject)
  }
  if (filter.grade) {
    wrongQuestions = wrongQuestions.filter((wq) => wq.question?.grade === filter.grade)
  }
  if (filter.type) {
    wrongQuestions = wrongQuestions.filter((wq) => wq.question?.type === filter.type)
  }

  return wrongQuestions.map((wq) => ({
    ...wq,
    question: wq.question as QuestionItem,
  }))
}

// 添加错题（如果已存在则更新错误次数）
export async function addWrongQuestion(
  questionId: string,
  paperId: string | null,
  userAnswer: string | null,
): Promise<void> {
  if (!isSupabaseReady) {
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return
  }

  // 检查是否已存在
  const { data: existing } = await supabase
    .from('wrong_questions')
    .select('id, wrong_count')
    .eq('user_id', user.id)
    .eq('question_id', questionId)
    .maybeSingle()

  if (existing) {
    // 更新错误次数
    await supabase
      .from('wrong_questions')
      .update({
        wrong_count: existing.wrong_count + 1,
        last_wrong_at: new Date().toISOString(),
        user_answer: userAnswer,
        paper_id: paperId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    // 新增错题
    await supabase.from('wrong_questions').insert({
      user_id: user.id,
      question_id: questionId,
      paper_id: paperId,
      user_answer: userAnswer,
      wrong_count: 1,
      last_wrong_at: new Date().toISOString(),
      is_mastered: false,
    })
  }
}

// 标记为已掌握/未掌握
export async function toggleMastered(wrongQuestionId: string, isMastered: boolean): Promise<void> {
  if (!isSupabaseReady) {
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('未登录')
  }

  const { error } = await supabase
    .from('wrong_questions')
    .update({
      is_mastered: isMastered,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wrongQuestionId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(error.message)
  }
}

// 删除错题
export async function deleteWrongQuestion(wrongQuestionId: string): Promise<void> {
  if (!isSupabaseReady) {
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('未登录')
  }

  const { error } = await supabase
    .from('wrong_questions')
    .delete()
    .eq('id', wrongQuestionId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(error.message)
  }
}

// 获取错题统计
export async function getWrongQuestionStats() {
  if (!isSupabaseReady) {
    return {
      total: 0,
      mastered: 0,
      notMastered: 0,
      bySubject: {},
      byType: {},
    }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      total: 0,
      mastered: 0,
      notMastered: 0,
      bySubject: {},
      byType: {},
    }
  }

  const { data } = await supabase
    .from('wrong_questions')
    .select(`
      is_mastered,
      question:questions(subject, type)
    `)
    .eq('user_id', user.id)

  if (!data) {
    return {
      total: 0,
      mastered: 0,
      notMastered: 0,
      bySubject: {},
      byType: {},
    }
  }

  const stats = {
    total: data.length,
    mastered: data.filter((wq: any) => wq.is_mastered).length,
    notMastered: data.filter((wq: any) => !wq.is_mastered).length,
    bySubject: {} as Record<string, number>,
    byType: {} as Record<string, number>,
  }

  data.forEach((wq: any) => {
    const subject = wq.question?.subject || '未分类'
    const type = wq.question?.type || '未知'
    stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1
    stats.byType[type] = (stats.byType[type] || 0) + 1
  })

  return stats
}

