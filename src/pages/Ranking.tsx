import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRanking, getPaperListForRanking, type RankingItem } from '../api/ranking'
import { isSupabaseReady } from '../lib/env'
import { useAuth } from '../context/AuthContext'

export default function Ranking() {
  const { profile } = useAuth()
  const [filter, setFilter] = useState<{
    paper_id?: string
    subject?: string
    grade?: string
  }>({})

  const { data: papers = [] } = useQuery({
    queryKey: ['paper-list-for-ranking'],
    queryFn: getPaperListForRanking,
  })

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ['ranking', filter],
    queryFn: () => getRanking({ ...filter, limit: 100 }),
  })

  // 获取所有学科和年级用于筛选
  const subjects = Array.from(new Set(papers.map((p: any) => p.subject).filter(Boolean))).sort()
  const grades = Array.from(new Set(papers.map((p: any) => p.grade).filter(Boolean))).sort()

  if (!isSupabaseReady) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">排行榜</h1>
        <div className="card">
          <p className="text-sm text-amber-700">Supabase 未配置，无法使用此功能</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">排行榜</h1>
        <p className="text-sm text-slate-600">查看各试卷的成绩排名</p>
      </div>

      {/* 筛选器 */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">试卷</label>
            <select
              value={filter.paper_id || ''}
              onChange={(e) => setFilter({ ...filter, paper_id: e.target.value || undefined })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="">全部试卷</option>
              {papers.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">学科</label>
            <select
              value={filter.subject || ''}
              onChange={(e) => setFilter({ ...filter, subject: e.target.value || undefined })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="">全部学科</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">年级</label>
            <select
              value={filter.grade || ''}
              onChange={(e) => setFilter({ ...filter, grade: e.target.value || undefined })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="">全部年级</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFilter({})}
              className="btn btn-secondary btn-sm"
            >
              清除筛选
            </button>
          </div>
        </div>
      </div>

      {/* 排行榜列表 */}
      {isLoading ? (
        <div className="card">
          <p className="text-sm text-slate-600">加载中...</p>
        </div>
      ) : ranking.length === 0 ? (
        <div className="card">
          <p className="text-sm text-slate-600">暂无排名数据</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">排名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">姓名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">试卷</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">得分</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">正确率</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">提交时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {ranking.map((item, index) => {
                  const rank = index + 1
                  const isTopThree = rank <= 3
                  return (
                    <tr
                      key={`${item.user_id}-${item.paper_id}`}
                      className={isTopThree ? 'bg-amber-50' : 'hover:bg-slate-50'}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {rank === 1 && <span className="text-lg">🥇</span>}
                          {rank === 2 && <span className="text-lg">🥈</span>}
                          {rank === 3 && <span className="text-lg">🥉</span>}
                          <span className={`text-sm font-semibold ${isTopThree ? 'text-amber-700' : 'text-slate-700'}`}>
                            {rank}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">{item.user_name || item.user_email}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{item.paper_title}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-slate-900">
                          {item.score} / {item.total_score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-emerald-600">
                          {(item.correct_rate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(item.submitted_at).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

