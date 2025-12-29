/**
 * 移动端仪表盘页面
 * 基于 prototype/dashboard.html 设计
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getAvailablePapers, checkPaperCompleted } from '../../api/exams'
import { getMyGameScore } from '../../api/game'
import type { PaperInfo } from '../../api/exams'

export default function DashboardMobile() {
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
          const isCompleted = await checkPaperCompleted(paper.id, session!.user.id)
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
      <div className="flex items-center justify-center py-12 min-h-screen bg-[#f5f5f5]">
        <p className="text-gray-600">加载中...</p>
      </div>
    )
  }

  const pendingPapers = papers?.filter((p) => !completedPapers?.has(p.id)) || []
  const completedPapersList = papers?.filter((p) => completedPapers?.has(p.id)) || []

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-20 w-full">
      {/* 顶部欢迎栏 */}
      <div className="bg-gradient-to-r from-[#2E8B57] to-[#3da86a] text-white px-6 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <i className="fas fa-user text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {profile?.name || session?.user.email || '用户'}
              </h2>
              <p className="text-sm opacity-90">
                {profile?.role === 'student' ? '学生' : profile?.role === 'teacher' ? '教师' : profile?.role === 'admin' ? '管理员' : '用户'}
                {profile?.grade && profile?.class && ` · ${profile.grade}${profile.class}`}
              </p>
            </div>
          </div>
          <Link to="/settings" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
            <i className="fas fa-bell"></i>
          </Link>
        </div>
        
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <i className="fas fa-clipboard-list text-2xl opacity-80"></i>
              <span className="text-2xl font-bold">{pendingPapers.length}</span>
            </div>
            <p className="text-sm opacity-90">待考试卷</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <i className="fas fa-check-circle text-2xl opacity-80"></i>
              <span className="text-2xl font-bold">{completedPapersList.length}</span>
            </div>
            <p className="text-sm opacity-90">已完成</p>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="px-4 py-6 space-y-6">
        {/* 快速入口 */}
        <div className="grid grid-cols-4 gap-3">
          <Link to="/wrong-questions" className="bg-white rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <i className="fas fa-book text-[#2E8B57] text-xl mb-2"></i>
            <p className="text-xs text-gray-600">错题本</p>
          </Link>
          <Link to="/ranking" className="bg-white rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <i className="fas fa-trophy text-[#FFA500] text-xl mb-2"></i>
            <p className="text-xs text-gray-600">排行榜</p>
          </Link>
          <Link to="/report" className="bg-white rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <i className="fas fa-chart-line text-[#2E8B57] text-xl mb-2"></i>
            <p className="text-xs text-gray-600">成绩报表</p>
          </Link>
          <Link to="/settings" className="bg-white rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <i className="fas fa-cog text-gray-400 text-xl mb-2"></i>
            <p className="text-xs text-gray-600">设置</p>
          </Link>
        </div>

        {/* 游戏入口（仅学生） */}
        {profile?.role === 'student' && (
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/game/dazui"
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center space-x-3 mb-2">
                <i className="fas fa-gamepad text-[#2E8B57] text-xl"></i>
                <span className="font-semibold text-gray-800">大嘴鸟游戏</span>
              </div>
              {gameScore && (
                <p className="text-xs text-gray-600">
                  最高分：{gameScore.best_score} · Lv.{gameScore.level}
                </p>
              )}
            </Link>
            <Link
              to="/game/ranking"
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center space-x-3 mb-2">
                <i className="fas fa-trophy text-[#FFA500] text-xl"></i>
                <span className="font-semibold text-gray-800">游戏排行</span>
              </div>
              <p className="text-xs text-gray-600">查看排名</p>
            </Link>
          </div>
        )}

        {/* 待考试卷 */}
        {profile?.role === 'student' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                <i className="fas fa-clock text-[#2E8B57] mr-2"></i>待考试卷
              </h3>
              {papersLoading && <span className="text-xs text-gray-500">加载中...</span>}
            </div>
            {papersLoading ? (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-600">加载试卷列表中...</p>
              </div>
            ) : pendingPapers.length === 0 ? (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm text-gray-600">暂无待考试卷</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingPapers.map((paper) => (
                  <PaperCardMobile key={paper.id} paper={paper} isCompleted={false} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 已完成试卷 */}
        {profile?.role === 'student' && completedPapersList.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                <i className="fas fa-check-circle text-[#2E8B57] mr-2"></i>已完成试卷
              </h3>
            </div>
            <div className="space-y-3">
              {completedPapersList.map((paper) => (
                <PaperCardMobile key={paper.id} paper={paper} isCompleted={true} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部导航栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 flex justify-around items-center py-3 z-50">
        <Link to="/dashboard" className="flex flex-col items-center">
          <i className="fas fa-home text-[#2E8B57] text-xl"></i>
          <span className="text-xs text-[#2E8B57] mt-1">首页</span>
        </Link>
        <Link to="/wrong-questions" className="flex flex-col items-center">
          <i className="fas fa-book text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">错题本</span>
        </Link>
        <Link to="/ranking" className="flex flex-col items-center">
          <i className="fas fa-trophy text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">排行榜</span>
        </Link>
        <Link to="/settings" className="flex flex-col items-center">
          <i className="fas fa-cog text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">设置</span>
        </Link>
      </div>
    </div>
  )
}

function PaperCardMobile({ paper, isCompleted }: { paper: PaperInfo; isCompleted: boolean }) {
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

  const statusBadge = isCompleted ? (
    <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium bg-[#d4edda] text-[#155724]">
      <i className="fas fa-check mr-1"></i>已完成
    </span>
  ) : timeStatus === 'not-started' ? (
    <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium bg-[#FFFACD] text-[#856404]">
      <i className="fas fa-clock mr-1"></i>待考
    </span>
  ) : timeStatus === 'ended' ? (
    <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium bg-red-100 text-red-700">
      <i className="fas fa-times mr-1"></i>已结束
    </span>
  ) : (
    <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium bg-[#cfe2ff] text-[#084298]">
      <i className="fas fa-play mr-1"></i>进行中
    </span>
  )

  return (
    <Link
      to={isCompleted ? `/result/${paper.id}` : `/exam/${paper.id}`}
      className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all block"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800 mb-1">{paper.title}</h4>
          <p className="text-sm text-gray-500">{paper.subject || '综合测试'}</p>
        </div>
        {statusBadge}
      </div>
      <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
        <span><i className="far fa-clock mr-1"></i>{paper.duration_minutes}分钟</span>
        <span><i className="fas fa-star mr-1"></i>{paper.total_score}分</span>
      </div>
      <button className="w-full py-2 bg-[#2E8B57] text-white rounded-lg font-medium hover:bg-[#3da86a] transition-colors">
        {isCompleted ? '查看成绩' : '开始考试'}
      </button>
    </Link>
  )
}
