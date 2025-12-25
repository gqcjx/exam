import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAllSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getAllGrades,
  createGrade,
  updateGrade,
  deleteGrade,
  getAllSchools,
  createSchool,
  updateSchool,
  deleteSchool,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  type Subject,
  type Grade,
  type School,
  type Class,
} from '../api/config'
import { useAuth } from '../context/AuthContext'
import { isSupabaseReady } from '../lib/env'

export default function AdminConfig() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'subjects' | 'grades' | 'schools' | 'classes'>('subjects')
  const [message, setMessage] = useState<string | null>(null)

  if (!isSupabaseReady) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">系统配置</h1>
        <div className="card">
          <p className="text-sm text-amber-700">Supabase 未配置，无法使用此功能</p>
        </div>
      </div>
    )
  }

  if (profile?.role !== 'admin' && profile?.role !== 'teacher') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">系统配置</h1>
        <div className="card">
          <p className="text-sm text-slate-600">仅管理员和教师可访问系统配置。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">系统配置</h1>
        <p className="text-sm text-slate-600">管理学科、年级、学校和班级信息</p>
      </div>

      {message && (
        <div className="card bg-emerald-50 border-emerald-200">
          <p className="text-sm text-emerald-800">{message}</p>
        </div>
      )}

      {/* 标签页 */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'subjects'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('subjects')}
        >
          学科管理
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'grades'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('grades')}
        >
          年级管理
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'schools'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('schools')}
        >
          学校管理
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'classes'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('classes')}
        >
          班级管理
        </button>
      </div>

      {/* 内容区域 */}
      <div className="card">
        {activeTab === 'subjects' && (
          <SubjectsManager
            onMessage={(msg) => {
              setMessage(msg)
              setTimeout(() => setMessage(null), 3000)
            }}
          />
        )}
        {activeTab === 'grades' && (
          <GradesManager
            onMessage={(msg) => {
              setMessage(msg)
              setTimeout(() => setMessage(null), 3000)
            }}
          />
        )}
        {activeTab === 'schools' && (
          <SchoolsManager
            onMessage={(msg) => {
              setMessage(msg)
              setTimeout(() => setMessage(null), 3000)
            }}
          />
        )}
        {activeTab === 'classes' && (
          <ClassesManager
            onMessage={(msg) => {
              setMessage(msg)
              setTimeout(() => setMessage(null), 3000)
            }}
          />
        )}
      </div>
    </div>
  )
}

// 学科管理组件
function SubjectsManager({ onMessage }: { onMessage: (msg: string) => void }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['all-subjects'],
    queryFn: getAllSubjects,
  })

  const createMutation = useMutation({
    mutationFn: createSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-subjects'] })
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      setShowForm(false)
      onMessage('创建成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Subject> }) =>
      updateSubject(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-subjects'] })
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      setEditing(null)
      onMessage('更新成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-subjects'] })
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      onMessage('删除成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '删除失败')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">学科管理</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
        >
          添加学科
        </button>
      </div>

      {showForm && (
        <SubjectForm
          subject={editing}
          onSubmit={(data) => {
            if (editing) {
              updateMutation.mutate({ id: editing.id, updates: data })
            } else {
              createMutation.mutate(data)
            }
          }}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-slate-600">加载中...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">学科名称</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">代码</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">显示顺序</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">状态</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {subjects.map((subject) => (
                <tr key={subject.id}>
                  <td className="px-4 py-3 text-sm text-slate-900">{subject.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{subject.code || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{subject.display_order}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        subject.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {subject.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="text-sm text-brand-600 hover:text-brand-700"
                        onClick={() => {
                          setEditing(subject)
                          setShowForm(true)
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className="text-sm text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm(`确定要删除学科"${subject.name}"吗？`)) {
                            deleteMutation.mutate(subject.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// 学科表单组件
function SubjectForm({
  subject,
  onSubmit,
  onCancel,
  isLoading,
}: {
  subject: Subject | null
  onSubmit: (data: { name: string; code?: string; display_order?: number }) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [name, setName] = useState(subject?.name || '')
  const [code, setCode] = useState(subject?.code || '')
  const [displayOrder, setDisplayOrder] = useState(subject?.display_order || 0)

  return (
    <div className="card bg-slate-50 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">{subject ? '编辑学科' : '添加学科'}</h3>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-600 mb-1">学科名称 *</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">代码</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">显示顺序</label>
          <input
            type="number"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onSubmit({ name, code: code || undefined, display_order: displayOrder })}
          disabled={isLoading || !name.trim()}
        >
          {subject ? '更新' : '创建'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={isLoading}>
          取消
        </button>
      </div>
    </div>
  )
}

// 年级管理组件
function GradesManager({ onMessage }: { onMessage: (msg: string) => void }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Grade | null>(null)

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['all-grades'],
    queryFn: getAllGrades,
  })

  const createMutation = useMutation({
    mutationFn: createGrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-grades'] })
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      setShowForm(false)
      onMessage('创建成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Grade> }) => updateGrade(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-grades'] })
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      setEditing(null)
      onMessage('更新成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteGrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-grades'] })
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      onMessage('删除成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '删除失败')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">年级管理</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
        >
          添加年级
        </button>
      </div>

      {showForm && (
        <GradeForm
          grade={editing}
          onSubmit={(data) => {
            if (editing) {
              updateMutation.mutate({ id: editing.id, updates: data })
            } else {
              createMutation.mutate(data)
            }
          }}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-slate-600">加载中...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">年级名称</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">代码</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">级别</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">显示顺序</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">状态</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {grades.map((grade) => (
                <tr key={grade.id}>
                  <td className="px-4 py-3 text-sm text-slate-900">{grade.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{grade.code || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{grade.level || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{grade.display_order}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        grade.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {grade.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="text-sm text-brand-600 hover:text-brand-700"
                        onClick={() => {
                          setEditing(grade)
                          setShowForm(true)
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className="text-sm text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm(`确定要删除年级"${grade.name}"吗？`)) {
                            deleteMutation.mutate(grade.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// 年级表单组件
function GradeForm({
  grade,
  onSubmit,
  onCancel,
  isLoading,
}: {
  grade: Grade | null
  onSubmit: (data: { name: string; code?: string; level?: number; display_order?: number }) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [name, setName] = useState(grade?.name || '')
  const [code, setCode] = useState(grade?.code || '')
  const [level, setLevel] = useState(grade?.level || undefined)
  const [displayOrder, setDisplayOrder] = useState(grade?.display_order || 0)

  return (
    <div className="card bg-slate-50 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">{grade ? '编辑年级' : '添加年级'}</h3>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-slate-600 mb-1">年级名称 *</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">代码</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">级别 (1-12)</label>
          <input
            type="number"
            min={1}
            max={12}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={level || ''}
            onChange={(e) => setLevel(e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">显示顺序</label>
          <input
            type="number"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onSubmit({ name, code: code || undefined, level, display_order: displayOrder })}
          disabled={isLoading || !name.trim()}
        >
          {grade ? '更新' : '创建'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={isLoading}>
          取消
        </button>
      </div>
    </div>
  )
}

// 学校管理组件
function SchoolsManager({ onMessage }: { onMessage: (msg: string) => void }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<School | null>(null)

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['all-schools'],
    queryFn: getAllSchools,
  })

  const createMutation = useMutation({
    mutationFn: createSchool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-schools'] })
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      setShowForm(false)
      onMessage('创建成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<School> }) => updateSchool(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-schools'] })
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      setEditing(null)
      onMessage('更新成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSchool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-schools'] })
      queryClient.invalidateQueries({ queryKey: ['schools'] })
      onMessage('删除成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '删除失败')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">学校管理</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
        >
          添加学校
        </button>
      </div>

      {showForm && (
        <SchoolForm
          school={editing}
          onSubmit={(data) => {
            if (editing) {
              updateMutation.mutate({ id: editing.id, updates: data })
            } else {
              createMutation.mutate(data)
            }
          }}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-slate-600">加载中...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">学校名称</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">代码</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">地址</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">联系电话</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">状态</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {schools.map((school) => (
                <tr key={school.id}>
                  <td className="px-4 py-3 text-sm text-slate-900">{school.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{school.code || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{school.address || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{school.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        school.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {school.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="text-sm text-brand-600 hover:text-brand-700"
                        onClick={() => {
                          setEditing(school)
                          setShowForm(true)
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className="text-sm text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm(`确定要删除学校"${school.name}"吗？`)) {
                            deleteMutation.mutate(school.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// 学校表单组件
function SchoolForm({
  school,
  onSubmit,
  onCancel,
  isLoading,
}: {
  school: School | null
  onSubmit: (data: { name: string; code?: string; address?: string; phone?: string }) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [name, setName] = useState(school?.name || '')
  const [code, setCode] = useState(school?.code || '')
  const [address, setAddress] = useState(school?.address || '')
  const [phone, setPhone] = useState(school?.phone || '')

  return (
    <div className="card bg-slate-50 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">{school ? '编辑学校' : '添加学校'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-600 mb-1">学校名称 *</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">代码</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">地址</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">联系电话</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onSubmit({ name, code: code || undefined, address: address || undefined, phone: phone || undefined })}
          disabled={isLoading || !name.trim()}
        >
          {school ? '更新' : '创建'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={isLoading}>
          取消
        </button>
      </div>
    </div>
  )
}

// 班级管理组件
function ClassesManager({ onMessage }: { onMessage: (msg: string) => void }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Class | null>(null)

  const { data: schools = [] } = useQuery({
    queryKey: ['all-schools'],
    queryFn: getAllSchools,
  })

  const { data: grades = [] } = useQuery({
    queryKey: ['all-grades'],
    queryFn: getAllGrades,
  })

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => getClasses(undefined, undefined, false),
  })

  const createMutation = useMutation({
    mutationFn: createClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      setShowForm(false)
      onMessage('创建成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '创建失败')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Class> }) => updateClass(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      setEditing(null)
      onMessage('更新成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '更新失败')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      onMessage('删除成功')
    },
    onError: (err: any) => {
      onMessage(err?.message || '删除失败')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">班级管理</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
        >
          添加班级
        </button>
      </div>

      {showForm && (
        <ClassForm
          classData={editing}
          schools={schools}
          grades={grades}
          onSubmit={(data) => {
            if (editing) {
              updateMutation.mutate({ id: editing.id, updates: data })
            } else {
              createMutation.mutate(data)
            }
          }}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-slate-600">加载中...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">学校</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">年级</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">班级名称</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">代码</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">状态</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {classes.map((classItem) => (
                <tr key={classItem.id}>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {(classItem.school as any)?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {(classItem.grade as any)?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">{classItem.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{classItem.code || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        classItem.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {classItem.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="text-sm text-brand-600 hover:text-brand-700"
                        onClick={() => {
                          setEditing(classItem)
                          setShowForm(true)
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className="text-sm text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm(`确定要删除班级"${classItem.name}"吗？`)) {
                            deleteMutation.mutate(classItem.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// 班级表单组件
function ClassForm({
  classData,
  schools,
  grades,
  onSubmit,
  onCancel,
  isLoading,
}: {
  classData: Class | null
  schools: School[]
  grades: Grade[]
  onSubmit: (data: { school_id: string; grade_id: string; name: string; code?: string }) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [schoolId, setSchoolId] = useState(classData?.school_id || '')
  const [gradeId, setGradeId] = useState(classData?.grade_id || '')
  const [name, setName] = useState(classData?.name || '')
  const [code, setCode] = useState(classData?.code || '')

  return (
    <div className="card bg-slate-50 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">{classData ? '编辑班级' : '添加班级'}</h3>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-slate-600 mb-1">学校 *</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            required
          >
            <option value="">选择学校</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">年级 *</label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            required
          >
            <option value="">选择年级</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">班级名称 *</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">代码</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onSubmit({ school_id: schoolId, grade_id: gradeId, name, code: code || undefined })}
          disabled={isLoading || !name.trim() || !schoolId || !gradeId}
        >
          {classData ? '更新' : '创建'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={isLoading}>
          取消
        </button>
      </div>
    </div>
  )
}

