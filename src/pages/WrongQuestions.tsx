import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getWrongQuestions, toggleMastered, deleteWrongQuestion, getWrongQuestionStats, type WrongQuestion } from '../api/wrongQuestions'
import { QuestionPreview } from '../components/QuestionPreview'
import { QuestionAnswer } from '../components/QuestionAnswer'
import { useAuth } from '../context/AuthContext'
import { isSupabaseReady } from '../lib/env'

const typeLabels: Record<string, string> = {
  single: '单选',
  multiple: '多选',
  true_false: '判断',
  fill: '填空',
  short: '简答',
}

export default function WrongQuestions() {
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

  // 获取所有学科和题型用于筛选
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
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">错题本</h1>
        <div className="card">
          <p className="text-sm text-amber-700">Supabase 未配置，无法使用此功能</p>
        </div>
      </div>
    )
  }

  if (profile?.role !== 'student') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">错题本</h1>
        <div className="card">
          <p className="text-sm text-slate-600">仅学生可访问错题本。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">错题本</h1>
        <p className="text-sm text-slate-600">查看和管理你的错题，标记已掌握的题目</p>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="text-xs text-slate-500">总错题数</p>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">未掌握</p>
            <p className="text-2xl font-bold text-red-600">{stats.notMastered}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">已掌握</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.mastered}</p>
          </div>
          <div className="card">
            <p className="text-xs text-slate-500">掌握率</p>
            <p className="text-2xl font-bold text-blue-600">
              {stats.total > 0 ? ((stats.mastered / stats.total) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      )}

      {/* 筛选器 */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">学科</label>
            <select
              value={filter.subject || ''}
              onChange={(e) => setFilter({ ...filter, subject: e.target.value || undefined })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
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
            <label className="block text-xs text-slate-600 mb-1">题型</label>
            <select
              value={filter.type || ''}
              onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="">全部</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {typeLabels[t] || t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">掌握状态</label>
            <select
              value={filter.is_mastered === undefined ? '' : filter.is_mastered ? 'mastered' : 'not-mastered'}
              onChange={(e) => {
                const value = e.target.value
                setFilter({
                  ...filter,
                  is_mastered: value === '' ? undefined : value === 'mastered',
                })
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="">全部</option>
              <option value="not-mastered">未掌握</option>
              <option value="mastered">已掌握</option>
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

      {/* 错题列表 */}
      {isLoading ? (
        <div className="card">
          <p className="text-sm text-slate-600">加载中...</p>
        </div>
      ) : wrongQuestions.length === 0 ? (
        <div className="card">
          <p className="text-sm text-slate-600">暂无错题</p>
        </div>
      ) : (
        <div className="space-y-4">
          {wrongQuestions.map((wq) => (
            <div key={wq.id} className="card space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">
                    {typeLabels[wq.question?.type || ''] || wq.question?.type} · 
                    {wq.question?.subject && ` ${wq.question.subject}`}
                    {wq.question?.grade && ` · ${wq.question.grade}`}
                  </span>
                  {wq.is_mastered && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      已掌握
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>错误 {wq.wrong_count} 次</span>
                  <span>·</span>
                  <span>{new Date(wq.last_wrong_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>

              {wq.question && <QuestionPreview question={wq.question} />}

              {wq.user_answer && (
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-700">我的答案：</p>
                  <p className="mt-1 text-sm text-red-900">{wq.user_answer}</p>
                </div>
              )}

              {wq.question?.analysis && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-700">解析：</p>
                  <p className="mt-1 text-sm text-blue-900">{wq.question.analysis}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    toggleMasteredMutation.mutate({
                      id: wq.id,
                      isMastered: !wq.is_mastered,
                    })
                  }
                  disabled={toggleMasteredMutation.isPending}
                  className={`btn btn-sm ${
                    wq.is_mastered ? 'btn-secondary' : 'btn-primary'
                  }`}
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
                  className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

