import { useMemo } from 'react'
import type { QuestionItem } from '../types'

interface QuestionAnswerProps {
  question: QuestionItem
  value: string[] | string | null
  onChange: (value: string[] | string) => void
  disabled?: boolean
  showAnswer?: boolean
}

export function QuestionAnswer({ question, value, onChange, disabled = false, showAnswer = false }: QuestionAnswerProps) {
  const displayValue = useMemo(() => {
    if (!value) return null
    if (question.type === 'single' || question.type === 'multiple' || question.type === 'true_false') {
      return Array.isArray(value) ? value : [value]
    }
    return value
  }, [value, question.type])

  if (question.type === 'single') {
    return (
      <div className="exam-options">
        {question.options?.map((opt) => {
          const checked = displayValue?.includes(opt.label) || false
          return (
            <label
              key={opt.label}
              className={`exam-option ${checked ? 'selected' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt.label}
                checked={checked}
                onChange={() => !disabled && onChange([opt.label])}
                disabled={disabled}
              />
              <span className="exam-option-radio"></span>
              <div className="exam-option-text">
                <span className="exam-option-label">{opt.label}.</span>
                <span>{opt.text}</span>
              </div>
              {showAnswer && question.answer.includes(opt.label) && (
                <span className="text-xs font-semibold text-emerald-600 ml-2">✓ 正确答案</span>
              )}
            </label>
          )
        })}
      </div>
    )
  }

  if (question.type === 'multiple') {
    return (
      <div className="exam-options">
        {question.options?.map((opt) => {
          const checked = displayValue?.includes(opt.label) || false
          return (
            <label
              key={opt.label}
              className={`exam-option ${checked ? 'selected' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                value={opt.label}
                checked={checked}
                onChange={(e) => {
                  if (disabled) return
                  const current = Array.isArray(displayValue) ? displayValue : []
                  if (e.target.checked) {
                    onChange([...current, opt.label])
                  } else {
                    onChange(current.filter((v: string) => v !== opt.label))
                  }
                }}
                disabled={disabled}
              />
              <span className="exam-option-checkbox"></span>
              <div className="exam-option-text">
                <span className="exam-option-label">{opt.label}.</span>
                <span>{opt.text}</span>
              </div>
              {showAnswer && question.answer.includes(opt.label) && (
                <span className="text-xs font-semibold text-emerald-600 ml-2">✓ 正确答案</span>
              )}
            </label>
          )
        })}
      </div>
    )
  }

  if (question.type === 'true_false') {
    return (
      <div className="exam-options">
        {[
          { label: 'T', text: '正确' },
          { label: 'F', text: '错误' },
        ].map((opt) => {
          const checked = displayValue?.includes(opt.label) || false
          return (
            <label
              key={opt.label}
              className={`exam-option ${checked ? 'selected' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt.label}
                checked={checked}
                onChange={() => !disabled && onChange([opt.label])}
                disabled={disabled}
              />
              <span className="exam-option-radio"></span>
              <div className="exam-option-text">
                <span className="font-semibold">{opt.text}</span>
              </div>
              {showAnswer && question.answer.includes(opt.label) && (
                <span className="text-xs font-semibold text-emerald-600 ml-2">✓</span>
              )}
            </label>
          )
        })}
      </div>
    )
  }

  if (question.type === 'fill') {
    // 填空题：检测题干中的空位数量
    const blanks = (question.stem.match(/_{2,}/g) || []).length || 1
    const answers = Array.isArray(displayValue) ? displayValue : displayValue ? [displayValue] : Array(blanks).fill('')

    return (
      <div className="space-y-3">
        {answers.map((ans, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-600">空 {idx + 1}：</span>
            <input
              type="text"
              value={ans}
              onChange={(e) => {
                if (disabled) return
                const newAnswers = [...answers]
                newAnswers[idx] = e.target.value
                onChange(newAnswers)
              }}
              disabled={disabled}
              className="exam-fill-input"
              placeholder="请输入答案"
            />
            {showAnswer && question.answer[idx] && (
              <span className="text-xs text-slate-500">正确答案：{question.answer[idx]}</span>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (question.type === 'short') {
    const textValue = typeof displayValue === 'string' ? displayValue : displayValue?.[0] || ''
    return (
      <div>
        <textarea
          value={textValue}
          onChange={(e) => !disabled && onChange(e.target.value)}
          disabled={disabled}
          rows={6}
          className="exam-textarea"
          placeholder="请输入答案..."
        />
        {showAnswer && question.answer[0] && (
          <div className="mt-2 rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">参考答案：</p>
            <p className="mt-1 text-sm text-slate-900">{question.answer[0]}</p>
          </div>
        )}
      </div>
    )
  }

  return null
}
