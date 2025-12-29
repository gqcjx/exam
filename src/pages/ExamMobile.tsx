/**
 * 移动端考试界面
 * 采用高保真原型设计风格
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getPaperWithQuestions, submitAnswers, saveDraft, loadDraft } from '../api/papers'
import { saveDraftLocal, loadDraftLocal, clearDraftLocal } from '../lib/draftStorage'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
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
  }, [])

  // 平滑切换题目
  const handleQuestionChange = useCallback((newIndex: number) => {
    if (newIndex === currentIndex) return
    
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentIndex(newIndex)
      setIsTransitioning(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
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

  // 防作弊监听（简化版，保持原有逻辑）
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
            } else if (next >= 3) {
              setWarningMessage('多次离开考试页面，系统已记录异常行为。')
              setTimeout(() => setWarningMessage(null), 5000)
            }
            return next
          })
        }
      } else {
        lastFocusTimeRef.current = Date.now()
      }
    }

    window.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  if (isLoading || !paper) {
    return (
      <div className="exam-mobile-loading">
        <div className="loading-spinner"></div>
        <p>加载试卷中...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="exam-mobile-loading">
        <p>请先登录</p>
      </div>
    )
  }

  const questions = paper.questions
  if (questions.length === 0) {
    return (
      <div className="exam-mobile-loading">
        <p>试卷暂无题目</p>
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
    <div className="exam-mobile-container">
      {/* 警告提示 */}
      {warningMessage && (
        <div className="exam-mobile-warning">
          <p>{warningMessage}</p>
          {focusLossCount > 0 && (
            <p className="text-xs mt-1">切屏次数：{focusLossCount}</p>
          )}
        </div>
      )}

      {/* 顶部固定信息栏 */}
      <header className="exam-mobile-header">
        <div className="exam-mobile-header-content">
          <div>
            <div className="exam-mobile-subject">{paper.subject || '考试'}</div>
            <div className="exam-mobile-student-name">
              考生：{profile?.name || session.user.email || '未知'}
            </div>
          </div>
          <div className={`exam-mobile-timer ${isLast5Minutes ? 'warning' : ''}`}>
            {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
          </div>
        </div>
      </header>

      {/* 题目内容区域 */}
      <div className="exam-mobile-content">
        {/* 题目信息 */}
        <div className="exam-mobile-question-info">
          <span className="exam-mobile-question-number">
            第 {currentIndex + 1} 题 / 共 {questions.length} 题
          </span>
          <span className="exam-mobile-question-type">
            · {getQuestionTypeName(currentQuestion.question.type)} · {currentQuestion.score}分
          </span>
        </div>

        {/* 题目题干 */}
        <div className="exam-mobile-question-stem">
          {currentQuestion.question.stem}
        </div>

        {/* 选项区域 */}
        <div className="exam-mobile-options">
          {currentQuestion.question.type === 'single' && currentQuestion.question.options?.map((opt) => {
            const checked = Array.isArray(answers[currentQuestion.question.id]) 
              ? answers[currentQuestion.question.id].includes(opt.label)
              : answers[currentQuestion.question.id] === opt.label
            return (
              <div
                key={opt.label}
                className={`exam-mobile-option ${checked ? 'selected' : ''}`}
                onClick={() => handleAnswerChange(currentQuestion.question.id, [opt.label])}
              >
                <div className="exam-mobile-radio">
                  {checked && <div className="exam-mobile-radio-inner"></div>}
                </div>
                <div className="exam-mobile-option-content">
                  <span className="exam-mobile-option-label">{opt.label}.</span>
                  <span>{opt.text}</span>
                </div>
              </div>
            )
          })}

          {currentQuestion.question.type === 'multiple' && currentQuestion.question.options?.map((opt) => {
            const answerValue = answers[currentQuestion.question.id]
            const currentAnswers: string[] = Array.isArray(answerValue) 
              ? answerValue 
              : []
            const checked = currentAnswers.includes(opt.label)
            return (
              <div
                key={opt.label}
                className={`exam-mobile-option ${checked ? 'selected' : ''}`}
                onClick={() => {
                  const newAnswers = checked
                    ? currentAnswers.filter((a: string) => a !== opt.label)
                    : [...currentAnswers, opt.label]
                  handleAnswerChange(currentQuestion.question.id, newAnswers)
                }}
              >
                <div className="exam-mobile-checkbox">
                  {checked && <i className="fas fa-check"></i>}
                </div>
                <div className="exam-mobile-option-content">
                  <span className="exam-mobile-option-label">{opt.label}.</span>
                  <span>{opt.text}</span>
                </div>
              </div>
            )
          })}

          {currentQuestion.question.type === 'true_false' && [
            { label: 'T', text: '正确' },
            { label: 'F', text: '错误' },
          ].map((opt) => {
            const checked = Array.isArray(answers[currentQuestion.question.id])
              ? answers[currentQuestion.question.id].includes(opt.label)
              : answers[currentQuestion.question.id] === opt.label
            return (
              <div
                key={opt.label}
                className={`exam-mobile-option ${checked ? 'selected' : ''}`}
                onClick={() => handleAnswerChange(currentQuestion.question.id, [opt.label])}
              >
                <div className="exam-mobile-radio">
                  {checked && <div className="exam-mobile-radio-inner"></div>}
                </div>
                <div className="exam-mobile-option-content">
                  <span className="font-semibold">{opt.text}</span>
                </div>
              </div>
            )
          })}

          {currentQuestion.question.type === 'fill' && (() => {
            const blanks = (currentQuestion.question.stem.match(/_{2,}/g) || []).length || 1
            const answerValue = answers[currentQuestion.question.id]
            const fillAnswers: string[] = Array.isArray(answerValue)
              ? answerValue
              : answerValue
                ? [String(answerValue)]
                : Array(blanks).fill('')
            return fillAnswers.map((ans: string, idx: number) => (
              <div key={idx} className="exam-mobile-fill-item">
                <span className="exam-mobile-fill-label">空 {idx + 1}：</span>
                <input
                  type="text"
                  value={ans}
                  onChange={(e) => {
                    const newAnswers = [...fillAnswers]
                    newAnswers[idx] = e.target.value
                    handleAnswerChange(currentQuestion.question.id, newAnswers)
                  }}
                  className="exam-mobile-fill-input"
                  placeholder="请输入答案"
                />
              </div>
            ))
          })()}

          {currentQuestion.question.type === 'short' && (
            <textarea
              value={typeof answers[currentQuestion.question.id] === 'string' 
                ? answers[currentQuestion.question.id] 
                : Array.isArray(answers[currentQuestion.question.id])
                  ? answers[currentQuestion.question.id][0] || ''
                  : ''}
              onChange={(e) => handleAnswerChange(currentQuestion.question.id, e.target.value)}
              className="exam-mobile-textarea"
              placeholder="请输入答案..."
              rows={6}
            />
          )}
        </div>

        {/* 操作按钮 */}
        <div className="exam-mobile-actions">
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={() => handleQuestionChange(currentIndex - 1)}
              className="exam-mobile-btn exam-mobile-btn-secondary"
              disabled={isTransitioning}
            >
              <i className="fas fa-arrow-left mr-2"></i>上一题
            </button>
          )}
          {currentIndex < questions.length - 1 && (
            <button
              type="button"
              onClick={() => handleQuestionChange(currentIndex + 1)}
              className="exam-mobile-btn exam-mobile-btn-primary"
              disabled={isTransitioning}
            >
              下一题<i className="fas fa-arrow-right ml-2"></i>
            </button>
          )}
        </div>
      </div>

      {/* 底部题号导航 */}
      <footer className="exam-mobile-footer">
        <div className="exam-mobile-nav-section">
          <div className="exam-mobile-nav-title">答题卡</div>
          <div className="exam-mobile-nav-grid">
            {questions.map((pq, idx) => {
              const questionId = pq.question.id
              const isAnswered = isQuestionAnswered(questionId)
              const isCurrent = idx === currentIndex

              return (
                <button
                  key={pq.id}
                  type="button"
                  onClick={() => handleQuestionChange(idx)}
                  className={`exam-mobile-nav-item ${isCurrent ? 'current' : ''} ${isAnswered ? 'answered' : ''}`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>
        <div className="exam-mobile-submit-section">
          <button
            type="button"
            onClick={() => setShowConfirmDialog(true)}
            disabled={isSubmitting}
            className="exam-mobile-submit-btn"
          >
            <i className="fas fa-paper-plane mr-2"></i>
            {isSubmitting ? '提交中...' : '交卷'}
          </button>
          <div className="exam-mobile-progress">
            已答 {answeredCount}/{questions.length}
          </div>
        </div>
      </footer>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="确认提交试卷"
        message="确定要提交试卷吗？提交后将无法修改答案。请确认您已完成所有题目。"
        confirmText="确认提交"
        cancelText="取消"
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </div>
  )
}
