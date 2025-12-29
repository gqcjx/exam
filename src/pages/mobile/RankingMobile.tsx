/**
 * 移动端排行榜页面
 * 统一移动端设计风格
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getRanking, getPaperListForRanking, type RankingItem } from '../../api/ranking'
import { isSupabaseReady } from '../../lib/env'
import { useAuth } from '../../context/AuthContext'

export default function RankingMobile() {
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

  const subjects = Array.from(new Set(papers.map((p: any) => p.subject).filter(Boolean))).sort()
  const grades = Array.from(new Set(papers.map((p: any) => p.grade).filter(Boolean))).sort()

  if (!isSupabaseReady) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-600">Supabase 未配置，无法使用此功能</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-20">
      {/* 顶部欢迎栏（参照个人主页） */}
      <div className="bg-gradient-to-r from-[#2E8B57] to-[#3da86a] text-white px-6 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <i className="fas fa-trophy text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                排行榜
              </h2>
              <p className="text-sm opacity-90">查看各试卷的成绩排名</p>
            </div>
          </div>
          <Link to="/dashboard" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
            <i className="fas fa-home"></i>
          </Link>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">试卷</label>
            <select
              value={filter.paper_id || ''}
              onChange={(e) => setFilter({ ...filter, paper_id: e.target.value || undefined })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
            >
              <option value="">全部试卷</option>
              {papers.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">学科</label>
              <select
                value={filter.subject || ''}
                onChange={(e) => setFilter({ ...filter, subject: e.target.value || undefined })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
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
              <label className="block text-xs text-gray-600 mb-1.5">年级</label>
              <select
                value={filter.grade || ''}
                onChange={(e) => setFilter({ ...filter, grade: e.target.value || undefined })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
              >
                <option value="">全部年级</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilter({})}
            className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            清除筛选
          </button>
        </div>
      </div>

      {/* 排行榜列表 */}
      <div className="px-4 pb-6 space-y-2">
        {isLoading ? (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-sm text-gray-600">加载中...</p>
          </div>
        ) : ranking.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <i className="fas fa-trophy text-4xl text-gray-300 mb-3"></i>
            <p className="text-sm text-gray-600">暂无排名数据</p>
          </div>
        ) : (
          ranking.map((item, index) => {
            const rank = index + 1
            const isTopThree = rank <= 3
            return (
              <div
                key={`${item.user_id}-${item.paper_id}`}
                className={`bg-white rounded-xl p-4 shadow-sm ${
                  isTopThree ? 'border-2 border-[#FFA500]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* 排名 */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">
                      {rank === 1 && <span className="text-2xl">🥇</span>}
                      {rank === 2 && <span className="text-2xl">🥈</span>}
                      {rank === 3 && <span className="text-2xl">🥉</span>}
                      {rank > 3 && (
                        <span className={`${isTopThree ? 'text-[#FFA500]' : 'text-gray-600'}`}>
                          {rank}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {item.user_name || item.user_email}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {item.paper_title}
                      </div>
                    </div>
                  </div>

                  {/* 分数 */}
                  <div className="flex-shrink-0 text-right ml-3">
                    <div className="text-lg font-bold text-[#2E8B57]">
                      {item.score} / {item.total_score}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {(item.correct_rate * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 底部导航栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 flex justify-around items-center py-3 z-50">
        <Link to="/dashboard" className="flex flex-col items-center">
          <i className="fas fa-home text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">首页</span>
        </Link>
        <Link to="/wrong-questions" className="flex flex-col items-center">
          <i className="fas fa-book text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">错题本</span>
        </Link>
        <Link to="/ranking" className="flex flex-col items-center">
          <i className="fas fa-trophy text-[#2E8B57] text-xl"></i>
          <span className="text-xs text-[#2E8B57] mt-1">排行榜</span>
        </Link>
        <Link to="/report" className="flex flex-col items-center">
          <i className="fas fa-chart-line text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">报表</span>
        </Link>
      </div>
    </div>
  )
}
