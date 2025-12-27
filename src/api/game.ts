import { supabase } from '../lib/supabaseClient'

export interface GameScore {
  id: string
  user_id: string
  game_name: string
  score: number
  level: number
  correct_count: number
  wrong_count: number
  play_duration: number | null
  best_score: number
  created_at: string
  updated_at: string
}

export interface GameScoreWithProfile extends GameScore {
  profiles: {
    name: string | null
    grade: string | null
    class: string | null
  } | null
}

/**
 * 获取当前用户的游戏积分
 */
export async function getMyGameScore(gameName: string = 'dazui'): Promise<GameScore | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('game_scores')
    .select('*')
    .eq('user_id', user.id)
    .eq('game_name', gameName)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // 没有找到记录
      return null
    }
    throw error
  }

  return data as GameScore
}

/**
 * 获取游戏排行榜
 */
export async function getGameRanking(
  gameName: string = 'dazui',
  limit: number = 100
): Promise<GameScoreWithProfile[]> {
  // 先查询游戏积分
  const { data: scores, error: scoresError } = await supabase
    .from('game_scores')
    .select('*')
    .eq('game_name', gameName)
    .order('best_score', { ascending: false })
    .limit(limit)

  if (scoresError) throw scoresError
  if (!scores || scores.length === 0) return []

  // 获取所有 user_id
  const userIds = [...new Set(scores.map(s => s.user_id))]

  // 查询对应的 profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, name, grade, class')
    .in('user_id', userIds)

  if (profilesError) throw profilesError

  // 创建 user_id 到 profile 的映射
  const profileMap = new Map(
    (profiles || []).map(p => [p.user_id, p])
  )

  // 合并数据
  return scores.map(score => ({
    ...score,
    profiles: profileMap.get(score.user_id) || null,
  })) as GameScoreWithProfile[]
}
