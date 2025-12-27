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
  const { data, error } = await supabase
    .from('game_scores')
    .select(`
      *,
      profiles:user_id (
        name,
        grade,
        class
      )
    `)
    .eq('game_name', gameName)
    .order('best_score', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as GameScoreWithProfile[]
}
