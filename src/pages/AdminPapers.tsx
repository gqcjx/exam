import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { randomQuestions, createPaperWithQuestions, createPaperManual, getPaperWithQuestions } from '../api/papers'
import { getPaperList, updatePaper, deletePaper, batchUpdatePapers, type PaperListItem } from '../api/admin'
import { listQuestions } from '../api/questions'
import { createPaperVersion, getPaperVersions } from '../api/paperVersions'
import { getSubjects, getGrades } from '../api/config'
import type { QuestionItem, QuestionType } from '../types'
import { QuestionPreview } from '../components/QuestionPreview'
import { isSupabaseReady } from '../lib/env'
import { exportPaperAsPDF, exportPaperAsWord, exportPaperAsTextFile } from '../api/export'

type WizardState = {
  title: string
  subject: string
  grade: string
  duration: number
  limit: number
  types: QuestionType[]
  difficulty?: number
  startTime?: string
  endTime?: string
}

const defaultWizard: WizardState = {
  title: '随机测验',
  subject: '',
  grade: '',
  duration: 45,
  limit: 10,
  types: ['single', 'multiple', 'true_false', 'fill', 'short'],
}

export default function AdminPapers() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'list' | 'create'>('list')
  const [createMode, setCreateMode] = useState<'random' | 'manual'>('random')
  const [wizard, setWizard] = useState<WizardState>(defaultWizard)
  const [picked, setPicked] = useState<QuestionItem[]>([])
  const [manualSelected, setManualSelected] = useState<Record<string, { question: QuestionItem; score: number }>>({})
  const [message, setMessage] = useState<string | null>(null)

  // 获取学科和年级列表
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => getSubjects(true),
  })

  const { data: grades = [] } = useQuery({
    queryKey: ['grades'],
    queryFn: () => getGrades(true),
  })

  // 初始化默认值
  useEffect(() => {
    if (subjects.length > 0 && !wizard.subject) {
      setWizard((prev) => ({ ...prev, subject: subjects[0].name }))
    }
    if (grades.length > 0 && !wizard.grade) {
      setWizard((prev) => ({ ...prev, grade: grades[0].name }))
    }
  }, [subjects, grades])

  // 试卷列表
  const { data: papers = [], isLoading: papersLoading } = useQuery({
    queryKey: ['paper-list'],
    queryFn: () => getPaperList(),
  })

  const randomMutation = useMutation({
    mutationFn: () =>
      randomQuestions({
        subject: wizard.subject,
        grade: wizard.grade,
        types: wizard.types,
        difficulty: wizard.difficulty,
        limit: wizard.limit,
      }),
    onSuccess: (data) => {
      setPicked(data)
      setMessage(`已抽取 ${data.length} 道题`)
      setTimeout(() => setMessage(null), 3000)
    },
    onError: (err: any) => {
      setMessage(err?.message || '抽题失败')
    },
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createPaperWithQuestions({
        title: wizard.title,
        subject: wizard.subject,
        grade: wizard.grade,
        durationMinutes: wizard.duration,
        questions: picked,
        startTime: wizard.startTime,
        endTime: wizard.endTime,
      }),
    onSuccess: (paperId) => {
      setMessage(`创建成功，试卷ID: ${paperId}`)
      queryClient.invalidateQueries({ queryKey: ['paper-list'] })
      setTimeout(() => {
        setTab('list')
        setPicked([])
        setWizard(defaultWizard)
        setMessage(null)
      }, 1500)
    },
    onError: (err: any) => {
      setMessage(err?.message || '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ paperId, updates }: { paperId: string; updates: Parameters<typeof updatePaper>[1] }) =>
      updatePaper(paperId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-list'] })
      setMessage('更新成功')
      setTimeout(() => setMessage(null), 2000)
    },
    onError: (err: any) => {
      setMessage(err?.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePaper,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-list'] })
      setMessage('删除成功')
      setTimeout(() => setMessage(null), 2000)
    },
    onError: (err: any) => {
      setMessage(err?.message || '删除失败')
    },
  })

  const toggleType = (type: QuestionType) => {
    setWizard((prev) => {
      const exists = prev.types.includes(type)
      return {
        ...prev,
        types: exists ? prev.types.filter((t) => t !== type) : [...prev.types, type],
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">试卷管理</h1>
          <p className="text-sm text-slate-600">
            {tab === 'list' ? '管理现有试卷，可编辑、发布、删除' : '组卷向导：配置条件 → RPC 抽题 → 预览 → 创建试卷'}
            {!isSupabaseReady && <span className="text-amber-700"> 当前未配置 Supabase，将无法落库。</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn ${tab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('list')}
          >
            试卷列表
          </button>
          <button
            className={`btn ${tab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('create')}
          >
            新建试卷
          </button>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border p-3 text-sm ${message.includes('成功') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          {message}
        </div>
      )}

      {tab === 'list' ? (
        <PaperList
          papers={papers}
          isLoading={papersLoading}
          onUpdate={(paperId, updates) => updateMutation.mutate({ paperId, updates })}
          onDelete={(paperId) => {
            if (confirm('确定要删除此试卷吗？此操作不可恢复。')) {
              deleteMutation.mutate(paperId)
            }
          }}
        />
      ) : (
        <PaperCreator
          wizard={wizard}
          setWizard={setWizard}
          picked={picked}
          manualSelected={manualSelected}
          setManualSelected={setManualSelected}
          randomMutation={randomMutation}
          createMutation={createMutation}
          createMode={createMode}
          setCreateMode={setCreateMode}
          toggleType={toggleType}
        />
      )}
    </div>
  )
}

function PaperList({
  papers,
  isLoading,
  onUpdate,
  onDelete,
}: {
  papers: PaperListItem[]
  isLoading: boolean
  onUpdate: (paperId: string, updates: Parameters<typeof updatePaper>[1]) => void
  onDelete: (paperId: string) => void
}) {
  const queryClient = useQueryClient()
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set())

  const batchPublishMutation = useMutation({
    mutationFn: ({ ids, published }: { ids: string[]; published: boolean }) =>
      batchUpdatePapers(ids, { published }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-list'] })
      setSelectedPaperIds(new Set())
    },
    onError: (err: any) => {
      alert(err?.message || '批量操作失败')
    },
  })
  if (isLoading) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600">加载中...</p>
      </div>
    )
  }

  if (papers.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600">暂无试卷，点击“新建试卷”创建</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {papers.map((paper) => (
        <PaperListItem key={paper.id} paper={paper} onUpdate={onUpdate} onDelete={onDelete} />
      ))}
    </div>
  )
}

function PaperListItemWithCheckbox({
  paper,
  selected,
  onSelect,
  onUpdate,
  onDelete,
}: {
  paper: PaperListItem
  selected: boolean
  onSelect: (selected: boolean) => void
  onUpdate: (paperId: string, updates: Parameters<typeof updatePaper>[1]) => void
  onDelete: (paperId: string) => void
}) {
  const queryClient = useQueryClient()
  const [showVersions, setShowVersions] = useState(false)
  
  const { data: versions = [] } = useQuery({
    queryKey: ['paper-versions', paper.id],
    queryFn: () => getPaperVersions(paper.id),
    enabled: showVersions,
  })

  const createVersionMutation = useMutation({
    mutationFn: () => createPaperVersion(paper.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paper-list'] })
      queryClient.invalidateQueries({ queryKey: ['paper-versions'] })
      alert('新版本创建成功')
    },
    onError: (err: any) => {
      alert(err?.message || '创建版本失败')
    },
  })
  const [isExporting, setIsExporting] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const handleExport = async (format: 'pdf' | 'word' | 'text', includeAnswers: boolean) => {
    setIsExporting(true)
    try {
      const paperData = await getPaperWithQuestions(paper.id)
      if (!paperData) {
        alert('获取试卷数据失败')
        return
      }

      if (format === 'pdf') {
        await exportPaperAsPDF(paperData, includeAnswers)
      } else if (format === 'word') {
        exportPaperAsWord(paperData, includeAnswers)
      } else {
        exportPaperAsTextFile(paperData, includeAnswers)
      }
      setShowExportMenu(false)
    } catch (err: any) {
      alert(err?.message || '导出失败')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">{paper.title}</h3>
            {paper.published ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                已发布
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                未发布
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            {paper.subject && <p>学科：{paper.subject}</p>}
            {paper.grade && <p>年级：{paper.grade}</p>}
            <p>时长：{paper.duration_minutes} 分钟 | 总分：{paper.total_score} 分</p>
            <p>题目数：{paper.question_count || 0} | 提交数：{paper.submission_count || 0}</p>
            {(paper as any).version && <p>版本：v{(paper as any).version}</p>}
            <p>创建时间：{new Date(paper.created_at).toLocaleString('zh-CN')}</p>
          </div>
        </div>
        <div className="ml-4 flex flex-col gap-2">
          <Link
            to={`/result/${paper.id}`}
            className="btn btn-secondary text-xs"
            target="_blank"
          >
            查看成绩
          </Link>
          <button
            className="btn btn-secondary text-xs"
            onClick={() => setShowVersions(!showVersions)}
          >
            {showVersions ? '隐藏版本' : '查看版本'}
          </button>
          <button
            className="btn btn-secondary text-xs"
            onClick={() => {
              if (confirm('确定要创建新版本吗？新版本将复制当前试卷的题目和设置。')) {
                createVersionMutation.mutate()
              }
            }}
            disabled={createVersionMutation.isPending}
          >
            {createVersionMutation.isPending ? '创建中...' : '创建新版本'}
          </button>
          <div className="relative">
            <button
              className="btn btn-secondary text-xs"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
            >
              {isExporting ? '导出中...' : '导出'}
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 z-10 w-48 rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="p-2 space-y-1">
                  <div className="text-xs font-semibold text-slate-700 px-2 py-1">不带答案</div>
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 rounded"
                    onClick={() => handleExport('pdf', false)}
                  >
                    导出为 PDF
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 rounded"
                    onClick={() => handleExport('word', false)}
                  >
                    导出为 Word
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 rounded"
                    onClick={() => handleExport('text', false)}
                  >
                    导出为文本
                  </button>
                  <div className="border-t border-slate-200 my-1"></div>
                  <div className="text-xs font-semibold text-slate-700 px-2 py-1">带答案</div>
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 rounded"
                    onClick={() => handleExport('pdf', true)}
                  >
                    导出为 PDF（含答案）
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 rounded"
                    onClick={() => handleExport('word', true)}
                  >
                    导出为 Word（含答案）
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 rounded"
                    onClick={() => handleExport('text', true)}
                  >
                    导出为文本（含答案）
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            className="btn btn-secondary text-xs"
            onClick={() => onUpdate(paper.id, { published: !paper.published })}
          >
            {paper.published ? '下线' : '发布'}
          </button>
          <button
            className="btn btn-secondary text-xs text-red-600 hover:bg-red-50"
            onClick={() => onDelete(paper.id)}
          >
            删除
          </button>
        </div>
        {showVersions && versions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">版本历史：</p>
            <div className="space-y-1">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    v{v.version} - {v.title}
                    {v.published && <span className="ml-1 text-emerald-600">(已发布)</span>}
                  </span>
                  <span>{new Date(v.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PaperCreator({
  wizard,
  setWizard,
  picked,
  manualSelected,
  setManualSelected,
  randomMutation,
  createMutation,
  createMode,
  setCreateMode,
  toggleType,
}: {
  wizard: WizardState
  setWizard: (w: WizardState | ((prev: WizardState) => WizardState)) => void
  picked: QuestionItem[]
  manualSelected: Record<string, { question: QuestionItem; score: number }>
  setManualSelected: Dispatch<
    SetStateAction<Record<string, { question: QuestionItem; score: number }>>
  >
  randomMutation: any
  createMutation: any
  createMode: 'random' | 'manual'
  setCreateMode: (m: 'random' | 'manual') => void
  toggleType: (type: QuestionType) => void
}) {
  const [manualMessage, setManualMessage] = useState<string | null>(null)

  const { data: availableQuestions = [], isFetching: questionLoading, refetch } = useQuery({
    queryKey: ['question-list-for-manual'],
    queryFn: () => listQuestions({}),
    enabled: createMode === 'manual',
  })

  const handleToggleSelect = (q: QuestionItem) => {
    setManualSelected((prev) => {
      const next = { ...prev }
      if (next[q.id]) {
        delete next[q.id]
      } else {
        next[q.id] = { question: q, score: 1 }
      }
      return next
    })
  }

  const handleScoreChange = (id: string, value: number) => {
    setManualSelected((prev) => ({
      ...prev,
      [id]: { ...prev[id], score: value },
    }))
  }

  const handleCreateManual = async () => {
    if (Object.keys(manualSelected).length === 0) {
      setManualMessage('请先选择题目')
      return
    }
    setManualMessage(null)
    try {
      await createPaperManual({
        title: wizard.title,
        subject: wizard.subject,
        grade: wizard.grade,
        durationMinutes: wizard.duration,
        startTime: wizard.startTime,
        endTime: wizard.endTime,
        selections: Object.values(manualSelected).map((item) => ({
          question_id: item.question.id,
          score: item.score || 1,
        })),
      })
      setManualMessage('创建成功')
      setManualSelected({})
      setWizard(defaultWizard)
      setCreateMode('random')
    } catch (e: any) {
      setManualMessage(e?.message || '创建失败')
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          className={`btn ${createMode === 'random' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCreateMode('random')}
        >
          随机组卷
        </button>
        <button
          className={`btn ${createMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCreateMode('manual')}
        >
          手动组卷
        </button>
      </div>

      <div className="card space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs text-slate-600">试卷标题</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={wizard.title}
              onChange={(e) => setWizard((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-600">学科</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={wizard.subject}
              onChange={(e) => setWizard((p) => ({ ...p, subject: e.target.value }))}
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
          <div className="space-y-2">
            <label className="text-xs text-slate-600">年级</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={wizard.grade}
              onChange={(e) => setWizard((p) => ({ ...p, grade: e.target.value }))}
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
          <div className="space-y-2">
            <label className="text-xs text-slate-600">时长（分钟）</label>
            <input
              type="number"
              min={10}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={wizard.duration}
              onChange={(e) => setWizard((p) => ({ ...p, duration: Number(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-600">开始时间（可选）</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              value={wizard.startTime || ''}
              onChange={(e) => setWizard((p) => ({ ...p, startTime: e.target.value || undefined }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-600">结束时间（可选）</label>
            <input
              type="datetime-local"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              value={wizard.endTime || ''}
              onChange={(e) => setWizard((p) => ({ ...p, endTime: e.target.value || undefined }))}
            />
          </div>
          {createMode === 'random' && (
            <>
              <div className="space-y-2">
                <label className="text-xs text-slate-600">抽题数量</label>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={wizard.limit}
                  onChange={(e) => setWizard((p) => ({ ...p, limit: Number(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-600">难度（可选）</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={wizard.difficulty ?? ''}
                  onChange={(e) =>
                    setWizard((p) => ({
                      ...p,
                      difficulty: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">题型</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['single', '单选'],
                ['multiple', '多选'],
                ['true_false', '判断'],
                ['fill', '填空'],
                ['short', '简答'],
              ] as [QuestionType, string][]
            ).map(([value, label]) => {
              const active = wizard.types.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleType(value)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {createMode === 'random' ? (
        <>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => randomMutation.mutate(undefined)}
              disabled={randomMutation.status === 'pending'}
            >
              {randomMutation.status === 'pending' ? '抽题中...' : '随机抽题'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => createMutation.mutate(undefined)}
              disabled={!picked.length || createMutation.status === 'pending' || !isSupabaseReady}
            >
              {createMutation.status === 'pending' ? '创建中...' : '创建试卷'}
            </button>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">抽取结果</h2>
              <span className="text-xs text-slate-500">共 {picked.length} 题</span>
            </div>
            {picked.length === 0 ? (
              <div className="text-sm text-slate-600">还未抽题，点击“随机抽题”生成。</div>
            ) : (
              picked.map((q, idx) => (
                <div key={q.id} className="card space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>题目 {idx + 1}</span>
                    <span>
                      {q.subject} · {q.grade || '未分年级'} · 难度 {q.difficulty}
                    </span>
                  </div>
                  <QuestionPreview question={q as any} />
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">从题库选择</h2>
              <button className="btn btn-secondary text-xs" onClick={() => refetch()}>
                刷新
              </button>
            </div>
            <span className="text-xs text-slate-500">已选 {Object.keys(manualSelected).length} 题</span>
          </div>

          {manualMessage && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                manualMessage.includes('成功')
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {manualMessage}
            </div>
          )}

          {questionLoading ? (
            <div className="card">
              <p className="text-sm text-slate-600">加载题库中...</p>
            </div>
          ) : availableQuestions.length === 0 ? (
            <div className="card">
              <p className="text-sm text-slate-600">题库为空，请先导入或创建题目。</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableQuestions.map((q) => {
                const selected = manualSelected[q.id]
                return (
                  <div key={q.id} className={`card space-y-2 ${selected ? 'ring-1 ring-brand-100' : ''}`}>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => handleToggleSelect(q)}
                          className="h-4 w-4"
                        />
                        <span>
                          {q.subject} · {q.grade || '未分年级'} · 难度 {q.difficulty} · {q.type}
                        </span>
                      </div>
                      {selected && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600">分值</span>
                          <input
                            type="number"
                            min={0.5}
                            step={0.5}
                            className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
                            value={selected.score}
                            onChange={(e) => handleScoreChange(q.id, Number(e.target.value) || 0)}
                          />
                        </div>
                      )}
                    </div>
                    <QuestionPreview question={q as any} />
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button className="btn btn-primary" onClick={handleCreateManual}>
              创建试卷
            </button>
          </div>
        </div>
      )}
    </>
  )
}
