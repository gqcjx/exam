/**
 * 移动端考试页面
 * 基于 prototype/exam.html 设计，优化答题卡大小
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getPaperWithQuestions, submitAnswers, saveDraft, loadDraft } from '../../api/papers'
import { saveDraftLocal, loadDraftLocal, clearDraftLocal } from '../../lib/draftStorage'
import { QuestionAnswer } from '../../components/QuestionAnswer'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import './ExamMobile.css'

export default function ExamMobile() {
  const { paperId } = useParams<{ paperId: string }>()
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[] | string>>({})
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focusLossCount, setFocusLossCount] = useState(0)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFocusTimeRef = useRef<number>(Date.now())
  const questionAreaRef = useRef<HTMLDivElement>(null)

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

    const duration = paper.duration_minutes * 60 * 1000
    const now = Date.now()
    const endTime = paper.end_time ? new Date(paper.end_time).getTime() : null

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
      const localDraft = await loadDraftLocal(paperId)
      if (localDraft) {
        setAnswers(localDraft)
      }

      const remoteDraft = await loadDraft(paperId)
      if (remoteDraft) {
        setAnswers(remoteDraft)
        await saveDraftLocal(paperId, remoteDraft)
      }
    }

    loadSavedDraft()
  }, [paperId, paper])

  // 自动保存草稿
  useEffect(() => {
    if (!paperId || Object.keys(answers).length === 0) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(async () => {
      await saveDraftLocal(paperId, answers)
      await saveDraft(paperId, answers)
    }, 3000)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [answers, paperId])

  // 格式化倒计时
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
  }, [])

  // 切换题目
  const handleQuestionChange = useCallback((newIndex: number) => {
    if (newIndex === currentIndex) return
    
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentIndex(newIndex)
      setIsTransitioning(false)
      if (questionAreaRef.current) {
        questionAreaRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 150)
  }, [currentIndex])

  // 提交试卷
  const submitMutation = useMutation({
    mutationFn: () => {
      if (!paperId) throw new Error('试卷ID不存在')
      return submitAnswers(paperId, answers)
    },
    onSuccess: async () => {
      if (paperId) {
        await clearDraftLocal(paperId)
      }
      navigate(`/result/${paperId}`)
    },
    onError: (error: any) => {
      alert(`提交失败：${error.message}`)
      setIsSubmitting(false)
      setShowConfirmDialog(false)
    },
  })

  const handleSubmit = useCallback(async () => {
    if (!paper) return
    setIsSubmitting(true)
    submitMutation.mutate()
  }, [paper, submitMutation])

  // 时间到自动交卷
  useEffect(() => {
    if (timeRemaining === 0 && !isSubmitting && !showConfirmDialog) {
      handleSubmit()
    }
  }, [timeRemaining, isSubmitting, showConfirmDialog, handleSubmit])

  // 防作弊：监听切屏
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const now = Date.now()
        const timeSinceLastFocus = now - lastFocusTimeRef.current
        
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
                if (!isSubmitting && !showConfirmDialog) {
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
  }, [isSubmitting, showConfirmDialog, handleSubmit])

  // 防作弊：禁用复制粘贴
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

    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('cut', handleCut)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  if (isLoading || !paper) {
    return (
      <div className="flex items-center justify-center py-12 min-h-screen bg-[#f5f5f5]">
        <p className="text-gray-600">加载试卷中...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center py-12 min-h-screen bg-[#f5f5f5]">
        <p className="text-gray-600">请先登录</p>
      </div>
    )
  }

  const questions = paper.questions
  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 min-h-screen bg-[#f5f5f5]">
        <p className="text-gray-600">试卷暂无题目</p>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const answeredCount = Object.keys(answers).filter((qid) => {
    const ans = answers[qid]
    if (!ans) return false
    if (Array.isArray(ans)) return ans.length > 0 && ans.some((a) => String(a).trim() !== '')
    return String(ans).trim() !== ''
  }).length

  // 检查题目是否已答
  const isQuestionAnswered = (questionId: string) => {
    const ans = answers[questionId]
    if (!ans) return false
    if (Array.isArray(ans)) return ans.length > 0 && ans.some((a) => String(a).trim() !== '')
    return String(ans).trim() !== ''
  }

  // 获取题型中文名称
  const getQuestionTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      single: '单选题',
      multiple: '多选题',
      true_false: '判断题',
      fill: '填空题',
      short: '简答题',
    }
    return typeMap[type] || '未知题型'
  }

  // 检查是否最后5分钟
  const isLast5Minutes = timeRemaining !== null && timeRemaining < 5 * 60 * 1000

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* 警告提示 */}
      {warningMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-sm">
          <p>{warningMessage}</p>
          {focusLossCount > 0 && (
            <p className="mt-1 text-xs">切屏次数：{focusLossCount}</p>
          )}
        </div>
      )}

      {/* 顶部固定信息栏 */}
      <div className="bg-gradient-to-r from-[#2E8B57] to-[#3da86a] text-white px-4 py-3 sticky top-0 z-50 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{paper.subject || '考试'}</div>
            <div className="text-xs opacity-90 mt-0.5">
              考生：{profile?.name || session?.user?.email || '未知'}
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg font-bold text-base ${isLast5Minutes ? 'bg-[#FFA500] animate-pulse' : 'bg-white/20 backdrop-blur-sm'}`}>
            {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
          </div>
        </div>
      </div>

      {/* 题目内容区域 */}
      <div ref={questionAreaRef} className="flex-1 overflow-y-auto px-4 py-4">
        {/* 题目信息 */}
        <div className="mb-4 text-sm text-gray-500">
          <span className="font-semibold text-[#2E8B57]">第 {currentIndex + 1} 题 / 共 {questions.length} 题</span>
          <span className="ml-2">· {getQuestionTypeName(currentQuestion.question.type)} · {currentQuestion.score}分</span>
        </div>

        {/* 题目题干 */}
        <div className="text-lg font-semibold text-gray-800 mb-5 leading-relaxed">
          {currentQuestion.question.stem}
        </div>

        {/* 选项区域 */}
        <div className="mb-6 exam-mobile-options">
          <QuestionAnswer
            question={currentQuestion.question}
            value={answers[currentQuestion.question.id] || null}
            onChange={(value) => handleAnswerChange(currentQuestion.question.id, value)}
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() => handleQuestionChange(currentIndex - 1)}
            disabled={currentIndex === 0 || isTransitioning}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-arrow-left mr-2"></i>上一题
          </button>
          <button
            type="button"
            onClick={() => handleQuestionChange(currentIndex + 1)}
            disabled={currentIndex === questions.length - 1 || isTransitioning}
            className="flex-1 py-2.5 bg-[#2E8B57] text-white rounded-lg font-medium hover:bg-[#3da86a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一题<i className="fas fa-arrow-right ml-2"></i>
          </button>
        </div>
      </div>

      {/* 底部答题卡和交卷 */}
      <div className="bg-white border-t border-gray-200 px-4 py-2.5">
        <div className="flex items-start gap-2.5">
          {/* 答题卡（紧凑设计 - 优化大小） */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 mb-1.5">答题卡</div>
            <div className="grid grid-cols-5 gap-1 max-h-20 overflow-y-auto pr-1">
              {questions.map((pq, idx) => {
                const questionId = pq.question.id
                const isAnswered = isQuestionAnswered(questionId)
                const isCurrent = idx === currentIndex

                return (
                  <button
                    key={pq.id}
                    type="button"
                    onClick={() => handleQuestionChange(idx)}
                    className={`w-7 h-7 text-xs font-semibold rounded border-2 transition-all flex items-center justify-center ${
                      isCurrent
                        ? 'bg-[#2E8B57] text-white border-[#2E8B57] scale-105'
                        : isAnswered
                        ? 'bg-[#e8f5e9] text-[#2E8B57] border-[#2E8B57]'
                        : 'bg-white text-gray-600 border-gray-300'
                    }`}
                    title={`第 ${idx + 1} 题`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 交卷按钮 */}
          <div className="flex flex-col items-center justify-center pt-3">
            <button
              type="button"
              onClick={() => setShowConfirmDialog(true)}
              disabled={isSubmitting}
              className="px-3 py-2 bg-[#2E8B57] text-white rounded-lg font-semibold text-sm hover:bg-[#3da86a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-1"
            >
              <i className="fas fa-paper-plane mr-1.5"></i>交卷
            </button>
            <div className="text-xs text-gray-500 text-center whitespace-nowrap">
              已答 {answeredCount}/{questions.length}
            </div>
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="确认提交试卷"
        message="确定要提交试卷吗？提交后将无法修改答案。请确认您已完成所有题目。"
        confirmText={isSubmitting ? '提交中...' : '确认提交'}
        cancelText="取消"
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </div>
  )
}

