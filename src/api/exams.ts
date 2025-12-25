import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import type { QuestionItem, QuestionType } from '../types'

// 试卷基本信息
export type PaperInfo = {
  id: string
  title: string
  subject?: string | null
  grade?: string | null
  total_score: number
  duration_minutes: number
  published: boolean
  allow_review: boolean
  created_at: string
  start_time?: string | null
  end_time?: string | null
}

// 试卷题目（包含顺序和分值）
export type PaperQuestion = {
  id: string
  question_id: string
  order_no: number
  score: number
  question: QuestionItem
}

// 答题草稿
export type AnswerDraft = {
  [questionId: string]: string | string[] // 根据题型：选择类为 string[]，填空/简答为 string
}

// 获取学生可参加的试卷列表
export async function getAvailablePapers(): Promise<PaperInfo[]> {
  if (!isSupabaseReady) {
    return []
  }

  const { data, error } = await supabase
    .from('papers')
    .select('id, title, subject, grade, total_score, duration_minutes, published, allow_review, created_at, start_time, end_time')
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('获取试卷列表失败', error.message)
    return []
  }

  return (data as PaperInfo[]) ?? []
}

// 检查学生是否已完成某试卷
export async function checkPaperCompleted(paperId: string, userId: string): Promise<boolean> {
  if (!isSupabaseReady) {
    return false
  }

  const { data, error } = await supabase
    .from('answers')
    .select('id')
    .eq('paper_id', paperId)
    .eq('user_id', userId)
    .limit(1)

  if (error) {
    console.warn('检查完成状态失败', error.message)
    return false
  }

  return (data?.length ?? 0) > 0
}

// 加载试卷题目（按顺序）
export async function loadPaperQuestions(paperId: string): Promise<PaperQuestion[]> {
  if (!isSupabaseReady) {
    return []
  }

  const { data, error } = await supabase
    .from('paper_questions')
    .select(`
      id,
      question_id,
      order_no,
      score,
      questions (
        id,
        subject,
        grade,
        difficulty,
        type,
        stem,
        options,
        answer,
        analysis,
        tags
      )
    `)
    .eq('paper_id', paperId)
    .order('order_no', { ascending: true })

  if (error) {
    console.warn('加载试卷题目失败', error.message)
    return []
  }

  return (data ?? []).map((item: any) => ({
    id: item.id,
    question_id: item.question_id,
    order_no: item.order_no,
    score: item.score,
    question: {
      id: item.questions.id,
      subject: item.questions.subject,
      grade: item.questions.grade,
      difficulty: item.questions.difficulty,
      type: item.questions.type as QuestionType,
      stem: item.questions.stem,
      options: item.questions.options,
      answer: item.questions.answer as string[],
      analysis: item.questions.analysis,
      tags: item.questions.tags,
    },
  }))
}

// 保存答题草稿
export async function saveDraft(paperId: string, userId: string, draft: AnswerDraft): Promise<void> {
  if (!isSupabaseReady) {
    return
  }

  await supabase
    .from('answers_draft')
    .upsert({
      user_id: userId,
      paper_id: paperId,
      payload: draft,
      updated_at: new Date().toISOString(),
    })
}

// 加载答题草稿
export async function loadDraft(paperId: string, userId: string): Promise<AnswerDraft | null> {
  if (!isSupabaseReady) {
    return null
  }

  const { data, error } = await supabase
    .from('answers_draft')
    .select('payload')
    .eq('user_id', userId)
    .eq('paper_id', paperId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.payload as AnswerDraft
}

// 自动批改单个题目
function gradeQuestion(question: QuestionItem, chosen: string | string[]): {
  isCorrect: boolean
  score: number
  status: 'auto' | 'pending'
} {
  const chosenArray = Array.isArray(chosen) ? chosen : [chosen]
  const correctAnswer = Array.isArray(question.answer) ? question.answer : [question.answer]

  switch (question.type) {
    case 'single':
    case 'multiple':
      // 选择类：完全匹配
      const chosenSorted = [...chosenArray].sort().join(',')
      const correctSorted = [...correctAnswer].sort().join(',')
      const isCorrect = chosenSorted === correctSorted
      return {
        isCorrect,
        score: isCorrect ? 1 : 0, // 默认每题1分，实际应从 paper_questions.score 获取
        status: 'auto' as const,
      }

    case 'true_false':
      // 判断题：直接比较
      const isCorrectTF = chosenArray[0] === correctAnswer[0]
      return {
        isCorrect: isCorrectTF,
        score: isCorrectTF ? 1 : 0,
        status: 'auto' as const,
      }

    case 'fill':
      // 填空题：模糊匹配（忽略空格、大小写）
      // 如果答案是字符串，按分号分割；如果已经是数组，直接使用
      const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, '')
      const chosenStr = Array.isArray(chosen) ? chosen.join(';') : chosen
      const chosenParts = (typeof chosenStr === 'string' ? chosenStr.split(';') : [chosenStr]).map(s => s.trim()).filter(s => s)
      const chosenNormalized = chosenParts.map(normalize)
      const correctNormalized = correctAnswer.map(normalize)
      
      if (chosenNormalized.length !== correctNormalized.length) {
        return { isCorrect: false, score: 0, status: 'auto' as const }
      }
      
      const allMatch = chosenNormalized.every((c, i) => c === correctNormalized[i])
      return {
        isCorrect: allMatch,
        score: allMatch ? 1 : 0,
        status: 'auto' as const,
      }

    case 'short':
      // 简答题：标记为待阅
      return {
        isCorrect: false, // 待人工判断
        score: 0,
        status: 'pending' as const,
      }

    default:
      return { isCorrect: false, score: 0, status: 'auto' as const }
  }
}

// 提交答案并自动批改
export async function submitAnswers(
  paperId: string,
  userId: string,
  answers: AnswerDraft,
  questionScores: Map<string, number> // question_id -> score
): Promise<{ totalScore: number; submittedAt: string }> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  // 1. 加载试卷题目
  const paperQuestions = await loadPaperQuestions(paperId)
  if (paperQuestions.length === 0) {
    throw new Error('试卷题目加载失败')
  }

  // 2. 批改并准备答案记录
  const answerRecords = paperQuestions.map((pq) => {
    const chosen = answers[pq.question_id] || (pq.question.type === 'multiple' ? [] : '')
    const grading = gradeQuestion(pq.question, chosen)
    const score = grading.status === 'auto' 
      ? (grading.isCorrect ? (questionScores.get(pq.question_id) || pq.score) : 0)
      : 0

    return {
      user_id: userId,
      paper_id: paperId,
      question_id: pq.question_id,
      chosen: Array.isArray(chosen) ? chosen : [chosen],
      is_correct: grading.isCorrect,
      score,
      status: grading.status,
      submitted_at: new Date().toISOString(),
    }
  })

  // 3. 批量插入答案记录
  const { error: insertError } = await supabase.from('answers').upsert(answerRecords, {
    onConflict: 'user_id,paper_id,question_id',
  })

  if (insertError) {
    throw new Error(`提交答案失败: ${insertError.message}`)
  }

  // 4. 删除草稿
  await supabase
    .from('answers_draft')
    .delete()
    .eq('user_id', userId)
    .eq('paper_id', paperId)

  // 5. 计算总分
  const totalScore = answerRecords.reduce((sum, r) => sum + r.score, 0)

  return {
    totalScore,
    submittedAt: answerRecords[0].submitted_at,
  }
}

// 获取学生成绩
export async function getStudentResult(paperId: string, userId: string) {
  if (!isSupabaseReady) {
    return null
  }

  // 加载试卷信息
  const { data: paper, error: paperError } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .maybeSingle()

  if (paperError || !paper) {
    return null
  }

  // 加载答案记录
  const { data: answers, error: answersError } = await supabase
    .from('answers')
    .select(`
      *,
      questions (
        id,
        type,
        stem,
        options,
        answer,
        analysis
      )
    `)
    .eq('paper_id', paperId)
    .eq('user_id', userId)

  if (answersError) {
    return null
  }

  // 计算统计
  const totalScore = answers.reduce((sum, a) => sum + (a.score || 0), 0)
  const correctCount = answers.filter((a) => a.is_correct).length
  const totalCount = answers.length

  // 按题型统计
  const typeStats = new Map<string, { correct: number; total: number }>()
  answers.forEach((a: any) => {
    const type = a.questions?.type || 'unknown'
    const stat = typeStats.get(type) || { correct: 0, total: 0 }
    stat.total++
    if (a.is_correct) stat.correct++
    typeStats.set(type, stat)
  })

  return {
    paper,
    answers: answers.map((a: any) => ({
      ...a,
      question: a.questions,
    })),
    totalScore,
    correctCount,
    totalCount,
    correctRate: totalCount > 0 ? correctCount / totalCount : 0,
    typeStats: Object.fromEntries(typeStats),
  }
}

