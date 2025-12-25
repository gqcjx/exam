import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPendingGradings, gradeShortAnswer, type PendingGrading } from '../api/admin'
import { QuestionPreview } from '../components/QuestionPreview'
import { isSupabaseReady } from '../lib/env'
import { useAuth } from '../context/AuthContext'

export default function AdminGrading() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [selectedPaperId, setSelectedPaperId] = useState<string | undefined>(undefined)

  const { data: pendings = [], isLoading } = useQuery({
    queryKey: ['pending-gradings', selectedPaperId],
    queryFn: () => getPendingGradings({ paper_id: selectedPaperId }),
    enabled: !!profile && (profile.role === 'admin' || profile.role === 'teacher'),
  })

  const gradeMutation = useMutation({
    mutationFn: ({ answerId, score, comment }: { answerId: string; score: number; comment?: string }) =>
      gradeShortAnswer(answerId, score, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-gradings'] })
      queryClient.invalidateQueries({ queryKey: ['exam-results'] })
    },
  })

  if (!isSupabaseReady) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">简答题批阅</h1>
        <div className="card">
          <p className="text-sm text-amber-700">Supabase 未配置，无法使用此功能</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">简答题批阅</h1>
          <p className="text-sm text-slate-600">
            批阅学生提交的简答题，设置得分和评语。当前待批阅：{pendings.length} 题
          </p>
        </div>
        <div className="text-sm text-slate-600">
          <label>
            <input
              type="checkbox"
              checked={selectedPaperId === undefined}
              onChange={(e) => setSelectedPaperId(e.target.checked ? undefined : undefined)}
              className="mr-2"
            />
            显示所有试卷
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="card">
          <p className="text-sm text-slate-600">加载中...</p>
        </div>
      ) : pendings.length === 0 ? (
        <div className="card">
          <p className="text-sm text-slate-600">暂无待批阅的简答题</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendings.map((item) => (
            <GradingItem key={item.id} item={item} onGrade={gradeMutation.mutate} />
          ))}
        </div>
      )}
    </div>
  )
}

function GradingItem({
  item,
  onGrade,
}: {
  item: PendingGrading
  onGrade: (params: { answerId: string; score: number; comment?: string }) => void
}) {
  const [score, setScore] = useState<number>(item.manual_score || 0)
  const [comment, setComment] = useState<string>('')
  const [isGrading, setIsGrading] = useState(false)

  const maxScore = item.max_score || 10

  const handleSubmit = async () => {
    if (score < 0 || score > maxScore) {
      alert(`得分必须在 0-${maxScore} 分之间`)
      return
    }
    setIsGrading(true)
    try {
      onGrade({ answerId: item.id, score, comment: comment.trim() || undefined })
      setScore(0)
      setComment('')
    } catch (error) {
      console.error('批阅失败', error)
      alert('批阅失败，请重试')
    } finally {
      setIsGrading(false)
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between border-b border-slate-200 pb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{item.paper_title}</span>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">待批阅</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            学生：{item.user_name || '未知'} | 提交时间：{new Date(item.submitted_at).toLocaleString('zh-CN')}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">题目：</p>
          <QuestionPreview question={item.question} />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">学生答案：</p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="whitespace-pre-wrap text-sm text-slate-800">
              {Array.isArray(item.chosen) ? item.chosen.join(' ') : item.chosen}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              得分（满分 {maxScore} 分）
            </label>
            <input
              type="number"
              min="0"
              max={maxScore}
              step="0.5"
              value={score}
              onChange={(e) => setScore(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">评语（可选）</label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="简要评语..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={handleSubmit}
            disabled={isGrading || score < 0 || score > maxScore}
            className="btn btn-primary"
          >
            {isGrading ? '批阅中...' : '提交批阅'}
          </button>
        </div>
      </div>
    </div>
  )
}


