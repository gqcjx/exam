import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getGameRanking, type GameScoreWithProfile } from '../api/game'
import { Trophy, Medal, Award } from 'lucide-react'

export default function GameRanking() {
  const { profile } = useAuth()

  const { data: rankings, isLoading, error } = useQuery({
    queryKey: ['game-ranking', 'dazui'],
    queryFn: () => getGameRanking('dazui', 100),
    staleTime: 30_000, // 30秒刷新一次
  })

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />
    if (rank === 3) return <Award className="h-6 w-6 text-amber-600" />
    return <span className="text-slate-500 font-semibold">#{rank}</span>
  }

  const getRankBgColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-50 border-yellow-200'
    if (rank === 2) return 'bg-gray-50 border-gray-200'
    if (rank === 3) return 'bg-amber-50 border-amber-200'
    return 'bg-white border-slate-200'
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}分${secs}秒`
  }

  const calculateAccuracy = (correct: number, wrong: number) => {
    const total = correct + wrong
    if (total === 0) return 0
    return Math.round((correct / total) * 100)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="text-slate-600">加载排行榜...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="card max-w-md text-center space-y-4">
          <p className="text-red-600">加载排行榜失败</p>
          <p className="text-sm text-slate-600">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">大嘴鸟游戏排行榜</h1>
        <p className="text-slate-600">查看所有学生的游戏成绩排名</p>
      </div>

      {!rankings || rankings.length === 0 ? (
        <div className="card text-center py-12">
          <Trophy className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">暂无游戏记录</p>
          <p className="text-sm text-slate-500 mt-2">快去玩游戏，成为第一名吧！</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 前三名特殊展示 */}
          {rankings.slice(0, 3).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {rankings.slice(0, 3).map((item, index) => (
                <div
                  key={item.id}
                  className={`card ${getRankBgColor(index + 1)} border-2 p-6 text-center`}
                >
                  <div className="flex justify-center mb-4">
                    {getRankIcon(index + 1)}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {item.profiles?.name || '匿名'}
                  </h3>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold text-brand-600">
                      {item.best_score} 分
                    </div>
                    <div className="text-sm text-slate-600">
                      等级 {item.level} · 正确率 {calculateAccuracy(item.correct_count, item.wrong_count)}%
                    </div>
                    {(item.profiles?.grade || item.profiles?.class) && (
                      <div className="text-xs text-slate-500">
                        {item.profiles.grade}
                        {item.profiles.class && ` · ${item.profiles.class}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 完整排行榜列表 */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      排名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      最高分
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      等级
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      正确数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      错误数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      正确率
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      最后更新
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {rankings.map((item, index) => {
                    const rank = index + 1
                    const isCurrentUser = profile?.user_id === item.user_id
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isCurrentUser ? 'bg-brand-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getRankIcon(rank)}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-brand-600 font-semibold">(我)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">
                            {item.profiles?.name || '匿名'}
                          </div>
                          {(item.profiles?.grade || item.profiles?.class) && (
                            <div className="text-xs text-slate-500">
                              {item.profiles.grade}
                              {item.profiles.class && ` · ${item.profiles.class}`}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-900">
                            {item.best_score}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600">Lv.{item.level}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-green-600 font-medium">
                            {item.correct_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-red-600 font-medium">
                            {item.wrong_count}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600">
                            {calculateAccuracy(item.correct_count, item.wrong_count)}%
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-500">
                            {new Date(item.updated_at).toLocaleDateString('zh-CN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
