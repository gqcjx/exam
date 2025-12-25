import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'

export interface RankingItem {
  user_id: string
  user_name: string
  user_email: string
  paper_id: string
  paper_title: string
  score: number
  total_score: number
  correct_rate: number
  time_spent?: number
  submitted_at: string
}

export interface RankingFilter {
  paper_id?: string
  subject?: string
  grade?: string
  limit?: number
}

// 获取排行榜
export async function getRanking(filter: RankingFilter = {}): Promise<RankingItem[]> {
  if (!isSupabaseReady) {
    return []
  }

  let query = supabase
    .from('answers')
    .select(`
      user_id,
      paper_id,
      score,
      manual_score,
      submitted_at,
      profiles!inner(name, email),
      papers!inner(title, total_score, subject, grade)
    `)

  if (filter.paper_id) {
    query = query.eq('paper_id', filter.paper_id)
  }

  if (filter.subject) {
    query = query.eq('papers.subject', filter.subject)
  }

  if (filter.grade) {
    query = query.eq('papers.grade', filter.grade)
  }

  const { data, error } = await query

  if (error) {
    console.warn('获取排行榜失败', error.message)
    return []
  }

  // 按试卷分组并计算总分
  const paperUserMap = new Map<string, Map<string, { score: number; totalScore: number; submittedAt: string }>>()

  data?.forEach((item: any) => {
    const paperId = item.paper_id
    const userId = item.user_id
    const score = (item.score || 0) + (item.manual_score || 0)
    const totalScore = item.papers?.total_score || 0
    const submittedAt = item.submitted_at

    if (!paperUserMap.has(paperId)) {
      paperUserMap.set(paperId, new Map())
    }

    const userMap = paperUserMap.get(paperId)!
    if (!userMap.has(userId)) {
      userMap.set(userId, { score: 0, totalScore, submittedAt })
    }

    const userData = userMap.get(userId)!
    userData.score += score
  })

  // 转换为排行榜列表
  const ranking: RankingItem[] = []

  paperUserMap.forEach((userMap, paperId) => {
    const paperData = data?.find((item: any) => item.paper_id === paperId)
    if (!paperData) return

    userMap.forEach((userData, userId) => {
      const userDataList = data?.filter((item: any) => item.user_id === userId && item.paper_id === paperId) || []
      const firstItem = userDataList[0]
      const correctCount = userDataList.filter((item: any) => item.is_correct === true).length
      const totalCount = userDataList.length
      const correctRate = totalCount > 0 ? correctCount / totalCount : 0

      ranking.push({
        user_id: userId,
        user_name: firstItem?.profiles?.name || '未知',
        user_email: firstItem?.profiles?.email || '',
        paper_id: paperId,
        paper_title: firstItem?.papers?.title || '',
        score: userData.score,
        total_score: userData.totalScore,
        correct_rate: correctRate,
        submitted_at: userData.submittedAt,
      })
    })
  })

  // 按分数排序
  ranking.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    // 分数相同按提交时间排序（早提交的排名靠前）
    return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  })

  // 限制数量
  if (filter.limit) {
    return ranking.slice(0, filter.limit)
  }

  return ranking
}

// 获取试卷列表（用于筛选）
export async function getPaperListForRanking() {
  if (!isSupabaseReady) {
    return []
  }

  const { data, error } = await supabase
    .from('papers')
    .select('id, title, subject, grade')
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('获取试卷列表失败', error.message)
    return []
  }

  return data || []
}

