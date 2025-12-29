/**
 * 移动端成绩页面
 * 基于 prototype/result.html 设计
 */

import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getExamResult } from '../../api/papers'
import { useAuth } from '../../context/AuthContext'

export default function ResultMobile() {
  const { paperId } = useParams<{ paperId: string }>()
  const { session } = useAuth()

  const { data: result, isLoading } = useQuery({
    queryKey: ['examResult', paperId, session?.user.id],
    queryFn: () => (paperId ? getExamResult(paperId) : null),
    enabled: !!paperId && !!session,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 min-h-screen bg-[#f5f5f5]">
        <p className="text-gray-600">加载成绩中...</p>
      </div>
    )
  }

  if (!result || !result.paper) {
    return (
      <div className="flex items-center justify-center py-12 min-h-screen bg-[#f5f5f5]">
        <p className="text-gray-600">成绩数据不存在</p>
      </div>
    )
  }

  const { paper, answers, totalScore, userScore, correctRate } = result
  const answerMap = new Map(answers.map((a) => [a.question_id, a]))

  // 按题型统计
  const typeStats = paper.questions.reduce((acc, pq) => {
    const type = pq.question.type
    const answer = answerMap.get(pq.question.id)
    if (!acc[type]) {
      acc[type] = { total: 0, correct: 0, score: 0, maxScore: 0 }
    }
    acc[type].total++
    acc[type].maxScore += pq.score
    if (answer?.is_correct) {
      acc[type].correct++
      acc[type].score += answer.score + (answer.manual_score || 0)
    } else if (answer) {
      acc[type].score += answer.score + (answer.manual_score || 0)
    }
    return acc
  }, {} as Record<string, { total: number; correct: number; score: number; maxScore: number }>)

  const typeLabels: Record<string, string> = {
    single: '单选',
    multiple: '多选',
    true_false: '判断',
    fill: '填空',
    short: '简答',
  }

  // 错题列表
  const wrongQuestions = paper.questions.filter((pq) => {
    const answer = answerMap.get(pq.question.id)
    return answer && answer.is_correct === false
  })

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-20">
      {/* 顶部欢迎栏（参照个人主页） */}
      <div className="bg-gradient-to-r from-[#2E8B57] to-[#3da86a] text-white px-6 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <i className="fas fa-trophy text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                考试完成
              </h2>
              <p className="text-sm opacity-90">{paper.title}</p>
            </div>
          </div>
          <Link to="/dashboard" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors">
            <i className="fas fa-home"></i>
          </Link>
        </div>
        
        {/* 成绩总览卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
            <div className="text-3xl font-bold mb-1">{userScore}</div>
            <div className="text-xs opacity-90">得分 / {totalScore}分</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold">{answers.filter((a) => a.is_correct === true).length}</div>
                <div className="text-xs opacity-90 mt-0.5">正确</div>
              </div>
              <div>
                <div className="text-lg font-bold">{answers.filter((a) => a.is_correct === false).length}</div>
                <div className="text-xs opacity-90 mt-0.5">错误</div>
              </div>
              <div>
                <div className="text-lg font-bold">{(correctRate * 100).toFixed(0)}%</div>
                <div className="text-xs opacity-90 mt-0.5">正确率</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 详细结果 */}
      <div className="px-4 py-6 space-y-6">
        {/* 答题统计 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            <i className="fas fa-chart-pie text-[#2E8B57] mr-2"></i>答题统计
          </h3>
          <div className="space-y-3">
            {Object.entries(typeStats).map(([type, stats]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">{typeLabels[type] || type}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#2E8B57] rounded-full transition-all"
                      style={{ width: `${(stats.correct / stats.total) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-semibold text-gray-800 w-16 text-right">
                    {stats.correct}/{stats.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 错题列表 */}
        {wrongQuestions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              <i className="fas fa-exclamation-circle text-red-500 mr-2"></i>错题回顾
            </h3>
            <div className="space-y-3">
              {wrongQuestions.map((pq, idx) => {
                const answer = answerMap.get(pq.question.id)!
                return (
                  <div key={pq.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-red-100 text-red-700">
                            错误
                          </span>
                          <span className="text-xs text-gray-500">
                            第 {paper.questions.findIndex((q) => q.id === pq.id) + 1} 题 · {typeLabels[pq.question.type] || pq.question.type} · {pq.score}分
                          </span>
                        </div>
                        <p className="font-semibold text-gray-800 text-sm">{pq.question.stem}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="text-sm">
                        <span className="text-gray-600">您的答案：</span>
                        <span className="font-semibold text-red-600 ml-1">
                          {Array.isArray(answer.chosen) ? answer.chosen.join(', ') : answer.chosen}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">正确答案：</span>
                        <span className="font-semibold text-[#2E8B57] ml-1">
                          {Array.isArray(pq.question.answer) ? pq.question.answer.join(', ') : pq.question.answer}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="space-y-3">
          <Link
            to="/wrong-questions"
            className="block w-full py-3 bg-[#2E8B57] text-white rounded-xl font-semibold shadow-md hover:bg-[#3da86a] transition-colors text-center"
          >
            <i className="fas fa-book mr-2"></i>加入错题本
          </Link>
          <Link
            to="/dashboard"
            className="block w-full py-3 bg-white border-2 border-[#2E8B57] text-[#2E8B57] rounded-xl font-semibold hover:bg-[#f0fdf4] transition-colors text-center"
          >
            <i className="fas fa-redo mr-2"></i>返回首页
          </Link>
        </div>
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
        <Link to="/settings" className="flex flex-col items-center">
          <i className="fas fa-cog text-gray-400 text-xl"></i>
          <span className="text-xs text-gray-500 mt-1">设置</span>
        </Link>
      </div>
    </div>
  )
}
