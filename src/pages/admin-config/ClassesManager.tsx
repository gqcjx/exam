import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    getAllSchools,
    getAllGrades,
    getClasses,
    createClass,
    updateClass,
    deleteClass,
    type Class,
    type School,
    type Grade,
} from '../../api/config'

interface ClassesManagerProps {
    onMessage: (msg: string) => void
}

export function ClassesManager({ onMessage }: ClassesManagerProps) {
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
                                            className={`rounded-full px-2 py-1 text-xs font-semibold ${classItem.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
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
                                            <button
                                                className="text-sm text-slate-600 hover:text-slate-700"
                                                onClick={() => {
                                                    updateMutation.mutate({ id: classItem.id, updates: { enabled: !classItem.enabled } })
                                                }}
                                            >
                                                {classItem.enabled ? '禁用' : '启用'}
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
        <div className="card bg-slate-50 space-y-3 p-4 border border-slate-200 rounded-xl">
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
