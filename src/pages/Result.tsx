import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getExamResult } from '../api/papers'
import { QuestionPreview } from '../components/QuestionPreview'
import { QuestionAnswer } from '../components/QuestionAnswer'
import { useAuth } from '../context/AuthContext'

export default function Result() {
  const { paperId } = useParams<{ paperId: string }>()
  const { session } = useAuth()

  const { data: result, isLoading } = useQuery({
    queryKey: ['examResult', paperId, session?.user.id],
    queryFn: () => (paperId ? getExamResult(paperId) : null),
    enabled: !!paperId && !!session,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">加载成绩中...</p>
      </div>
    )
  }

  if (!result || !result.paper) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">成绩数据不存在</p>
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

  // 待批阅的简答题
  const pendingQuestions = paper.questions.filter((pq) => {
    const answer = answerMap.get(pq.question.id)
    return pq.question.type === 'short' && answer?.status === 'pending'
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{paper.title}</h1>
        <p className="text-sm text-slate-600">
          {paper.subject && `${paper.subject} · `}
          {paper.grade && `${paper.grade}`}
        </p>
      </div>

      {/* 成绩概览 */}
      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs text-slate-500">总分</p>
              <p className="text-3xl font-bold text-slate-900">
                {userScore} <span className="text-lg text-slate-500">/ {totalScore}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">正确率</p>
              <p className="text-2xl font-semibold text-emerald-600">{(correctRate * 100).toFixed(1)}%</p>
            </div>
          </div>

          {/* 题型统计 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">题型得分</p>
            {Object.entries(typeStats).map(([type, stats]) => (
              <div key={type} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-700">{typeLabels[type] || type}</span>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-600">
                    {stats.correct}/{stats.total}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {stats.score}/{stats.maxScore} 分
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="card">
            <p className="text-sm font-semibold text-slate-800">答题情况</p>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>总题数</span>
                <span className="font-semibold text-slate-900">{paper.questions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>正确题数</span>
                <span className="font-semibold text-emerald-600">
                  {answers.filter((a) => a.is_correct === true).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>错误题数</span>
                <span className="font-semibold text-red-600">
                  {answers.filter((a) => a.is_correct === false).length}
                </span>
              </div>
              {pendingQuestions.length > 0 && (
                <div className="flex items-center justify-between">
                  <span>待批阅</span>
                  <span className="font-semibold text-amber-600">{pendingQuestions.length}</span>
                </div>
              )}
            </div>
          </div>

          {paper.allow_review && (
            <div className="card bg-blue-50">
              <p className="text-xs text-blue-700">可查看解析：已开启</p>
            </div>
          )}
        </div>
      </div>

      {/* 错题列表 */}
      {wrongQuestions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">错题解析</h2>
          {wrongQuestions.map((pq, idx) => {
            const answer = answerMap.get(pq.question.id)!
            return (
              <div key={pq.id} className="card space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-sm font-semibold text-slate-700">
                    错题 {idx + 1} · {typeLabels[pq.question.type] || pq.question.type} · {pq.score} 分
                  </span>
                  <span className="text-xs text-red-600">得分：{answer.score + (answer.manual_score || 0)}/{pq.score}</span>
                </div>
                <QuestionPreview question={pq.question} />
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-700">我的答案：</p>
                  <div className="mt-1">
                    <QuestionAnswer
                      question={pq.question}
                      value={answer.chosen as string[] | string}
                      onChange={() => {}}
                      disabled
                      showAnswer={paper.allow_review}
                    />
                  </div>
                </div>
                {paper.allow_review && pq.question.analysis && (
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-700">解析：</p>
                    <p className="mt-1 text-sm text-emerald-900">{pq.question.analysis}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 待批阅简答题提示 */}
      {pendingQuestions.length > 0 && (
        <div className="card bg-amber-50">
          <p className="text-sm font-semibold text-amber-700">
            有 {pendingQuestions.length} 道简答题待教师批阅，批阅完成后可查看完整成绩。
          </p>
        </div>
      )}

      {/* 全部题目列表（可展开查看） */}
      {paper.allow_review && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">全部题目</h2>
          {paper.questions.map((pq, idx) => {
            const answer = answerMap.get(pq.question.id)
            const isCorrect = answer?.is_correct
            return (
              <div key={pq.id} className="card space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-sm font-semibold text-slate-700">
                    第 {idx + 1} 题 · {typeLabels[pq.question.type] || pq.question.type} · {pq.score} 分
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isCorrect === true
                        ? 'text-emerald-600'
                        : isCorrect === false
                          ? 'text-red-600'
                          : 'text-amber-600'
                    }`}
                  >
                    {answer
                      ? `得分：${answer.score + (answer.manual_score || 0)}/${pq.score}`
                      : '未作答'}
                  </span>
                </div>
                <QuestionPreview question={pq.question} />
                {answer && (
                  <div className={`rounded-lg p-3 ${isCorrect ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className={`text-xs font-semibold ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                      我的答案：
                    </p>
                    <div className="mt-1">
                      <QuestionAnswer
                        question={pq.question}
                        value={answer.chosen as string[] | string}
                        onChange={() => {}}
                        disabled
                        showAnswer={paper.allow_review}
                      />
                    </div>
                  </div>
                )}
                {paper.allow_review && pq.question.analysis && (
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-semibold text-blue-700">解析：</p>
                    <p className="mt-1 text-sm text-blue-900">{pq.question.analysis}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
