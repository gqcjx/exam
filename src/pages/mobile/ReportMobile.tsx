/**
 * 移动端成绩报表页面
 * 统一移动端设计风格
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getReportData, exportReportAsPDF, exportReportAsCSV, type ReportFilter } from '../../api/reports'
import { useAuth } from '../../context/AuthContext'

export default function ReportMobile() {
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

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-gray-600">请先登录以查看成绩报表。</p>
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
              <i className="fas fa-chart-line text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                成绩报表
              </h2>
              <p className="text-sm opacity-90">查看详细的成绩统计和分析</p>
            </div>
          </div>
          <Link to="/dashboard" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
            <i className="fas fa-home"></i>
          </Link>
        </div>
        
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <div className="text-lg font-bold">{stats.totalPapers}</div>
            <div className="text-xs opacity-90 mt-1">试卷数</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <div className="text-lg font-bold">{stats.avgScore.toFixed(1)}</div>
            <div className="text-xs opacity-90 mt-1">平均分</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <div className="text-lg font-bold">{(stats.avgCorrectRate * 100).toFixed(0)}%</div>
            <div className="text-xs opacity-90 mt-1">正确率</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <div className="text-lg font-bold">{stats.totalUserScore.toFixed(0)}</div>
            <div className="text-xs opacity-90 mt-1">总得分</div>
          </div>
        </div>
      </div>

      {/* 导出按钮 */}
      <div className="px-4 py-3 flex gap-2">
        <button
          className="flex-1 py-2 bg-white border-2 border-[#2E8B57] text-[#2E8B57] rounded-lg font-medium hover:bg-[#f0fdf4] transition-colors disabled:opacity-50"
          onClick={handleExportCSV}
          disabled={reports.length === 0}
        >
          <i className="fas fa-file-csv mr-2"></i>导出CSV
        </button>
        <button
          className="flex-1 py-2 bg-[#2E8B57] text-white rounded-lg font-medium hover:bg-[#3da86a] transition-colors disabled:opacity-50"
          onClick={handleExportPDF}
          disabled={reports.length === 0}
        >
          <i className="fas fa-file-pdf mr-2"></i>导出PDF
        </button>
      </div>

      {/* 筛选器 */}
      <div className="px-4 py-2">
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">学科</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? '全部学科' : s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">年级</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
              >
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g === 'all' ? '全部年级' : g}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">题型</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">开始日期</label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">结束日期</label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#2E8B57]"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 报表列表 */}
      <div className="px-4 pb-6 space-y-3">
        {isLoading ? (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-sm text-gray-600">加载报表中...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <i className="fas fa-chart-line text-4xl text-gray-300 mb-3"></i>
            <p className="text-sm text-gray-600">暂无报表数据。</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.paperId} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              {/* 报表头部 */}
              <div className="flex items-start justify-between pb-3 border-b border-gray-100">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{report.paperTitle}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {report.subject && <span>{report.subject}</span>}
                    {report.grade && <span>· {report.grade}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[#2E8B57]">
                    {report.userScore.toFixed(1)} / {report.totalScore}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {(report.correctRate * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* 提交时间 */}
              <div className="text-xs text-gray-500">
                <i className="far fa-clock mr-1"></i>
                提交时间：{new Date(report.submittedAt).toLocaleString('zh-CN')}
              </div>

              {/* 题型统计 */}
              {report.questionStats.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">题型统计</h4>
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
                          className="bg-gray-50 rounded-lg p-2"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-700">
                              {typeLabels[stat.type] || stat.type}
                            </span>
                            <span className="text-xs text-gray-600">
                              {stat.correct}/{stat.total}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
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
          <i className="fas fa-trophy text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">排行榜</span>
        </Link>
        <Link to="/report" className="flex flex-col items-center">
          <i className="fas fa-chart-line text-[#2E8B57] text-xl"></i>
          <span className="text-xs text-[#2E8B57] mt-1">报表</span>
        </Link>
      </div>
    </div>
  )
}
