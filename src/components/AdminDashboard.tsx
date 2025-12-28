import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getDashboardStats, getPendingGradings } from '../api/admin'
import { useAuth } from '../context/AuthContext'

export function AdminDashboard() {
  const { profile } = useAuth()
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => getDashboardStats(),
    // 验证和清理数据
    select: (data) => {
      if (!data) return null
      // 确保 recent_papers 是数组且每个元素都有必要的字段
      return {
        ...data,
        recent_papers: (data.recent_papers || []).filter(
          (p: any) => p && p.id && p.title
        ),
      }
    },
    // 如果数据无效，重新获取
    retry: (failureCount, error) => {
      if (failureCount < 2) return true
      return false
    },
  })

  const { data: pendings = [], error: pendingsError } = useQuery({
    queryKey: ['pending-gradings-short'],
    queryFn: () => getPendingGradings({ limit: 5 }),
    // 验证和清理数据
    select: (data) => {
      if (!Array.isArray(data)) return []
      // 过滤掉无效的数据
      return data.filter((item: any) => {
        return (
          item &&
          item.id &&
          item.paper_title !== undefined &&
          item.user_name !== undefined
        )
      })
    },
    // 如果数据无效，重新获取
    retry: (failureCount, error) => {
      if (failureCount < 2) return true
      return false
    },
  })

  if (statsLoading) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600">加载中...</p>
      </div>
    )
  }

  if (statsError) {
    return (
      <div className="card bg-red-50 border-red-200">
        <p className="text-sm text-red-700">加载数据失败，请刷新页面重试</p>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  // 确保 stats.recent_papers 存在且是数组
  if (!Array.isArray(stats.recent_papers)) {
    stats.recent_papers = []
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">管理概览</h2>
        {profile && (
          <p className="mt-1 text-xs text-slate-500">
            当前角色：{profile.role}（仅管理员/教师可访问本模块）
          </p>
        )}
      </div>
      {/* 统计卡片 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="总试卷数" value={stats.total_papers.toString()} />
        <StatCard title="已发布试卷" value={stats.published_papers.toString()} />
        <StatCard title="总提交数" value={stats.total_submissions.toString()} />
        <StatCard
          title="待批阅简答题"
          value={stats.pending_gradings.toString()}
          link="/admin/grading"
          linkText="去批阅"
        />
      </div>

      {/* 待批阅简答题 */}
      {pendings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">待批阅简答题</h2>
            <Link to="/admin/grading" className="text-sm text-brand-600 hover:text-brand-700">
              查看全部 →
            </Link>
          </div>
          <div className="space-y-2">
            {pendings
              .filter((item) => item && item.id)
              .slice(0, 3)
              .map((item) => (
              <Link
                key={item.id}
                to="/admin/grading"
                className="card block transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{item.paper_title || '未知试卷'}</p>
                    <p className="mt-1 text-xs text-slate-600">
                        学生：{item.user_name || '未知'} | 提交时间：{item.submitted_at ? new Date(item.submitted_at).toLocaleString('zh-CN') : '未知'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {Array.isArray(item.chosen) ? item.chosen.join(' ') : item.chosen || '无答案'}
                    </p>
                  </div>
                  <span className="ml-3 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                    待批阅
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 最近创建的试卷 */}
      {stats.recent_papers && stats.recent_papers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">最近创建的试卷</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.recent_papers
              .filter((paper) => paper && paper.id && paper.title)
              .map((paper) => (
              <Link
                key={paper.id}
                to={`/admin/papers`}
                className="card block transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">{paper.title || '未命名试卷'}</h3>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      {paper.subject && <p>学科：{paper.subject}</p>}
                      <p>题目数：{paper.question_count || 0} | 提交数：{paper.submission_count || 0}</p>
                        <p>创建时间：{paper.created_at ? new Date(paper.created_at).toLocaleString('zh-CN') : '未知'}</p>
                    </div>
                  </div>
                  {paper.published && (
                    <span className="ml-3 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      已发布
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  link,
  linkText,
}: {
  title: string
  value: string
  link?: string
  linkText?: string
}) {
  // 如果同时有 link 和 linkText，只使用内部的链接，避免嵌套链接
  if (link && linkText) {
    return (
      <div className="card">
        <p className="text-xs text-slate-600">{title}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        <Link to={link} className="mt-2 text-xs text-brand-600 hover:text-brand-700">
          {linkText} →
        </Link>
      </div>
    )
  }

  // 如果只有 link 没有 linkText，整个卡片可点击
  if (link) {
    return (
      <Link to={link} className="card block transition hover:shadow-md">
        <p className="text-xs text-slate-600">{title}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      </Link>
    )
  }

  // 没有链接，普通卡片
  return (
    <div className="card">
      <p className="text-xs text-slate-600">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

