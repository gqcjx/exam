import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPaperStats, getPaperList, type PaperStats } from '../api/admin'
import { getRanking } from '../api/ranking'
import { exportReportAsPDF, exportReportAsCSV } from '../api/reportExport'
import { isSupabaseReady } from '../lib/env'

export default function AdminStats() {
  const { data: papers = [] } = useQuery({
    queryKey: ['paper-list-for-stats'],
    queryFn: () => getPaperList(),
  })

  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null)

  const { data: paperStats, isLoading } = useQuery({
    queryKey: ['paper-stats', selectedPaperId],
    queryFn: () => (selectedPaperId ? getPaperStats(selectedPaperId) : null),
    enabled: !!selectedPaperId,
  })

  if (!isSupabaseReady) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">成绩统计</h1>
        <div className="card">
          <p className="text-sm text-amber-700">Supabase 未配置，无法使用此功能</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">成绩统计</h1>
        <p className="text-sm text-slate-600">查看试卷成绩统计分析，包括平均分、及格率等指标</p>
      </div>

      {/* 选择试卷 */}
      <div className="card">
        <label className="mb-2 block text-sm font-semibold text-slate-700">选择试卷</label>
        <select
          value={selectedPaperId || ''}
          onChange={(e) => setSelectedPaperId(e.target.value || null)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">请选择试卷...</option>
          {papers.map((paper) => (
            <option key={paper.id} value={paper.id}>
              {paper.title} {paper.published ? '(已发布)' : '(未发布)'}
            </option>
          ))}
        </select>
      </div>

      {/* 统计展示 */}
      {selectedPaperId && (
        <>
          {isLoading ? (
            <div className="card">
              <p className="text-sm text-slate-600">加载中...</p>
            </div>
          ) : paperStats ? (
            <PaperStatsDisplay stats={paperStats} />
          ) : (
            <div className="card">
              <p className="text-sm text-slate-600">暂无统计数据</p>
            </div>
          )}
        </>
      )}

      {!selectedPaperId && (
        <div className="card">
          <p className="text-sm text-slate-600">请选择一个试卷查看统计信息</p>
        </div>
      )}
    </div>
  )
}

function PaperStatsDisplay({ stats }: { stats: PaperStats }) {
  const passRatePercent = (stats.pass_rate * 100).toFixed(1)
  const [isExporting, setIsExporting] = useState(false)

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      await exportReportAsPDF(stats.paper_id)
    } catch (err: any) {
      alert(err?.message || '导出失败')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportCSV = async () => {
    setIsExporting(true)
    try {
      await exportReportAsCSV(stats.paper_id)
    } catch (err: any) {
      alert(err?.message || '导出失败')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 导出按钮 */}
      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          onClick={handleExportPDF}
          disabled={isExporting}
        >
          {isExporting ? '导出中...' : '导出PDF报表'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleExportCSV}
          disabled={isExporting}
        >
          {isExporting ? '导出中...' : '导出CSV报表'}
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="总提交数" value={stats.total_submissions.toString()} />
        <StatCard title="平均分" value={stats.average_score.toFixed(1)} unit="分" />
        <StatCard title="最高分" value={stats.highest_score.toFixed(1)} unit="分" />
        <StatCard title="最低分" value={stats.lowest_score.toFixed(1)} unit="分" />
        <StatCard title="及格率" value={passRatePercent} unit="%" />
      </div>

      {/* 可视化图表 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 平均分柱状图（简化版） */}
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">平均分</h3>
          <div className="relative h-32 w-full">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t bg-brand-500 transition-all"
              style={{
                height: `${Math.min((stats.average_score / stats.highest_score) * 100, 100)}%`,
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-1">
              <span className="text-xs font-semibold text-white">{stats.average_score.toFixed(1)}</span>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-slate-600">满分：{stats.highest_score}</p>
        </div>

        {/* 及格率饼图（简化版） */}
        <div className="card">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">及格率分布</h3>
          <div className="flex items-center justify-center">
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeDasharray={`${stats.pass_rate * 251.2} 251.2`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-slate-900">{passRatePercent}%</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-slate-600">及格</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-slate-200" />
              <span className="text-slate-600">不及格</span>
            </div>
          </div>
        </div>
      </div>

      {/* 详细数据表格 */}
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">详细数据</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2 text-left font-semibold text-slate-700">指标</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-700">数值</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-600">试卷名称</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900">{stats.paper_title}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-600">总提交数</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900">{stats.total_submissions}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-600">平均分</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900">{stats.average_score.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-600">最高分</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900">{stats.highest_score.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-600">最低分</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900">{stats.lowest_score.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-slate-600">及格率</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-900">{passRatePercent}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, unit }: { title: string; value: string; unit?: string }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-600">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
        {unit && <span className="ml-1 text-base font-normal text-slate-600">{unit}</span>}
      </p>
    </div>
  )
}
