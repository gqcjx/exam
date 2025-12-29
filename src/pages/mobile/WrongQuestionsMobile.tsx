/**
 * 移动端错题本页面
 * 统一移动端设计风格
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getWrongQuestions, toggleMastered, deleteWrongQuestion, getWrongQuestionStats, type WrongQuestion } from '../../api/wrongQuestions'
import { QuestionPreview } from '../../components/QuestionPreview'
import { useAuth } from '../../context/AuthContext'
import { isSupabaseReady } from '../../lib/env'

const typeLabels: Record<string, string> = {
  single: '单选',
  multiple: '多选',
  true_false: '判断',
  fill: '填空',
  short: '简答',
}

export default function WrongQuestionsMobile() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<{
    subject?: string
    grade?: string
    type?: string
    is_mastered?: boolean
  }>({})

  const { data: wrongQuestions = [], isLoading } = useQuery({
    queryKey: ['wrong-questions', filter],
    queryFn: () => getWrongQuestions(filter),
    enabled: !!profile && profile.role === 'student',
  })

  const { data: stats } = useQuery({
    queryKey: ['wrong-question-stats'],
    queryFn: getWrongQuestionStats,
    enabled: !!profile && profile.role === 'student',
  })

  const toggleMasteredMutation = useMutation({
    mutationFn: ({ id, isMastered }: { id: string; isMastered: boolean }) =>
      toggleMastered(id, isMastered),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wrong-questions'] })
      queryClient.invalidateQueries({ queryKey: ['wrong-question-stats'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteWrongQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wrong-questions'] })
      queryClient.invalidateQueries({ queryKey: ['wrong-question-stats'] })
    },
  })

  const subjects = useMemo(() => {
    const set = new Set<string>()
    wrongQuestions.forEach((wq) => {
      if (wq.question?.subject) {
        set.add(wq.question.subject)
      }
    })
    return Array.from(set).sort()
  }, [wrongQuestions])

  const types = useMemo(() => {
    const set = new Set<string>()
    wrongQuestions.forEach((wq) => {
      if (wq.question?.type) {
        set.add(wq.question.type)
      }
    })
    return Array.from(set).sort()
  }, [wrongQuestions])

  if (!isSupabaseReady) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-600">Supabase 未配置，无法使用此功能</p>
        </div>
      </div>
    )
  }

  if (profile?.role !== 'student') {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-600">仅学生可访问错题本。</p>
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
              <i className="fas fa-book text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                错题本
              </h2>
              <p className="text-sm opacity-90">查看和管理你的错题</p>
            </div>
          </div>
          <Link to="/dashboard" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
            <i className="fas fa-home"></i>
          </Link>
        </div>
        
        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-lg font-bold">{stats.total}</div>
              <div className="text-xs opacity-90 mt-1">总数</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-red-200">{stats.notMastered}</div>
              <div className="text-xs opacity-90 mt-1">未掌握</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-green-200">{stats.mastered}</div>
              <div className="text-xs opacity-90 mt-1">已掌握</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-lg font-bold">
                {stats.total > 0 ? ((stats.mastered / stats.total) * 100).toFixed(0) : 0}%
              </div>
              <div className="text-xs opacity-90 mt-1">掌握率</div>
            </div>
          </div>
        )}
      </div>

      {/* 筛选器 */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">学科</label>
              <select
                value={filter.subject || ''}
                onChange={(e) => setFilter({ ...filter, subject: e.target.value || undefined })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
              >
                <option value="">全部</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">题型</label>
              <select
                value={filter.type || ''}
                onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
              >
                <option value="">全部</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {typeLabels[t] || t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">掌握状态</label>
            <select
              value={filter.is_mastered === undefined ? '' : filter.is_mastered ? 'mastered' : 'not-mastered'}
              onChange={(e) => {
                const value = e.target.value
                setFilter({
                  ...filter,
                  is_mastered: value === '' ? undefined : value === 'mastered',
                })
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
            >
              <option value="">全部</option>
              <option value="not-mastered">未掌握</option>
              <option value="mastered">已掌握</option>
            </select>
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

      {/* 错题列表 */}
      <div className="px-4 pb-6 space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-sm text-gray-600">加载中...</p>
          </div>
        ) : wrongQuestions.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <i className="fas fa-book-open text-4xl text-gray-300 mb-3"></i>
            <p className="text-sm text-gray-600">暂无错题</p>
          </div>
        ) : (
          wrongQuestions.map((wq) => (
            <div key={wq.id} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              {/* 题目头部 */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#2E8B57] bg-[#e8f5e9] px-2 py-1 rounded">
                    {typeLabels[wq.question?.type || ''] || wq.question?.type}
                  </span>
                  {wq.question?.subject && (
                    <span className="text-xs text-gray-600">{wq.question.subject}</span>
                  )}
                  {wq.question?.grade && (
                    <span className="text-xs text-gray-600">· {wq.question.grade}</span>
                  )}
                  {wq.is_mastered && (
                    <span className="text-xs font-semibold text-[#2E8B57] bg-[#e8f5e9] px-2 py-1 rounded">
                      ✓ 已掌握
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(wq.last_wrong_at).toLocaleDateString('zh-CN')}
                </div>
              </div>

              {/* 题目内容 */}
              {wq.question && (
                <div className="text-sm text-gray-800">
                  <QuestionPreview question={wq.question} />
                </div>
              )}

              {/* 我的答案 */}
              {wq.user_answer && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">我的答案：</p>
                  <p className="text-sm text-red-900">{wq.user_answer}</p>
                </div>
              )}

              {/* 解析 */}
              {wq.question?.analysis && (
                <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">解析：</p>
                  <p className="text-sm text-blue-900">{wq.question.analysis}</p>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() =>
                    toggleMasteredMutation.mutate({
                      id: wq.id,
                      isMastered: !wq.is_mastered,
                    })
                  }
                  disabled={toggleMasteredMutation.isPending}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    wq.is_mastered
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-[#2E8B57] text-white hover:bg-[#3da86a]'
                  } disabled:opacity-50`}
                >
                  {wq.is_mastered ? '标记为未掌握' : '标记为已掌握'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('确定要删除这道错题吗？')) {
                      deleteMutation.mutate(wq.id)
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-gray-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部导航栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 flex justify-around items-center py-3 z-50">
        <Link to="/dashboard" className="flex flex-col items-center">
          <i className="fas fa-home text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">首页</span>
        </Link>
        <Link to="/wrong-questions" className="flex flex-col items-center">
          <i className="fas fa-book text-[#2E8B57] text-xl"></i>
          <span className="text-xs text-[#2E8B57] mt-1">错题本</span>
        </Link>
        <Link to="/ranking" className="flex flex-col items-center">
          <i className="fas fa-trophy text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">排行榜</span>
        </Link>
        <Link to="/report" className="flex flex-col items-center">
          <i className="fas fa-chart-line text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">报表</span>
        </Link>
      </div>
    </div>
  )
}
