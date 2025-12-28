import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllGrades, createGrade, updateGrade, deleteGrade, type Grade } from '../../api/config'

interface GradesManagerProps {
    onMessage: (msg: string) => void
}

export function GradesManager({ onMessage }: GradesManagerProps) {
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
                                            className={`rounded-full px-2 py-1 text-xs font-semibold ${grade.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
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
                                            <button
                                                className="text-sm text-slate-600 hover:text-slate-700"
                                                onClick={() => {
                                                    updateMutation.mutate({ id: grade.id, updates: { enabled: !grade.enabled } })
                                                }}
                                            >
                                                {grade.enabled ? '禁用' : '启用'}
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
    const [level, setLevel] = useState(grade?.level || 0)
    const [displayOrder, setDisplayOrder] = useState(grade?.display_order || 0)

    return (
        <div className="card bg-slate-50 space-y-3 p-4 border border-slate-200 rounded-xl">
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
                    <label className="block text-xs text-slate-600 mb-1">级别</label>
                    <input
                        type="number"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={level}
                        onChange={(e) => setLevel(Number(e.target.value))}
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
