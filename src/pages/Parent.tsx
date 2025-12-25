import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getParentChildren, getChildResults, bindChild } from '../api/parent'

export default function Parent() {
  const [selectedChild, setSelectedChild] = useState<string | null>(null)
  const [childEmail, setChildEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const { data: children = [], refetch } = useQuery({
    queryKey: ['parent-children'],
    queryFn: getParentChildren,
  })

  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ['child-results', selectedChild],
    queryFn: () => (selectedChild ? getChildResults(selectedChild) : Promise.resolve([])),
    enabled: !!selectedChild,
  })

  const bindMutation = useMutation({
    mutationFn: bindChild,
    onSuccess: () => {
      setMessage('绑定成功')
      setChildEmail('')
      refetch()
    },
    onError: (err: any) => {
      setMessage(err?.message || '绑定失败')
    },
  })

  const handleExportCsv = () => {
    if (!results.length) return
    const header = ['试卷标题', '学科', '年级', '总分', '得分', '正确率', '提交时间']
    const rows = results.map((r: any) => [
      r.title,
      r.subject || 'N/A',
      r.grade || 'N/A',
      r.total_score,
      r.score,
      r.total_score > 0 ? ((r.score / r.total_score) * 100).toFixed(1) + '%' : '0%',
      new Date(r.created_at).toLocaleString('zh-CN'),
    ])
    const csv = ['\ufeff' + header.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `成绩明细_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPDF = async () => {
    if (!results.length) return
    try {
      const { exportReportAsPDF } = await import('../api/reports')
      // 将结果转换为ReportData格式
      const reportData = results.map((r: any) => ({
        paperId: r.paper_id || '',
        paperTitle: r.title,
        subject: r.subject || null,
        grade: r.grade || null,
        totalScore: r.total_score,
        userScore: r.score,
        correctRate: r.total_score > 0 ? r.score / r.total_score : 0,
        submittedAt: r.created_at,
        questionStats: [],
      }))
      await exportReportAsPDF(reportData)
    } catch (err: any) {
      alert(err?.message || '导出失败')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">家长端</h1>
      <p className="text-sm text-slate-600">
        绑定孩子账号后，可查看各科考试成绩、平均分，并导出成绩。
      </p>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">家长端</h1>
          <p className="text-sm text-slate-600">
            绑定孩子账号后，可查看各科考试成绩、平均分，并导出成绩。
          </p>
        </div>
        {results.length > 0 && (
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={handleExportCsv}>
              导出CSV
            </button>
            <button className="btn btn-primary" onClick={handleExportPDF}>
              导出PDF
            </button>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">绑定孩子</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <input
            className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2"
            placeholder="输入学生账号邮箱"
            value={childEmail}
            onChange={(e) => setChildEmail(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!childEmail || bindMutation.isPending}
            onClick={() => bindMutation.mutate(childEmail)}
          >
            {bindMutation.isPending ? '绑定中...' : '绑定孩子'}
          </button>
        </div>
        {message && (
          <p className="text-xs text-amber-700">
            {message}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">孩子列表</h2>
          {children.length === 0 ? (
            <div className="card">
              <p className="text-xs text-slate-600">暂无已绑定的孩子，请先通过上方邮箱绑定。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {children.map((c: any) => (
                <button
                  key={c.user_id}
                  type="button"
                  onClick={() => setSelectedChild(c.user_id)}
                  className={`card flex w-full flex-col items-start text-left text-sm ${
                    selectedChild === c.user_id ? 'ring-2 ring-brand-200' : ''
                  }`}
                >
                  <span className="font-semibold text-slate-900">
                    {c.name || '未命名学生'}{' '}
                    <span className="ml-1 text-xs text-slate-500">
                      {c.grade || ''} {c.class || ''}
                    </span>
                  </span>
                  <span className="mt-1 text-xs text-slate-600">
                    考试次数：{c.examCount}，平均分：{c.averageScore.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">考试成绩</h2>
            <button
              className="btn btn-secondary btn-xs"
              disabled={!results.length}
              onClick={handleExportCsv}
            >
              导出 CSV
            </button>
          </div>
          {resultsLoading ? (
            <div className="card">
              <p className="text-xs text-slate-600">加载成绩中...</p>
            </div>
          ) : !selectedChild ? (
            <div className="card">
              <p className="text-xs text-slate-600">请先从左侧选择一个孩子。</p>
            </div>
          ) : results.length === 0 ? (
            <div className="card">
              <p className="text-xs text-slate-600">该孩子暂无考试记录。</p>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-slate-700">
              {results.map((r: any) => (
                <div key={r.paper_id} className="card flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{r.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      时间：{new Date(r.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {r.score.toFixed(1)} / {r.total_score}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

