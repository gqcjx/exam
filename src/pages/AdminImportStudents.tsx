import { useState, useRef } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import {
  batchImportStudents,
  parseExcelFile,
  getTeacherClassIds,
  generateImportTemplate,
  getImportHistory,
  type StudentImportRow,
} from '../api/batchImport'
import { getSchools, getGrades, getClasses } from '../api/config'

export default function AdminImportStudents() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [previewData, setPreviewData] = useState<StudentImportRow[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [defaultPassword, setDefaultPassword] = useState<string>('123456')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)
  const [fileName, setFileName] = useState<string>('')

  // 权限检查：只有管理员或班主任可以导入
  const canImport = profile?.role === 'admin' || (profile?.role === 'teacher' && profile?.user_id)

  // 获取学校列表
  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: getSchools,
  })

  // 获取年级列表
  const { data: grades = [] } = useQuery({
    queryKey: ['grades'],
    queryFn: getGrades,
    enabled: !!selectedSchoolId,
  })

  // 获取班级列表
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', selectedSchoolId, selectedGradeId],
    queryFn: () => getClasses(selectedSchoolId, selectedGradeId),
    enabled: !!selectedSchoolId && !!selectedGradeId,
  })

  // 获取当前用户管理的班级（如果是班主任）
  const { data: currentUserClassIds = [] } = useQuery({
    queryKey: ['teacher-classes', profile?.user_id],
    queryFn: () => (profile?.user_id ? getTeacherClassIds(profile.user_id) : Promise.resolve([])),
    enabled: !!profile?.user_id && profile?.role === 'teacher',
  })

  // 获取导入历史
  const { data: importHistory = [] } = useQuery({
    queryKey: ['import-history'],
    queryFn: () => getImportHistory(10),
    enabled: canImport,
  })

  const importMutation = useMutation({
    mutationFn: ({ students, fileName }: { students: StudentImportRow[]; fileName: string }) => {
      return batchImportStudents(
        students,
        profile?.user_id,
        profile?.role || undefined,
        profile?.school_id || undefined,
        currentUserClassIds && currentUserClassIds.length > 0 ? currentUserClassIds : undefined,
        fileName,
      )
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['import-history'] })
      setMessage({
        type: 'success',
        text: `导入完成！成功 ${result.success} 个，失败 ${result.failed} 个${
          result.errors.length > 0 ? `\n错误详情（前10条）：${result.errors.slice(0, 10).join('; ')}` : ''
        }`,
      })
      setPreviewData([])
      setImportProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    onError: (err: any) => {
      setMessage({
        type: 'error',
        text: err?.message || '导入失败，请重试',
      })
      setImportProgress(null)
    },
  })

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 检查文件大小（限制100MB）
    if (file.size > 100 * 1024 * 1024) {
      setMessage({
        type: 'error',
        text: '文件大小不能超过 100MB',
      })
      return
    }

    // 检查文件类型
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls'].includes(fileExtension || '')) {
      setMessage({
        type: 'error',
        text: '只支持 Excel 格式文件（.xlsx, .xls）',
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // 检查导入数量上限
    try {
      const students = await parseExcelFile(file)
      if (students.length > 6000) {
        setMessage({
          type: 'error',
          text: `导入数量不能超过 6000 条，当前文件包含 ${students.length} 条数据`,
        })
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      setPreviewData(students)
      setFileName(file.name)
      setMessage(null)
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || '解析文件失败',
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleImport = () => {
    if (previewData.length === 0) {
      setMessage({
        type: 'error',
        text: '请先选择并解析Excel文件',
      })
      return
    }

    // 如果选择了默认学校/年级/班级，应用到所有学生
    const studentsToImport = previewData.map((student) => ({
      ...student,
      school_id: selectedSchoolId || student.school_id,
      grade_id: selectedGradeId || student.grade_id,
      class_id: selectedClassId || student.class_id,
      password: student.password || defaultPassword,
    }))

    if (confirm(`确定要导入 ${studentsToImport.length} 个学生吗？\n\n注意：已存在的学生（通过邮箱或手机号判断）将被跳过，同班同名将自动添加后缀（A, AA, AAA...）`)) {
      setImportProgress({ current: 0, total: studentsToImport.length })
      importMutation.mutate({ students: studentsToImport, fileName })
    }
  }

  const handleDownloadTemplate = () => {
    generateImportTemplate()
  }

  if (!canImport) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
          <p className="text-sm text-slate-600">只有管理员和班主任可以批量导入学生。</p>
        </div>
      </div>
    )
  }

  // 检查是否为班主任（教师必须有管理的班级才能导入）
  const isClassTeacher = profile?.role === 'teacher' && currentUserClassIds && currentUserClassIds.length > 0
  const canImportAsTeacher = profile?.role === 'admin' || isClassTeacher

  if (profile?.role === 'teacher' && !isClassTeacher) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
          <p className="text-sm text-slate-600">只有班主任可以批量导入学生，请先配置管理的班级。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">批量导入学生</h1>
          <p className="mt-1 text-sm text-slate-600">
            支持 Excel 格式文件，可以批量导入学生账号。管理员可以导入所有学校的学生，班主任只能导入自己管理的班级的学生。
            <br />
            单次导入上限：6000 条。已存在的学生（通过邮箱或手机号判断）将被跳过，同班同名将自动添加后缀（A, AA, AAA...）。
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50"
        >
          下载模板
        </button>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-4 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <p className="text-sm whitespace-pre-line">{message.text}</p>
        </div>
      )}

      {/* 导入进度 */}
      {importProgress && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">导入进度</span>
            <span className="text-slate-600">
              {importProgress.current} / {importProgress.total}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-brand-600 transition-all duration-300"
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 文件选择和默认设置 */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">选择Excel文件</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
          />
          <p className="mt-2 text-xs text-slate-500">
            Excel文件格式：姓名（必填）、昵称（可选）、邮箱（可选）、手机号（可选）、学校（可选）、年级（可选）、班级（可选）、密码（可选）
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">默认学校</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              value={selectedSchoolId}
              onChange={(e) => {
                setSelectedSchoolId(e.target.value)
                setSelectedGradeId('')
                setSelectedClassId('')
              }}
            >
              <option value="">不设置（使用Excel中的值）</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">默认年级</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50"
              value={selectedGradeId}
              onChange={(e) => {
                setSelectedGradeId(e.target.value)
                setSelectedClassId('')
              }}
              disabled={!selectedSchoolId}
            >
              <option value="">不设置（使用Excel中的值）</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">默认班级</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={!selectedSchoolId || !selectedGradeId}
            >
              <option value="">不设置（使用Excel中的值）</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">默认密码</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            value={defaultPassword}
            onChange={(e) => setDefaultPassword(e.target.value)}
            placeholder="123456"
          />
          <p className="mt-1 text-xs text-slate-500">如果Excel文件中没有指定密码，将使用此默认密码</p>
        </div>
      </div>

      {/* 预览数据 */}
      {previewData.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              预览数据 ({previewData.length} 条)
            </h2>
            <button
              onClick={handleImport}
              disabled={importMutation.isPending || !canImportAsTeacher}
              className="rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-brand-700 hover:to-brand-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  导入中...
                </span>
              ) : (
                '开始导入'
              )}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">姓名</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">昵称</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">邮箱</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">手机号</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">学校</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">年级</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">班级</th>
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 20).map((student, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{student.name}</td>
                    <td className="px-3 py-2 text-slate-600">{student.nickname || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{student.email || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{student.phone || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{student.school || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{student.grade || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{student.class || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 20 && (
              <p className="mt-2 text-xs text-slate-500 text-center">
                仅显示前 20 条，共 {previewData.length} 条数据
              </p>
            )}
          </div>
        </div>
      )}

      {/* Excel格式说明 */}
      <div className="rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200/50">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Excel文件格式说明</h3>
        <div className="text-xs text-slate-600 space-y-2">
          <p>Excel文件第一行为表头，支持以下列名（不区分大小写）：</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>姓名</strong>（必填）：学生的真实姓名。同班同名将自动添加后缀（A, AA, AAA...）
            </li>
            <li>
              <strong>昵称</strong>（可选）：学生昵称
            </li>
            <li>
              <strong>邮箱</strong>（可选）：学生邮箱，如果不提供将自动生成临时邮箱。已存在的邮箱将被跳过
            </li>
            <li>
              <strong>手机号</strong>（可选）：学生手机号。已存在的手机号将被跳过
            </li>
            <li>
              <strong>学校</strong>（可选）：学校名称，需要与系统中配置的学校名称完全匹配
            </li>
            <li>
              <strong>年级</strong>（可选）：年级名称，需要与系统中配置的年级名称完全匹配
            </li>
            <li>
              <strong>班级</strong>（可选）：班级名称，需要与系统中配置的班级名称完全匹配
            </li>
            <li>
              <strong>密码</strong>（可选）：学生登录密码，如果不提供将使用默认密码
            </li>
          </ul>
          <p className="mt-3">
            <strong>注意事项：</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>单次导入数量不能超过 6000 条</li>
            <li>已存在的学生（通过邮箱或手机号判断）将被跳过</li>
            <li>同班同名将自动添加后缀：第一个为"张三"，第二个为"张三A"，第三个为"张三AA"，依此类推</li>
            <li>班主任只能导入自己管理的班级的学生</li>
          </ul>
        </div>
      </div>

      {/* 导入历史 */}
      {importHistory.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">最近导入记录</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">文件名</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">导入时间</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">总数</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">成功</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">失败</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((record: any) => (
                  <tr key={record.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-900">{record.file_name}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {new Date(record.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{record.total_count}</td>
                    <td className="px-3 py-2 text-emerald-600">{record.success_count}</td>
                    <td className="px-3 py-2 text-red-600">{record.failed_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
