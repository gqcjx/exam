import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Gamepad2, Trophy } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getAvailablePapers, checkPaperCompleted } from '../api/exams'
import { getMyGameScore } from '../api/game'
import { AdminDashboard } from '../components/AdminDashboard'
import type { PaperInfo } from '../api/exams'

export default function Dashboard() {
  const { session, profile, loading: authLoading } = useAuth()

  // 加载可用试卷
  const { data: papers, isLoading: papersLoading } = useQuery({
    queryKey: ['available-papers'],
    queryFn: getAvailablePapers,
    enabled: !!session,
  })

  // 检查每个试卷的完成状态
  const { data: completedPapers } = useQuery({
    queryKey: ['completed-papers', session?.user.id, papers?.map((p) => p.id)],
    queryFn: async () => {
      if (!session?.user.id || !papers) return new Set<string>()
      const completed = new Set<string>()
      await Promise.all(
        papers.map(async (paper) => {
          const isCompleted = await checkPaperCompleted(paper.id, session.user.id)
          if (isCompleted) completed.add(paper.id)
        })
      )
      return completed
    },
    enabled: !!session?.user.id && !!papers && papers.length > 0,
  })

  // 获取游戏积分（仅学生）
  const { data: gameScore } = useQuery({
    queryKey: ['my-game-score', session?.user.id],
    queryFn: () => getMyGameScore('dazui'),
    enabled: !!session && profile?.role === 'student',
  })

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">加载中...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">首页概览</h1>
        <p className="text-sm text-slate-600">请先登录以查看您的考试和成绩。</p>
      </div>
    )
  }

  const pendingPapers = papers?.filter((p) => !completedPapers?.has(p.id)) || []
  const completedPapersList = papers?.filter((p) => completedPapers?.has(p.id)) || []

  // 简单“待办与提醒”：即将开始/刚结束的考试
  const reminders = useMemo(() => {
    if (!papers) return []
    const now = Date.now()
    const soonThreshold = 3 * 24 * 60 * 60 * 1000 // 3 天内
    return pendingPapers
      .map((p) => {
        // 这里先用 created_at 近似考试发布日期，后续可加开始时间/截止时间字段
        const created = (p as any).created_at ? new Date((p as any).created_at).getTime() : now
        const diff = created + p.duration_minutes * 60 * 1000 - now
        if (diff < 0 && diff > -soonThreshold) {
          return { type: 'recent', paper: p }
        }
        if (diff >= 0 && diff < soonThreshold) {
          return { type: 'upcoming', paper: p }
        }
        return null
      })
      .filter(Boolean) as { type: 'recent' | 'upcoming'; paper: PaperInfo }[]
  }, [papers, pendingPapers])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">首页概览</h1>
        {profile && (
          <div className="text-sm text-slate-600">
            <span className="font-semibold">{profile?.name || session?.user?.email || '用户'}</span>
            {profile?.role && <span className="ml-2 text-slate-500">({profile.role})</span>}
          </div>
        )}
      </div>

      <p className="text-sm text-slate-600">
        欢迎回来！{profile ? `当前角色：${profile.role}` : '正在加载用户信息...'}
      </p>

      {/* 学生端游戏入口 */}
      {profile?.role === 'student' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/game/dazui"
            className="card block transition hover:shadow-md border-2 border-brand-200 hover:border-brand-400 bg-gradient-to-br from-brand-50 to-white"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-brand-600 flex items-center justify-center">
                  <Gamepad2 className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">大嘴鸟游戏</h3>
                <p className="text-xs text-slate-600 mb-2">字词学习游戏，寓教于乐</p>
                {gameScore && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-600">最高分：<strong className="text-brand-600">{gameScore.best_score}</strong></span>
                    <span className="text-slate-600">等级：<strong className="text-brand-600">Lv.{gameScore.level}</strong></span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                <span className="btn btn-primary text-xs">开始游戏</span>
              </div>
            </div>
          </Link>
          <Link
            to="/game/ranking"
            className="card block transition hover:shadow-md border-2 border-slate-200 hover:border-slate-300"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-xl bg-amber-500 flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">游戏排行榜</h3>
                <p className="text-xs text-slate-600">查看所有学生的游戏成绩排名</p>
              </div>
              <div className="flex-shrink-0">
                <span className="btn btn-secondary text-xs">查看排名</span>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* 学生端待办与提醒 */}
      {profile?.role === 'student' && reminders.length > 0 && (
        <div className="card space-y-2 border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-800">考试提醒</h2>
            <span className="text-xs text-amber-700">共 {reminders.length} 条</span>
          </div>
          <ul className="space-y-1 text-xs text-amber-800">
            {reminders.slice(0, 5).map((item) => (
              <li key={item.paper.id} className="flex items-center justify-between">
                <span>
                  {item.type === 'upcoming' ? '即将开始：' : '近期完成：'}
                  {item.paper.title}
                </span>
                <Link
                  to={`/exam/${item.paper.id}`}
                  className="text-xs font-semibold text-amber-900 underline"
                >
                  去查看
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 待考试卷 */}
      {profile?.role === 'student' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">待考试卷</h2>
            {papersLoading && <span className="text-xs text-slate-500">加载中...</span>}
          </div>
          {papersLoading ? (
            <div className="card">
              <p className="text-sm text-slate-600">加载试卷列表中...</p>
            </div>
          ) : pendingPapers.length === 0 ? (
            <div className="card">
              <p className="text-sm text-slate-600">暂无待考试卷</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingPapers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} isCompleted={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 已完成试卷 */}
      {profile?.role === 'student' && completedPapersList.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">已完成试卷</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completedPapersList.map((paper) => (
              <PaperCard key={paper.id} paper={paper} isCompleted={true} />
            ))}
          </div>
        </div>
      )}

      {/* 教师/管理员显示 */}
      {(profile?.role === 'teacher' || profile?.role === 'admin') && (
        <AdminDashboard />
      )}
    </div>
  )
}

function PaperCard({ paper, isCompleted }: { paper: PaperInfo; isCompleted: boolean }) {
  const now = new Date()
  const startTime = (paper as any).start_time ? new Date((paper as any).start_time) : null
  const endTime = (paper as any).end_time ? new Date((paper as any).end_time) : null
  
  let timeStatus: 'not-started' | 'in-progress' | 'ended' | null = null
  if (startTime && now < startTime) {
    timeStatus = 'not-started'
  } else if (endTime && now > endTime) {
    timeStatus = 'ended'
  } else if (startTime || endTime) {
    timeStatus = 'in-progress'
  }

  return (
    <Link
      to={isCompleted ? `/result/${paper.id}` : `/exam/${paper.id}`}
      className="card block transition hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{paper.title}</h3>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            {paper.subject && <p>学科：{paper.subject}</p>}
            {paper.grade && <p>年级：{paper.grade}</p>}
            <p>时长：{paper.duration_minutes} 分钟</p>
            <p>总分：{paper.total_score} 分</p>
            {startTime && (
              <p className="text-amber-600">
                开始时间：{startTime.toLocaleString('zh-CN')}
                {now < startTime && '（未开始）'}
              </p>
            )}
            {endTime && (
              <p className={now > endTime ? 'text-red-600' : 'text-slate-600'}>
                结束时间：{endTime.toLocaleString('zh-CN')}
                {now > endTime && '（已结束）'}
              </p>
            )}
          </div>
        </div>
        <div className="ml-3">
          {isCompleted ? (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
              已完成
            </span>
          ) : timeStatus === 'not-started' ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
              未开始
            </span>
          ) : timeStatus === 'ended' ? (
            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
              已结束
            </span>
          ) : (
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
              开始考试
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
