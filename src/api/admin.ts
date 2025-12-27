import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import type { QuestionItem } from '../types'

// 试卷列表项（用于管理员列表）
export type PaperListItem = {
  id: string
  title: string
  subject: string | null
  grade: string | null
  duration_minutes: number
  total_score: number
  published: boolean
  created_by: string | null
  created_at: string
  question_count?: number
  submission_count?: number
}

// 获取所有试卷列表（管理员/教师）
export async function getPaperList(params?: {
  published?: boolean
  subject?: string
  grade?: string
}): Promise<PaperListItem[]> {
  if (!isSupabaseReady) {
    return []
  }

  let query = supabase
    .from('papers')
    .select(`
      id,
      title,
      subject,
      grade,
      duration_minutes,
      total_score,
      published,
      created_by,
      created_at,
      paper_questions(id)
    `)
    .order('created_at', { ascending: false })

  if (params?.published !== undefined) {
    query = query.eq('published', params.published)
  }
  if (params?.subject) {
    query = query.eq('subject', params.subject)
  }
  if (params?.grade) {
    query = query.eq('grade', params.grade)
  }

  const { data, error } = await query

  if (error) {
    console.warn('获取试卷列表失败', error.message)
    return []
  }

  // 获取每个试卷的提交数量
  const paperIds = (data || []).map((p: any) => p.id)
  const submissionCounts = new Map<string, number>()

  if (paperIds.length > 0) {
    const { data: submissions } = await supabase
      .from('answers')
      .select('paper_id, user_id')
      .in('paper_id', paperIds)

    if (submissions) {
      const uniqueSubmissions = new Map<string, Set<string>>()
      submissions.forEach((s: any) => {
        if (!uniqueSubmissions.has(s.paper_id)) {
          uniqueSubmissions.set(s.paper_id, new Set())
        }
        uniqueSubmissions.get(s.paper_id)!.add(s.user_id)
      })
      uniqueSubmissions.forEach((userIds, paperId) => {
        submissionCounts.set(paperId, userIds.size)
      })
    }
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    subject: item.subject,
    grade: item.grade,
    duration_minutes: item.duration_minutes,
    total_score: item.total_score,
    published: item.published,
    created_by: item.created_by,
    created_at: item.created_at,
    question_count: Array.isArray(item.paper_questions) ? item.paper_questions.length : 0,
    submission_count: submissionCounts.get(item.id) || 0,
  }))
}

// 更新试卷（发布/下线、编辑）
export async function updatePaper(
  paperId: string,
  updates: {
    title?: string
    subject?: string
    grade?: string
    duration_minutes?: number
    published?: boolean
    allow_review?: boolean
  }
): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  // 检查是否是发布操作
  const isPublishing = updates.published === true

  const { error } = await supabase
    .from('papers')
    .update(updates)
    .eq('id', paperId)

  if (error) {
    throw new Error(`更新试卷失败: ${error.message}`)
  }

  // 如果发布试卷，发送通知给学生
  if (isPublishing) {
    try {
      const { createNotificationsForUsers } = await import('./notifications')
      // 获取所有学生用户ID
      const { data: students } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'student')

      if (students && students.length > 0) {
        const { data: paper } = await supabase
          .from('papers')
          .select('title, start_time, end_time')
          .eq('id', paperId)
          .maybeSingle()

        const startTime = paper?.start_time ? new Date(paper.start_time).toLocaleString('zh-CN') : '立即开始'
        const endTime = paper?.end_time ? new Date(paper.end_time).toLocaleString('zh-CN') : '无限制'

        await createNotificationsForUsers(
          students.map((s) => s.id),
          'exam_start',
          '新试卷已发布',
          `试卷"${paper?.title || '未知试卷'}"已发布。开始时间：${startTime}，结束时间：${endTime}`,
          paperId,
        )
      }
    } catch (err) {
      // 通知发送失败不影响试卷发布
      console.warn('发送发布通知失败', err)
    }
  }
}

// 批量发布/下线试卷
export async function batchUpdatePapers(
  paperIds: string[],
  updates: { published?: boolean },
): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  if (paperIds.length === 0) {
    throw new Error('请至少选择一个试卷')
  }

  const { error } = await supabase
    .from('papers')
    .update(updates)
    .in('id', paperIds)

  if (error) {
    throw new Error(`批量更新失败: ${error.message}`)
  }

  // 如果批量发布，发送通知给学生
  if (updates.published === true) {
    try {
      const { createNotificationsForUsers } = await import('./notifications')
      // 获取所有学生用户ID
      const { data: students } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'student')

      if (students && students.length > 0) {
        // 为每个发布的试卷发送通知
        for (const paperId of paperIds) {
          const { data: paper } = await supabase
            .from('papers')
            .select('title, start_time, end_time')
            .eq('id', paperId)
            .maybeSingle()

          if (paper) {
            const startTime = paper.start_time
              ? new Date(paper.start_time).toLocaleString('zh-CN')
              : '立即开始'
            const endTime = paper.end_time
              ? new Date(paper.end_time).toLocaleString('zh-CN')
              : '无限制'

            await createNotificationsForUsers(
              students.map((s) => s.id),
              'exam_start',
              '新试卷已发布',
              `试卷"${paper.title || '未知试卷'}"已发布。开始时间：${startTime}，结束时间：${endTime}`,
              paperId,
            )
          }
        }
      }
    } catch (err) {
      // 通知发送失败不影响试卷发布
      console.warn('发送批量发布通知失败', err)
    }
  }
}

// 删除试卷
export async function deletePaper(paperId: string): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  // 先删除关联的 paper_questions
  await supabase.from('paper_questions').delete().eq('paper_id', paperId)
  
  // 再删除试卷
  const { error } = await supabase.from('papers').delete().eq('id', paperId)

  if (error) {
    throw new Error(`删除试卷失败: ${error.message}`)
  }
}

// 待批阅的简答题
export type PendingGrading = {
  id: string
  user_id: string
  paper_id: string
  question_id: string
  chosen: string[]
  score: number | null
  manual_score: number | null
  status: 'pending' | 'auto' | 'graded'
  submitted_at: string
  paper_title: string
  question: QuestionItem
  user_name: string | null
  max_score: number
}

// 获取待批阅的简答题列表
export async function getPendingGradings(params?: {
  paper_id?: string
  limit?: number
}): Promise<PendingGrading[]> {
  if (!isSupabaseReady) {
    return []
  }

  let query = supabase
    .from('answers')
    .select(`
      id,
      user_id,
      paper_id,
      question_id,
      chosen,
      score,
      manual_score,
      status,
      submitted_at,
      papers!inner(title),
      questions!inner(*)
    `)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })

  if (params?.paper_id) {
    query = query.eq('paper_id', params.paper_id)
  }
  if (params?.limit) {
    query = query.limit(params.limit)
  }

  const { data, error } = await query

  if (error) {
    console.warn('获取待批阅列表失败', error.message)
    return []
  }

  // 获取用户名称
  const userIds = [...new Set((data || []).map((item: any) => item.user_id))]
  const userNamesMap = new Map<string, string | null>()
  
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name')
      .in('user_id', userIds)
    
    profiles?.forEach((p: any) => {
      userNamesMap.set(p.user_id, p.name)
    })
  }

  // 获取所有待批阅答案的 paper_questions 分数
  const answerIds = (data || []).map((item: any) => ({
    paper_id: item.paper_id,
    question_id: item.question_id,
  }))
  
  const paperQuestionScores = new Map<string, number>()
  if (answerIds.length > 0) {
    const uniquePairs = Array.from(
      new Set(answerIds.map((a) => `${a.paper_id}_${a.question_id}`))
    )
    
    // 批量查询所有 paper_questions
    const paperIds = [...new Set(answerIds.map((a) => a.paper_id))]
    const questionIds = [...new Set(answerIds.map((a) => a.question_id))]
    
    const { data: pqDataList } = await supabase
      .from('paper_questions')
      .select('paper_id, question_id, score')
      .in('paper_id', paperIds)
      .in('question_id', questionIds)
    
    if (pqDataList) {
      pqDataList.forEach((pq: any) => {
        const pairKey = `${pq.paper_id}_${pq.question_id}`
        paperQuestionScores.set(pairKey, pq.score || 10)
      })
    }
    
    // 为没有找到的 pair 设置默认值
    uniquePairs.forEach((pair) => {
      if (!paperQuestionScores.has(pair)) {
        paperQuestionScores.set(pair, 10) // 默认分数
      }
    })
  }

  return (data || [])
    .filter((item: any) => {
      // 过滤掉没有 questions 或 papers 数据的记录
      return item.questions && item.papers
    })
    .map((item: any) => {
      const pairKey = `${item.paper_id}_${item.question_id}`
      const maxScore = paperQuestionScores.get(pairKey) || 10
      
      // 确保 question 对象有必要的字段
      const question: QuestionItem = {
        id: item.questions.id || item.question_id,
        subject: item.questions.subject || '',
        grade: item.questions.grade || null,
        semester: item.questions.semester || null,
        textbook_version: item.questions.textbook_version || null,
        difficulty: item.questions.difficulty || 1,
        type: item.questions.type || 'short',
        stem: item.questions.stem || '',
        options: item.questions.options || undefined,
        answer: item.questions.answer || [],
        analysis: item.questions.analysis || null,
        tags: item.questions.tags || [],
        created_by: item.questions.created_by || null,
      }
      
      return {
        id: item.id,
        user_id: item.user_id,
        paper_id: item.paper_id,
        question_id: item.question_id,
        chosen: item.chosen || [],
        score: item.score,
        manual_score: item.manual_score,
        status: item.status as 'pending' | 'auto' | 'graded',
        submitted_at: item.submitted_at,
        paper_title: item.papers?.title || '',
        question,
        user_name: userNamesMap.get(item.user_id) || null,
        max_score: maxScore,
      }
    })
}

// 批阅简答题
export async function gradeShortAnswer(
  answerId: string,
  manualScore: number,
  comment?: string
): Promise<void> {
  if (!isSupabaseReady) {
    throw new Error('Supabase 未配置')
  }

  // 获取答案记录以确定满分
  const { data: answer, error: fetchError } = await supabase
    .from('answers')
    .select('paper_id, question_id, paper_questions!inner(score)')
    .eq('id', answerId)
    .single()

  if (fetchError || !answer) {
    throw new Error('答案记录不存在')
  }

  const maxScore = (answer as any).paper_questions?.score || 0
  const finalScore = Math.max(0, Math.min(manualScore, maxScore))
  const isCorrect = finalScore >= maxScore * 0.6 // 60% 以上认为正确
  
  // 获取用户ID和试卷信息用于发送通知
  const { data: answerData } = await supabase
    .from('answers')
    .select('user_id, paper_id, papers!inner(title)')
    .eq('id', answerId)
    .single()

  const { error } = await supabase
    .from('answers')
    .update({
      manual_score: finalScore,
      score: finalScore,
      is_correct: isCorrect,
      status: 'graded',
      comment: comment || null,
    })
    .eq('id', answerId)

  if (error) {
    throw new Error(`批阅失败: ${error.message}`)
  }

  // 发送批阅完成通知
  try {
    const { createNotification } = await import('./notifications')
    if (answerData?.user_id && answerData?.paper_id) {
      const paperTitle = (answerData as any).papers?.title || '未知试卷'
      await createNotification(
        answerData.user_id,
        'manual_review_completed',
        '简答题批阅完成',
        `您的试卷"${paperTitle}"中的简答题已批阅完成，得分：${finalScore}分。`,
        answerData.paper_id,
      )
    }
  } catch (err) {
    // 通知发送失败不影响批阅
    console.warn('发送批阅完成通知失败', err)
  }
}

// 获取试卷统计信息
export type PaperStats = {
  paper_id: string
  paper_title: string
  total_submissions: number
  average_score: number
  highest_score: number
  lowest_score: number
  pass_rate: number // 及格率（60%）
}

export async function getPaperStats(paperId: string): Promise<PaperStats | null> {
  if (!isSupabaseReady) {
    return null
  }

  // 获取试卷信息
  const { data: paper } = await supabase
    .from('papers')
    .select('id, title, total_score')
    .eq('id', paperId)
    .single()

  if (!paper) {
    return null
  }

  // 获取所有提交的用户
  const { data: submissions } = await supabase
    .from('answers')
    .select('user_id, score, manual_score')
    .eq('paper_id', paperId)

  if (!submissions || submissions.length === 0) {
    return {
      paper_id: paperId,
      paper_title: paper.title,
      total_submissions: 0,
      average_score: 0,
      highest_score: 0,
      lowest_score: 0,
      pass_rate: 0,
    }
  }

  // 按用户聚合分数
  const userScores = new Map<string, number>()
  submissions.forEach((s: any) => {
    const userId = s.user_id
    const score = (s.score || 0) + (s.manual_score || 0)
    const current = userScores.get(userId) || 0
    userScores.set(userId, current + score)
  })

  const scores = Array.from(userScores.values())
  const totalScore = paper.total_score
  const totalSubmissions = scores.length
  const averageScore = scores.reduce((sum, s) => sum + s, 0) / totalSubmissions
  const highestScore = Math.max(...scores)
  const lowestScore = Math.min(...scores)
  const pass_rate = scores.filter((s) => s >= totalScore * 0.6).length / totalSubmissions

  return {
    paper_id: paperId,
    paper_title: paper.title,
    total_submissions: totalSubmissions,
    average_score: averageScore,
    highest_score: highestScore,
    lowest_score: lowestScore,
    pass_rate: pass_rate,
  }
}

// 获取全局统计（管理员 Dashboard）
export type DashboardStats = {
  total_papers: number
  published_papers: number
  total_submissions: number
  pending_gradings: number
  recent_papers: PaperListItem[]
}

export async function getDashboardStats(): Promise<DashboardStats | null> {
  if (!isSupabaseReady) {
    return null
  }

  // 获取试卷统计
  const { data: papers } = await supabase
    .from('papers')
    .select('id, published')
  
  const totalPapers = papers?.length || 0
  const publishedPapers = papers?.filter((p) => p.published).length || 0

  // 获取提交统计
  const { data: submissions } = await supabase
    .from('answers')
    .select('id, user_id, paper_id')
  
  const uniqueSubmissions = new Set<string>()
  submissions?.forEach((s: any) => {
    uniqueSubmissions.add(`${s.user_id}-${s.paper_id}`)
  })
  const totalSubmissions = uniqueSubmissions.size

  // 获取待批阅数量
  const { count: pendingCount } = await supabase
    .from('answers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  // 获取最近的试卷
  const recentPapers = await getPaperList({ published: undefined })

  return {
    total_papers: totalPapers,
    published_papers: publishedPapers,
    total_submissions: totalSubmissions,
    pending_gradings: pendingCount || 0,
    recent_papers: recentPapers.slice(0, 5),
  }
}

