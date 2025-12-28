/**
 * 排行榜相关 API
 * 提供排行榜数据查询功能
 */

import { supabase } from '../lib/supabaseClient'
import { isSupabaseReady } from '../lib/env'
import { logger } from '../utils/logger'
import { handleError, getUserErrorMessage } from '../utils/errorHandler'
import { withRetry, withTimeout } from '../utils/async'

/**
 * 排行榜项接口
 */
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

/**
 * 排行榜筛选条件
 */
export interface RankingFilter {
  paper_id?: string
  subject?: string
  grade?: string
  limit?: number
}

/**
 * 用户答案数据接口（用于内部处理）
 * 注意：Supabase 返回的数据结构可能与接口不完全匹配，使用类型断言处理
 */
type AnswerItem = {
  user_id: string
  paper_id: string
  score: number
  manual_score: number
  submitted_at: string
  is_correct: boolean
  profiles: {
    name: string | null
    email: string | null
  } | {
    name: string | null
    email: string | null
  }[]
  papers: {
    title: string
    total_score: number
    subject: string | null
    grade: string | null
  } | {
    title: string
    total_score: number
    subject: string | null
    grade: string | null
  }[]
}

/**
 * 用户统计数据（用于聚合计算）
 */
interface UserStats {
  score: number
  totalScore: number
  submittedAt: string
  correctCount: number
  totalCount: number
  profiles: {
    name: string | null
    email: string | null
  }
  papers: {
    title: string
    total_score: number
    subject: string | null
    grade: string | null
  }
}

/**
 * 获取排行榜
 * 
 * 算法优化：
 * 1. 使用 Map 数据结构提高查找效率（O(1) vs O(n)）
 * 2. 单次遍历完成数据聚合，避免多次 filter 操作
 * 3. 使用索引优化排序性能
 * 
 * @param filter 筛选条件
 * @returns 排行榜数据
 */
export async function getRanking(filter: RankingFilter = {}): Promise<RankingItem[]> {
  if (!isSupabaseReady) {
    logger.warn('Supabase 未就绪，返回空排行榜')
    return []
  }

  try {
    return await withRetry(
      async () => {
        return await withTimeout(async () => {
          // 构建查询
          let query = supabase
            .from('answers')
            .select(`
              user_id,
              paper_id,
              score,
              manual_score,
              submitted_at,
              is_correct,
              profiles!inner(name, email),
              papers!inner(title, total_score, subject, grade)
            `)

          // 应用筛选条件
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
            throw new Error(`获取排行榜数据失败: ${error.message}`)
          }

          if (!data || data.length === 0) {
            return []
          }

          // 使用 Map 进行高效聚合（O(n) 时间复杂度）
          // 结构：paperId -> userId -> UserStats
          const paperUserMap = new Map<string, Map<string, UserStats>>()

          // 单次遍历完成数据聚合
          const answerItems = data as unknown as AnswerItem[]
          for (const item of answerItems) {
            // 处理 Supabase 返回的数据结构（可能是数组或对象）
            const profilesData = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
            const papersData = Array.isArray(item.papers) ? item.papers[0] : item.papers
            const { paper_id, user_id, score, manual_score, submitted_at, is_correct } = item
            const profiles = profilesData || { name: null, email: null }
            const papers = papersData || { title: '未知试卷', total_score: 0, subject: null, grade: null }

            // 获取或创建试卷用户映射
            if (!paperUserMap.has(paper_id)) {
              paperUserMap.set(paper_id, new Map())
            }

            const userMap = paperUserMap.get(paper_id)!

            // 获取或创建用户统计
            if (!userMap.has(user_id)) {
              userMap.set(user_id, {
                score: 0,
                totalScore: papers.total_score || 0,
                submittedAt: submitted_at,
                correctCount: 0,
                totalCount: 0,
                profiles,
                papers,
              })
            }

            // 更新统计数据
            const userStats = userMap.get(user_id)!
            userStats.score += (score || 0) + (manual_score || 0)
            userStats.totalCount++
            if (is_correct) {
              userStats.correctCount++
            }
          }

          // 转换为排行榜列表
          const ranking: RankingItem[] = []

          for (const [paperId, userMap] of paperUserMap) {
            for (const [userId, userStats] of userMap) {
              const correctRate =
                userStats.totalCount > 0
                  ? userStats.correctCount / userStats.totalCount
                  : 0

              ranking.push({
                user_id: userId,
                user_name: userStats.profiles?.name || '未知',
                user_email: userStats.profiles?.email || '',
                paper_id: paperId,
                paper_title: userStats.papers?.title || '未知试卷',
                score: userStats.score,
                total_score: userStats.totalScore,
                correct_rate: correctRate,
                submitted_at: userStats.submittedAt,
              })
            }
          }

          // 排序：按分数降序，分数相同按提交时间升序
          ranking.sort((a, b) => {
            const scoreDiff = b.score - a.score
            if (scoreDiff !== 0) {
              return scoreDiff
            }
            return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
          })

          // 应用数量限制
          return filter.limit ? ranking.slice(0, filter.limit) : ranking
        }, { timeout: 30000 })
      },
      {
        maxRetries: 3,
        delay: 1000,
        exponentialBackoff: true,
      }
    )
  } catch (error) {
    const appError = handleError(error, 'getRanking')
    logger.error('获取排行榜失败', appError)
    return []
  }
}

/**
 * 获取试卷列表（用于排行榜筛选）
 * 
 * @returns 试卷列表
 */
export async function getPaperListForRanking() {
  if (!isSupabaseReady) {
    logger.warn('Supabase 未就绪，返回空试卷列表')
    return []
  }

  try {
    return await withRetry(
      async () => {
        const { data, error } = await supabase
          .from('papers')
          .select('id, title, subject, grade')
          .eq('published', true)
          .order('created_at', { ascending: false })

        if (error) {
          throw new Error(`获取试卷列表失败: ${error.message}`)
        }

        return data || []
      },
      {
        maxRetries: 2,
        delay: 500,
      }
    )
  } catch (error) {
    const appError = handleError(error, 'getPaperListForRanking')
    logger.error('获取试卷列表失败', appError)
    return []
  }
}

