import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getPaperWithQuestions, submitAnswers, saveDraft, loadDraft } from '../api/papers'
import { saveDraftLocal, loadDraftLocal, clearDraftLocal } from '../lib/draftStorage'
import { QuestionAnswer } from '../components/QuestionAnswer'
import { useAuth } from '../context/AuthContext'

export default function Exam() {
  const { paperId } = useParams<{ paperId: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[] | string>>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focusLossCount, setFocusLossCount] = useState(0)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFocusTimeRef = useRef<number>(Date.now())

  // 加载试卷
  const { data: paper, isLoading } = useQuery({
    queryKey: ['paper', paperId],
    queryFn: () => (paperId ? getPaperWithQuestions(paperId) : null),
    enabled: !!paperId,
  })

  // 检查时间限制
  useEffect(() => {
    if (!paper) return

    const now = new Date()
    const startTime = paper.start_time ? new Date(paper.start_time) : null
    const endTime = paper.end_time ? new Date(paper.end_time) : null

    if (startTime && now < startTime) {
      const timeUntilStart = Math.ceil((startTime.getTime() - now.getTime()) / 1000 / 60)
      alert(`考试尚未开始，将在 ${timeUntilStart} 分钟后开始。`)
      navigate('/dashboard')
      return
    }

    if (endTime && now > endTime) {
      alert('考试已结束，无法继续答题。')
      navigate('/dashboard')
      return
    }
  }, [paper, navigate])

  // 初始化倒计时
  useEffect(() => {
    if (!paper) return

    const duration = paper.duration_minutes * 60 * 1000 // 转为毫秒
    const now = Date.now()
    const endTime = paper.end_time ? new Date(paper.end_time).getTime() : null

    // 若有结束时间，则以结束时间为准，否则用时长控制
    let initialRemaining = duration
    if (endTime) {
      initialRemaining = Math.max(0, endTime - now)
    }

    setTimeRemaining(initialRemaining)

    const startedAt = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt
      let remaining = Math.max(0, duration - elapsed)

      if (endTime) {
        remaining = Math.min(remaining, Math.max(0, endTime - Date.now()))
      }
      setTimeRemaining(remaining)

      if (remaining === 0) {
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [paper])

  // 加载草稿
  useEffect(() => {
    if (!paperId || !paper) return

    const loadSavedDraft = async () => {
      // 先尝试加载本地草稿
      const localDraft = await loadDraftLocal(paperId)
      if (localDraft) {
        setAnswers(localDraft)
      }

      // 再尝试加载远程草稿
      const remoteDraft = await loadDraft(paperId)
      if (remoteDraft) {
        setAnswers(remoteDraft)
        // 同步到本地
        await saveDraftLocal(paperId, remoteDraft)
      }
    }

    loadSavedDraft()
  }, [paperId, paper])

  // 自动保存草稿（节流）
  useEffect(() => {
    if (!paperId || Object.keys(answers).length === 0) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(async () => {
      // 同时保存到本地和远程
      await saveDraftLocal(paperId, answers)
      await saveDraft(paperId, answers)
    }, 3000) // 3秒节流

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [answers, paperId])

  // 格式化倒计时显示
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // 处理答案变化
  const handleAnswerChange = useCallback((questionId: string, value: string[] | string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }))

    // 自动跳转到下一题
    const currentQuestion = questions.find((pq) => pq.question.id === questionId)
    if (currentQuestion) {
      const questionType = currentQuestion.question.type
      
      // 根据题目类型决定跳转时机
      if (questionType === 'single' || questionType === 'true_false') {
        // 单选题和判断题：立即跳转
        setTimeout(() => {
          const currentIdx = questions.findIndex((pq) => pq.question.id === questionId)
          if (currentIdx >= 0 && currentIdx < questions.length - 1) {
            setCurrentIndex(currentIdx + 1)
          }
        }, 300) // 300ms 延迟，让用户看到选择效果
      } else if (questionType === 'multiple') {
        // 多选题：延迟跳转，给用户时间选择多个选项
        setTimeout(() => {
          const currentIdx = questions.findIndex((pq) => pq.question.id === questionId)
          if (currentIdx >= 0 && currentIdx < questions.length - 1) {
            setCurrentIndex(currentIdx + 1)
          }
        }, 800) // 800ms 延迟
      } else if (questionType === 'fill') {
        // 填空题：延迟跳转，使用防抖
        setTimeout(() => {
          const currentIdx = questions.findIndex((pq) => pq.question.id === questionId)
          if (currentIdx >= 0 && currentIdx < questions.length - 1) {
            setCurrentIndex(currentIdx + 1)
          }
        }, 1000) // 1秒延迟，给用户时间完成输入
      }
      // 简答题（short）不自动跳转，让用户手动点击下一题
    }
  }, [questions])

  // 提交试卷
  const submitMutation = useMutation({
    mutationFn: () => {
      if (!paperId) throw new Error('试卷ID不存在')
      return submitAnswers(paperId, answers)
    },
    onSuccess: async () => {
      // 清除草稿
      if (paperId) {
        await clearDraftLocal(paperId)
      }
      // 跳转到成绩页面
      navigate(`/result/${paperId}`)
    },
    onError: (error: any) => {
      alert(`提交失败：${error.message}`)
      setIsSubmitting(false)
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!paper) return

    if (confirm('确定要提交试卷吗？提交后将无法修改。')) {
      setIsSubmitting(true)
      submitMutation.mutate()
    }
  }, [paper, submitMutation])

  // 时间到自动交卷
  useEffect(() => {
    if (timeRemaining === 0 && !isSubmitting) {
      handleSubmit()
    }
  }, [timeRemaining, isSubmitting, handleSubmit])

  // 防作弊：监听切屏/失焦
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const now = Date.now()
        const timeSinceLastFocus = now - lastFocusTimeRef.current
        
        // 如果离开时间超过5秒，记录一次切屏
        if (timeSinceLastFocus > 5000) {
          setFocusLossCount((prev) => {
            const next = prev + 1
            if (next === 1) {
              setWarningMessage('检测到您离开了考试页面，请保持专注。')
              setTimeout(() => setWarningMessage(null), 3000)
            } else if (next === 3) {
              setWarningMessage('多次离开考试页面，系统已记录异常行为。')
              setTimeout(() => setWarningMessage(null), 5000)
            } else if (next >= 5) {
              setWarningMessage('检测到多次异常行为，系统将自动交卷。')
              setTimeout(() => {
                if (!isSubmitting) {
                  handleSubmit()
                }
              }, 2000)
            }
            return next
          })
        }
      } else {
        lastFocusTimeRef.current = Date.now()
      }
    }

    const handleBlur = () => {
      lastFocusTimeRef.current = Date.now()
    }

    const handleFocus = () => {
      const now = Date.now()
      const timeSinceLastFocus = now - lastFocusTimeRef.current
      if (timeSinceLastFocus > 5000) {
        setFocusLossCount((prev) => prev + 1)
      }
      lastFocusTimeRef.current = now
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isSubmitting])

  // 防作弊：禁用复制粘贴和右键菜单
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      setWarningMessage('考试期间禁止复制内容')
      setTimeout(() => setWarningMessage(null), 2000)
      return false
    }

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      setWarningMessage('考试期间禁止粘贴内容')
      setTimeout(() => setWarningMessage(null), 2000)
      return false
    }

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault()
      setWarningMessage('考试期间禁止剪切内容')
      setTimeout(() => setWarningMessage(null), 2000)
      return false
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      return false
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // 禁用F12、Ctrl+Shift+I、Ctrl+Shift+J、Ctrl+U等开发者工具快捷键
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U') ||
        (e.ctrlKey && e.key === 'S')
      ) {
        e.preventDefault()
        setWarningMessage('考试期间禁止使用开发者工具')
        setTimeout(() => setWarningMessage(null), 2000)
        return false
      }
    }

    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('cut', handleCut)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  if (isLoading || !paper) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">加载试卷中...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">请先登录</p>
      </div>
    )
  }

  const questions = paper.questions
  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">试卷暂无题目</p>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const answeredCount = Object.keys(answers).filter((qid) => {
    const ans = answers[qid]
    if (!ans) return false
    if (Array.isArray(ans)) return ans.length > 0 && ans.some((a) => a.trim() !== '')
    return String(ans).trim() !== ''
  }).length

  return (
    <div className="space-y-4">
      {/* 警告提示 */}
      {warningMessage && (
        <div className="card bg-amber-50 border-amber-200">
          <p className="text-sm font-semibold text-amber-800">{warningMessage}</p>
          {focusLossCount > 0 && (
            <p className="mt-1 text-xs text-amber-700">切屏次数：{focusLossCount}</p>
          )}
        </div>
      )}

      {/* 顶部工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{paper.title}</h1>
          <p className="text-sm text-slate-600">
            {paper.subject && `${paper.subject} · `}
            {paper.grade && `${paper.grade} · `}
            共 {questions.length} 题，已答 {answeredCount} 题
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {timeRemaining !== null && (
            <span
              className={`rounded-full px-3 py-1 font-semibold ${
                timeRemaining < 5 * 60 * 1000 ? 'bg-red-100 text-red-700' : 'bg-slate-900 text-white'
              }`}
            >
              剩余时间 {formatTime(timeRemaining)}
            </span>
          )}
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">自动保存草稿</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* 题卡导航 */}
        <div className="card">
          <p className="mb-3 text-sm font-semibold text-slate-800">题卡导航</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((pq, idx) => {
              const questionId = pq.question.id
              const isAnswered = answers[questionId] && (() => {
                const ans = answers[questionId]
                if (Array.isArray(ans)) return ans.length > 0 && ans.some((a) => String(a).trim() !== '')
                return String(ans).trim() !== ''
              })()
              const isCurrent = idx === currentIndex

              return (
                <button
                  key={pq.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-brand-600 text-white ring-2 ring-brand-300'
                      : isAnswered
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
          <div className="mt-4 space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-emerald-100 text-emerald-700">✓</span>
              <span>已答题</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-slate-700">
                {currentIndex + 1}
              </span>
              <span>当前题</span>
            </div>
          </div>
        </div>

        {/* 题目区域 */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <span className="text-sm font-semibold text-slate-600">
                  第 {currentIndex + 1} 题 / 共 {questions.length} 题
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  （{currentQuestion.question.type === 'single' && '单选'}
                  {currentQuestion.question.type === 'multiple' && '多选'}
                  {currentQuestion.question.type === 'true_false' && '判断'}
                  {currentQuestion.question.type === 'fill' && '填空'}
                  {currentQuestion.question.type === 'short' && '简答'} · {currentQuestion.score} 分）
                </span>
              </div>
              <div className="flex gap-2">
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                    className="btn btn-secondary text-xs"
                  >
                    上一题
                  </button>
                )}
                {currentIndex < questions.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                    className="btn btn-secondary text-xs"
                  >
                    下一题
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-base leading-relaxed text-slate-900">{currentQuestion.question.stem}</p>
              <QuestionAnswer
                question={currentQuestion.question}
                value={answers[currentQuestion.question.id] || null}
                onChange={(value) => handleAnswerChange(currentQuestion.question.id, value)}
              />
            </div>
          </div>

          {/* 底部操作按钮 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {answeredCount} / {questions.length} 题已答
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? '提交中...' : '提交试卷'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
