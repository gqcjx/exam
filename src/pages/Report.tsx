import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getReportData, exportReportAsPDF, exportReportAsCSV, type ReportFilter } from '../api/reports'
import { useAuth } from '../context/AuthContext'

export default function Report() {
  const { session } = useAuth()
  const [subjectFilter, setSubjectFilter] = useState<string | 'all'>('all')
  const [gradeFilter, setGradeFilter] = useState<string | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<string | 'all'>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const filter: ReportFilter = useMemo(
    () => ({
      userId: session?.user?.id,
      subject: subjectFilter === 'all' ? undefined : subjectFilter,
      grade: gradeFilter === 'all' ? undefined : gradeFilter,
      questionType: typeFilter === 'all' ? undefined : typeFilter,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [session?.user?.id, subjectFilter, gradeFilter, typeFilter, startDate, endDate],
  )

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', filter],
    queryFn: () => getReportData(filter),
    enabled: !!session?.user?.id,
  })

  const subjects = useMemo(() => ['all', '数学', '语文', '英语', '物理', '化学', '科学'], [])
  const grades = useMemo(() => ['all', '七年级', '八年级', '九年级'], [])
  const types = useMemo(
    () => [
      { value: 'all', label: '全部题型' },
      { value: 'single', label: '单选' },
      { value: 'multiple', label: '多选' },
      { value: 'true_false', label: '判断' },
      { value: 'fill', label: '填空' },
      { value: 'short', label: '简答' },
    ],
    [],
  )

  const handleExportPDF = async () => {
    try {
      await exportReportAsPDF(reports)
    } catch (err: any) {
      alert(err?.message || '导出失败')
    }
  }

  const handleExportCSV = () => {
    exportReportAsCSV(reports)
  }

  if (!session) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600">请先登录以查看成绩报表。</p>
      </div>
    )
  }

  // 计算统计信息
  const stats = useMemo(() => {
    if (reports.length === 0) {
      return {
        totalPapers: 0,
        avgScore: 0,
        avgCorrectRate: 0,
        totalScore: 0,
        totalUserScore: 0,
      }
    }

    const totalScore = reports.reduce((sum, r) => sum + r.totalScore, 0)
    const totalUserScore = reports.reduce((sum, r) => sum + r.userScore, 0)
    const avgScore = totalUserScore / reports.length
    const avgCorrectRate =
      reports.reduce((sum, r) => sum + r.correctRate, 0) / reports.length

    return {
      totalPapers: reports.length,
      avgScore,
      avgCorrectRate,
      totalScore,
      totalUserScore,
    }
  }, [reports])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">成绩报表</h1>
          <p className="text-sm text-slate-600">查看详细的成绩统计和分析</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            disabled={reports.length === 0}
          >
            导出CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExportPDF}
            disabled={reports.length === 0}
          >
            导出PDF
          </button>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="card grid grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-xs text-slate-500">试卷总数</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{stats.totalPapers}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">平均得分</p>
          <p className="mt-1 text-xl font-bold text-brand-600">
            {stats.avgScore.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">平均正确率</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">
            {(stats.avgCorrectRate * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">总得分</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {stats.totalUserScore.toFixed(1)} / {stats.totalScore}
          </p>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="card flex flex-wrap gap-3 text-sm">
        <select
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? '全部学科' : s}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
        >
          {grades.map((g) => (
            <option key={g} value={g}>
              {g === 'all' ? '全部年级' : g}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="开始日期"
        />
        <input
          type="date"
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="结束日期"
        />
      </div>

      {/* 报表列表 */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-sm text-slate-600">加载报表中...</div>
        ) : reports.length === 0 ? (
          <div className="card">
            <p className="text-sm text-slate-600">暂无报表数据。</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.paperId} className="card space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-lg font-semibold text-slate-900">{report.paperTitle}</h3>
                <div className="text-sm text-slate-600">
                  <span className="mr-4">
                    得分：<span className="font-semibold text-brand-600">
                      {report.userScore.toFixed(1)}
                    </span>{' '}
                    / {report.totalScore}
                  </span>
                  <span>
                    正确率：
                    <span className="font-semibold text-emerald-600">
                      {(report.correctRate * 100).toFixed(1)}%
                    </span>
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">学科：</span>
                  <span className="ml-2 text-slate-700">{report.subject || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">年级：</span>
                  <span className="ml-2 text-slate-700">{report.grade || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">提交时间：</span>
                  <span className="ml-2 text-slate-700">
                    {new Date(report.submittedAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
              {report.questionStats.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">题型统计</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {report.questionStats.map((stat) => {
                      const typeLabels: Record<string, string> = {
                        single: '单选',
                        multiple: '多选',
                        true_false: '判断',
                        fill: '填空',
                        short: '简答',
                      }
                      const correctRate = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0
                      return (
                        <div
                          key={stat.type}
                          className="rounded-lg bg-slate-50 p-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700">
                              {typeLabels[stat.type] || stat.type}
                            </span>
                            <span className="text-slate-600">
                              {stat.correct}/{stat.total}
                            </span>
                          </div>
                          <div className="mt-1 text-slate-500">
                            正确率：{correctRate.toFixed(1)}%
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
