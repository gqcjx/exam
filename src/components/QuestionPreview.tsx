import type { QuestionItem } from '../types'

type Question = QuestionItem

export function QuestionPreview({ question }: { question: Question }) {
  if (!question || !question.type) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm text-amber-700">题目数据不完整</p>
      </div>
    )
  }
  
  const { type } = question
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-800">
        [{labelByType(type)}] {question.stem || '题目内容缺失'}
      </p>
      {type === 'single' || type === 'multiple' ? (
        <div className="space-y-2 text-sm">
          {question.options && Array.isArray(question.options) && question.options.length > 0 ? (
            question.options.map((opt, idx) => (
              opt ? (
                <label
                  key={opt.label || idx}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700"
                >
                  <input
                    type={type === 'single' ? 'radio' : 'checkbox'}
                    disabled
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  <span className="font-semibold text-slate-800">{opt.label || String.fromCharCode(65 + idx)}.</span>
                  <span>{opt.text || ''}</span>
                </label>
              ) : null
            ))
          ) : (
            <p className="text-xs text-slate-500">选项数据缺失</p>
          )}
        </div>
      ) : null}
      {type === 'true_false' ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {['正确', '错误'].map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700"
            >
              <input type="radio" disabled className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              {opt}
            </label>
          ))}
        </div>
      ) : null}
      {type === 'fill' ? (
        <div className="space-y-2 text-sm">
          {question.answer && Array.isArray(question.answer) && question.answer.length > 0 ? (
            question.answer.map((_, idx) => (
              <input
                key={idx}
                type="text"
                disabled
                placeholder={`填空${idx + 1}`}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
              />
            ))
          ) : (
            <p className="text-xs text-slate-500">答案数据缺失</p>
          )}
        </div>
      ) : null}
      {type === 'short' ? (
        <textarea
          disabled
          placeholder="简答题作答区域"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
          rows={4}
        />
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">标准答案：</span>
        <span className="rounded-full bg-red-50 px-3 py-1 font-semibold text-red-700">
          {question.answer && Array.isArray(question.answer) && question.answer.length > 0 
            ? answerLabel(question) 
            : '无答案'}
        </span>
        {question.analysis ? (
          <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
            解析：{truncate(question.analysis, 48)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function labelByType(type: Question['type']) {
  switch (type) {
    case 'single':
      return '单选'
    case 'multiple':
      return '多选'
    case 'true_false':
      return '判断'
    case 'fill':
      return '填空'
    case 'short':
      return '简答'
    default:
      return '题目'
  }
}

function answerLabel(q: Question) {
  if (q.type === 'single' || q.type === 'multiple' || q.type === 'true_false') {
    return q.answer.join(',')
  }
  return q.answer.join(' / ')
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}


