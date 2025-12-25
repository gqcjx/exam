import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSubjects, getGrades } from '../api/config'
import type { QuestionItem, QuestionType } from '../types'

interface QuestionFormProps {
  question?: QuestionItem | null
  onSubmit: (question: {
    subject: string
    grade?: string | null
    semester?: string | null
    textbook_version?: string | null
    type: QuestionType
    stem: string
    options?: Array<{ label: string; text: string }> | null
    answer: string[]
    analysis?: string | null
    difficulty: number
    tags: string[]
  }) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

// 根据系统时间推断当前学期
function getCurrentSemester(): string {
  const now = new Date()
  const month = now.getMonth() + 1 // 0-11 -> 1-12
  // 9月-1月（次年）为上学期，2月-8月为下学期
  if (month >= 9 || month <= 1) {
    return '上学期'
  } else {
    return '下学期'
  }
}

// 生成随机难度（1-5之间）
function getRandomDifficulty(): number {
  return Math.floor(Math.random() * 5) + 1
}

export function QuestionForm({ question, onSubmit, onCancel, isLoading = false }: QuestionFormProps) {
  // 获取学科和年级列表
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => getSubjects(true),
  })

  const { data: grades = [] } = useQuery({
    queryKey: ['grades'],
    queryFn: () => getGrades(true),
  })

  const [subject, setSubject] = useState(question?.subject || subjects[0]?.name || '')
  const [grade, setGrade] = useState(question?.grade || grades[0]?.name || '')
  const [semester, setSemester] = useState(question?.semester || getCurrentSemester())
  const [textbookVersion, setTextbookVersion] = useState(question?.textbook_version || '人教版')
  const [type, setType] = useState<QuestionType>(question?.type || 'single')
  const [stem, setStem] = useState(question?.stem || '')
  const [options, setOptions] = useState<Array<{ label: string; text: string }>>(
    question?.options || [
      { label: 'A', text: '' },
      { label: 'B', text: '' },
      { label: 'C', text: '' },
      { label: 'D', text: '' },
    ],
  )
  const [answer, setAnswer] = useState<string[]>(question?.answer || [])
  const [analysis, setAnalysis] = useState(question?.analysis || '')
  const [difficulty, setDifficulty] = useState(question?.difficulty || getRandomDifficulty())
  const [tags, setTags] = useState(question?.tags?.join(', ') || '')

  useEffect(() => {
    if (question) {
      setSubject(question.subject)
      setGrade(question.grade || '')
      setSemester(question.semester || '')
      setTextbookVersion(question.textbook_version || '')
      setType(question.type)
      setStem(question.stem)
      setOptions(question.options || [])
      setAnswer(question.answer || [])
      setAnalysis(question.analysis || '')
      setDifficulty(question.difficulty || 1)
      setTags(question.tags?.join(', ') || '')
    }
  }, [question])

  useEffect(() => {
    // 根据题型调整选项
    if (type === 'true_false') {
      setOptions([
        { label: 'T', text: '正确' },
        { label: 'F', text: '错误' },
      ])
      if (!answer.length || !['T', 'F'].includes(answer[0])) {
        setAnswer(['T'])
      }
    } else if (type === 'fill' || type === 'short') {
      setOptions([])
      setAnswer([])
    } else if (type === 'single' || type === 'multiple') {
      // 单选和多选题默认4个选项
      if (options.length !== 4) {
        const newOptions = []
        for (let i = 0; i < 4; i++) {
          newOptions.push({ label: String.fromCharCode(65 + i), text: '' })
        }
        setOptions(newOptions)
      }
    } else if (options.length < 2) {
      // 其他题型确保至少有2个选项
      const newOptions = []
      for (let i = 0; i < 2; i++) {
        newOptions.push({ label: String.fromCharCode(65 + i), text: '' })
      }
      setOptions(newOptions)
    }
  }, [type])

  const handleAddOption = () => {
    const nextLabel = String.fromCharCode(65 + options.length)
    setOptions([...options, { label: nextLabel, text: '' }])
  }

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return
    const newOptions = options.filter((_, i) => i !== index)
    // 重新标记选项
    const reindexed = newOptions.map((opt, i) => ({
      label: String.fromCharCode(65 + i),
      text: opt.text,
    }))
    setOptions(reindexed)
    // 更新答案中的标签
    const removedLabel = String.fromCharCode(65 + index)
    setAnswer(answer.filter((a) => a !== removedLabel))
  }

  const handleOptionChange = (index: number, text: string) => {
    const newOptions = [...options]
    newOptions[index].text = text
    setOptions(newOptions)
  }

  const handleAnswerToggle = (label: string) => {
    if (type === 'single') {
      setAnswer([label])
    } else if (type === 'multiple') {
      if (answer.includes(label)) {
        setAnswer(answer.filter((a) => a !== label))
      } else {
        setAnswer([...answer, label])
      }
    } else if (type === 'true_false') {
      setAnswer([label])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stem.trim()) {
      alert('请输入题干')
      return
    }

    if ((type === 'single' || type === 'multiple' || type === 'true_false') && options.length < 2) {
      alert('请至少添加2个选项')
      return
    }

    if ((type === 'single' || type === 'multiple' || type === 'true_false') && answer.length === 0) {
      alert('请选择正确答案')
      return
    }

    if ((type === 'single' || type === 'multiple' || type === 'true_false')) {
      const hasEmptyOption = options.some((opt) => !opt.text.trim())
      if (hasEmptyOption) {
        alert('请填写所有选项')
        return
      }
    }

    try {
      await onSubmit({
        subject,
        grade: grade || null,
        semester: semester || null,
        textbook_version: textbookVersion || null,
        type,
        stem: stem.trim(),
        options: type === 'fill' || type === 'short' ? null : options,
        answer,
        analysis: analysis.trim() || null,
        difficulty,
        tags: tags
          .split(/[，,、\s]+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      })
    } catch (err: any) {
      alert(err?.message || '保存失败')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">学科</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            required
          >
            {subjects.length === 0 ? (
              <option value="">加载中...</option>
            ) : (
              subjects.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">年级</label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">未分年级</option>
            {grades.length === 0 ? (
              <option value="">加载中...</option>
            ) : (
              grades.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">学期</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">未分学期</option>
            <option value="上学期">上学期</option>
            <option value="下学期">下学期</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">教材版本</label>
          <select
            value={textbookVersion}
            onChange={(e) => setTextbookVersion(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">未分版本</option>
            <option value="人教版">人教版</option>
            <option value="苏教版">苏教版</option>
            <option value="北师大版">北师大版</option>
            <option value="浙教版">浙教版</option>
            <option value="沪教版">沪教版</option>
            <option value="鲁教版">鲁教版</option>
            <option value="冀教版">冀教版</option>
            <option value="湘教版">湘教版</option>
            <option value="外研版">外研版</option>
            <option value="译林版">译林版</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">题型</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            required
          >
            <option value="single">单选题</option>
            <option value="multiple">多选题</option>
            <option value="true_false">判断题</option>
            <option value="fill">填空题</option>
            <option value="short">简答题</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">难度</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            required
          >
            <option value={1}>1 - 简单</option>
            <option value={2}>2 - 较易</option>
            <option value={3}>3 - 中等</option>
            <option value={4}>4 - 较难</option>
            <option value={5}>5 - 困难</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">题干</label>
        <textarea
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          rows={3}
          placeholder="请输入题目内容..."
          required
        />
      </div>

      {(type === 'single' || type === 'multiple' || type === 'true_false') && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            选项（{type === 'single' ? '单选' : type === 'multiple' ? '多选' : '判断'}）
          </label>
          <div className="space-y-2">
            {options.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAnswerToggle(opt.label)}
                  className={`flex-shrink-0 w-8 h-8 rounded border-2 flex items-center justify-center font-semibold ${
                    answer.includes(opt.label)
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'border-slate-300 text-slate-600 hover:border-brand-300'
                  }`}
                >
                  {opt.label}
                </button>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                  placeholder={`选项 ${opt.label} 的内容`}
                  required
                />
                {options.length > 2 && type !== 'true_false' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="flex-shrink-0 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
            {type !== 'true_false' && (
              <button
                type="button"
                onClick={handleAddOption}
                className="text-sm text-brand-600 hover:text-brand-700"
              >
                + 添加选项
              </button>
            )}
          </div>
        </div>
      )}

      {(type === 'fill' || type === 'short') && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {type === 'fill' ? '参考答案' : '参考答案'}
          </label>
          <input
            type="text"
            value={answer.join(', ')}
            onChange={(e) => setAnswer(e.target.value.split(',').map((a) => a.trim()).filter((a) => a))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder={type === 'fill' ? '请输入参考答案' : '请输入参考答案（多个答案用逗号分隔）'}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">解析（可选）</label>
        <textarea
          value={analysis}
          onChange={(e) => setAnalysis(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          rows={2}
          placeholder="请输入题目解析..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">标签（可选，用逗号分隔）</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          placeholder="例如：几何, 代数, 函数"
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button type="submit" className="btn btn-primary flex-1" disabled={isLoading}>
          {isLoading ? '保存中...' : question ? '更新题目' : '创建题目'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary flex-1" disabled={isLoading}>
          取消
        </button>
      </div>
    </form>
  )
}

