import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import type { QuestionItem, QuestionType, PaperWithQuestions, Answer } from '../types'

type RandomCriteria = {
  subject?: string
  grade?: string
  types?: QuestionType[]
  difficulty?: number
  limit?: number
}

export async function randomQuestions(criteria: RandomCriteria): Promise<QuestionItem[]> {
  if (!isSupabaseReady) {
    return []
  }

  const { data, error } = await supabase.rpc('fn_random_questions', {
    p_subject: criteria.subject || null,
    p_grade: criteria.grade || null,
    p_types: criteria.types?.length ? criteria.types : null,
    p_difficulty: criteria.difficulty || null,
    p_limit: criteria.limit || 10,
  })

  if (error) {
    console.warn('RPC 抽题失败', error.message)
    return []
  }

  return (data as QuestionItem[]) ?? []
}

type CreatePaperInput = {
  title: string
  subject?: string
  grade?: string
  durationMinutes: number
  questions: QuestionItem[]
  startTime?: string
  endTime?: string
  parentPaperId?: string // 父试卷ID（用于版本管理）
}

export async function createPaperWithQuestions(input: CreatePaperInput) {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法创建试卷')
  }

  const totalScore = input.questions.length
  
  // 如果是创建新版本，获取父试卷的版本号
  let version = 1
  if (input.parentPaperId) {
    const { data: parentPaper } = await supabase
      .from('papers')
      .select('version')
      .eq('id', input.parentPaperId)
      .maybeSingle()
    version = (parentPaper?.version || 0) + 1
  }
  
  const { data: paperData, error: paperError } = await supabase
    .from('papers')
    .insert({
      title: input.title,
      subject: input.subject,
      grade: input.grade,
      duration_minutes: input.durationMinutes,
      mode: 'random',
      total_score: totalScore,
      published: false,
      start_time: input.startTime ? new Date(input.startTime).toISOString() : null,
      end_time: input.endTime ? new Date(input.endTime).toISOString() : null,
      parent_paper_id: input.parentPaperId || null,
      version: version,
    })
    .select('id')
    .maybeSingle()

  if (paperError || !paperData?.id) {
    throw new Error(paperError?.message || '创建试卷失败')
  }

  const paperId = paperData.id as string
  const payload = input.questions.map((q, idx) => ({
    paper_id: paperId,
    question_id: q.id,
    order_no: idx + 1,
    score: 1,
  }))

  const { error: pqError } = await supabase.from('paper_questions').insert(payload)
  if (pqError) {
    throw new Error(pqError.message)
  }

  return paperId
}

// 手动组卷：直接指定题目与分数
export async function createPaperManual(input: {
  title: string
  subject?: string
  grade?: string
  durationMinutes: number
  selections: { question_id: string; score: number }[]
  startTime?: string
  endTime?: string
  parentPaperId?: string // 父试卷ID（用于版本管理）
}) {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置，无法创建试卷')
  }

  const totalScore = input.selections.reduce((sum, s) => sum + (s.score || 0), 0)

  // 如果是创建新版本，获取父试卷的版本号
  let version = 1
  if (input.parentPaperId) {
    const { data: parentPaper } = await supabase
      .from('papers')
      .select('version')
      .eq('id', input.parentPaperId)
      .maybeSingle()
    version = (parentPaper?.version || 0) + 1
  }

  const { data: paperData, error: paperError } = await supabase
    .from('papers')
    .insert({
      title: input.title,
      subject: input.subject,
      grade: input.grade,
      duration_minutes: input.durationMinutes,
      mode: 'manual',
      total_score: totalScore,
      published: false,
      start_time: input.startTime ? new Date(input.startTime).toISOString() : null,
      end_time: input.endTime ? new Date(input.endTime).toISOString() : null,
      parent_paper_id: input.parentPaperId || null,
      version: version,
    })
    .select('id')
    .maybeSingle()

  if (paperError || !paperData?.id) {
    throw new Error(paperError?.message || '创建试卷失败')
  }

  const paperId = paperData.id as string
  const payload = input.selections.map((s, idx) => ({
    paper_id: paperId,
    question_id: s.question_id,
    order_no: idx + 1,
    score: s.score || 0,
  }))

  const { error: pqError } = await supabase.from('paper_questions').insert(payload)
  if (pqError) {
    throw new Error(pqError.message)
  }

  return paperId
}

// 获取试卷详情（包含题目）
export async function getPaperWithQuestions(paperId: string): Promise<PaperWithQuestions | null> {
  if (!isSupabaseReady) {
    return null
  }

  // 获取试卷基本信息
  const { data: paper, error: paperError } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .single()

  if (paperError || !paper) {
    console.warn('获取试卷失败', paperError?.message)
    return null
  }

  // 获取试卷题目关联
  const { data: paperQuestions, error: pqError } = await supabase
    .from('paper_questions')
    .select('*, questions(*)')
    .eq('paper_id', paperId)
    .order('order_no', { ascending: true })

  if (pqError || !paperQuestions) {
    console.warn('获取题目失败', pqError?.message)
    return null
  }

  // 组装数据
  const questions = paperQuestions.map((pq: any) => ({
    id: pq.id,
    paper_id: pq.paper_id,
    question_id: pq.question_id,
    order_no: pq.order_no,
    score: pq.score,
    question: pq.questions as QuestionItem,
  }))

  return {
    ...paper,
    questions,
  } as PaperWithQuestions
}

// 提交答案并自动批改
export async function submitAnswers(paperId: string, answers: Record<string, string[] | string>) {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('未登录')
  }

  // 获取试卷题目以进行批改
  const paper = await getPaperWithQuestions(paperId)
  if (!paper) {
    throw new Error('试卷不存在')
  }

  const now = new Date().toISOString()
  const answerRecords: any[] = []

  // 处理每道题目的答案
  for (const pq of paper.questions) {
    const chosen = answers[pq.question_id] || null
    const question = pq.question

    // 判断是否正确（仅客观题）
    let isCorrect: boolean | null = null
    let score = 0
    let status: 'auto' | 'pending' = 'auto'

    if (question.type === 'single' || question.type === 'multiple' || question.type === 'true_false') {
      // 选择题和判断题：完全匹配
      const correctAnswers = question.answer.sort()
      const userAnswers = Array.isArray(chosen) ? chosen.sort() : []
      isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(userAnswers)
      score = isCorrect ? pq.score : 0
    } else if (question.type === 'fill') {
      // 填空题：使用模糊匹配（支持同义词、相近词）
      const { fuzzyMatchArray } = await import('../lib/fuzzyMatch')
      const correctAnswers = question.answer.map((a) => String(a))
      const userAnswers = Array.isArray(chosen)
        ? chosen.map((a) => String(a))
        : []
      isCorrect = fuzzyMatchArray(userAnswers, correctAnswers, 0.8)
      score = isCorrect ? pq.score : 0
    } else if (question.type === 'short') {
      // 简答题：标记为待批阅
      status = 'pending'
      score = 0
    }

    answerRecords.push({
      user_id: user.id,
      paper_id: paperId,
      question_id: question.id,
      chosen: chosen ? (Array.isArray(chosen) ? chosen : [chosen]) : null,
      is_correct: isCorrect,
      score,
      status,
      submitted_at: now,
    })
  }

  // 批量插入答案（使用 upsert 避免重复）
  const { error: insertError } = await supabase.from('answers').upsert(answerRecords, {
    onConflict: 'user_id,paper_id,question_id',
  })

  if (insertError) {
    throw new Error(`提交答案失败: ${insertError.message}`)
  }

  // 自动添加错题到错题本
  try {
    const { addWrongQuestion } = await import('./wrongQuestions')
    for (const pq of paper.questions) {
      const answerRecord = answerRecords.find((a) => a.question_id === pq.question.id)
      if (answerRecord && answerRecord.is_correct === false) {
        const userAnswer = answerRecord.chosen
          ? Array.isArray(answerRecord.chosen)
            ? answerRecord.chosen.join(', ')
            : String(answerRecord.chosen)
          : null
        await addWrongQuestion(pq.question.id, paperId, userAnswer)
      }
    }
  } catch (err) {
    // 错题本添加失败不影响答案提交
    console.warn('添加错题到错题本失败', err)
  }

  // 发送成绩发布通知（如果试卷允许查看解析）
  try {
    if (paper.allow_review) {
      const { notifyGradePublished } = await import('../lib/notificationService')
      await notifyGradePublished(paperId, paper.title, user.id)
    }
  } catch (err) {
    console.warn('发送通知失败', err)
  }

  return { success: true, count: answerRecords.length }
}

// 获取用户成绩
export async function getExamResult(paperId: string, userId?: string): Promise<{
  paper: PaperWithQuestions | null
  answers: Answer[]
  totalScore: number
  userScore: number
  correctRate: number
} | null> {
  if (!isSupabaseReady) {
    return null
  }

  const { data: { user } } = await supabase.auth.getUser()
  const targetUserId = userId || user?.id
  if (!targetUserId) {
    return null
  }

  // 获取试卷
  const paper = await getPaperWithQuestions(paperId)
  if (!paper) {
    return null
  }

  // 获取答案
  const { data: answers, error: answersError } = await supabase
    .from('answers')
    .select('*')
    .eq('paper_id', paperId)
    .eq('user_id', targetUserId)

  if (answersError) {
    console.warn('获取答案失败', answersError.message)
    return null
  }

  // 计算分数
  const totalScore = paper.total_score
  const userScore = answers.reduce((sum, a) => sum + (a.score || 0) + (a.manual_score || 0), 0)
  const correctCount = answers.filter((a) => a.is_correct === true).length
  const correctRate = answers.length > 0 ? correctCount / answers.length : 0

  return {
    paper,
    answers: answers as Answer[],
    totalScore,
    userScore,
    correctRate,
  }
}

// 保存草稿到 Supabase
export async function saveDraft(paperId: string, answers: Record<string, string[] | string>) {
  if (!isSupabaseReady) {
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return
  }

  await supabase.from('answers_draft').upsert(
    {
      user_id: user.id,
      paper_id: paperId,
      payload: answers,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,paper_id',
    }
  )
}

// 加载草稿
export async function loadDraft(paperId: string): Promise<Record<string, string[] | string> | null> {
  if (!isSupabaseReady) {
    return null
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('answers_draft')
    .select('payload')
    .eq('user_id', user.id)
    .eq('paper_id', paperId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.payload as Record<string, string[] | string>
}


