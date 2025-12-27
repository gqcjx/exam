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
import { getSchools, getGrades, getClasses, type School, type Grade, type Class } from '../api/config'

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
  const [importResult, setImportResult] = useState<{
    success: number
    failed: number
    errors: string[]
  } | null>(null)

  // 权限检查：只有管理员或班主任可以导入
  const canImport = profile?.role === 'admin' || (profile?.role === 'teacher' && profile?.user_id)

  // 获取学校列表
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ['schools'],
    queryFn: () => getSchools(true),
  })

  // 获取年级列表
  const { data: grades = [] } = useQuery<Grade[]>({
    queryKey: ['grades'],
    queryFn: () => getGrades(true),
    enabled: !!selectedSchoolId,
  })

  // 获取班级列表
  const { data: classes = [] } = useQuery<Class[]>({
    queryKey: ['classes', selectedSchoolId, selectedGradeId],
    queryFn: () => getClasses(selectedSchoolId, selectedGradeId),
    enabled: !!selectedSchoolId && !!selectedGradeId,
  })

  // 获取当前用户管理的班级（如果是班主任）
  const { data: currentUserClassIds = [] } = useQuery<string[]>({
    queryKey: ['teacher-classes', profile?.user_id],
    queryFn: () => (profile?.user_id ? getTeacherClassIds(profile.user_id) : Promise.resolve([])),
    enabled: !!(profile?.user_id && profile?.role === 'teacher'),
  })

  // 获取导入历史
  const { data: importHistory = [] } = useQuery<any[]>({
    queryKey: ['import-history'],
    queryFn: () => getImportHistory(10),
    enabled: !!canImport,
  })

  const importMutation = useMutation({
    mutationFn: ({ students, fileName }: { students: StudentImportRow[]; fileName: string }) => {
      return batchImportStudents(
        students,
        profile?.user_id,
        profile?.role || undefined,
        (profile as any)?.school_id || undefined,
        currentUserClassIds && currentUserClassIds.length > 0 ? currentUserClassIds : undefined,
        fileName,
        (current, total) => {
          setImportProgress({ current, total })
        },
      )
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['import-history'] })
      setImportResult(result)
      setMessage({
        type: result.failed > 0 ? 'error' : 'success',
        text: `导入完成！成功 ${result.success} 个，失败 ${result.failed} 个${
          result.errors.length > 0 ? `\n\n错误详情（前10条）：\n${result.errors.slice(0, 10).join('\n')}` : ''
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
      
      // 验证数据
      if (students.length === 0) {
        setMessage({
          type: 'error',
          text: 'Excel文件中没有有效的学生数据，请检查文件格式',
        })
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      if (students.length > 6000) {
        setMessage({
          type: 'error',
          text: `导入数量不能超过 6000 条，当前文件包含 ${students.length} 条数据。请分批导入或减少数据量。`,
        })
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      // 检查必填字段
      const missingNameCount = students.filter((s) => !s.name || !s.name.trim()).length
      if (missingNameCount > 0) {
        setMessage({
          type: 'error',
          text: `有 ${missingNameCount} 条数据缺少姓名（必填字段），请补充后重新上传`,
        })
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        return
      }

      setPreviewData(students)
      setFileName(file.name)
      setMessage({
        type: 'success',
        text: `成功解析 ${students.length} 条数据，请检查预览后开始导入`,
      })
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || '解析文件失败，请检查文件格式是否正确。确保文件是 Excel 格式（.xlsx 或 .xls），且包含"姓名"列。',
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
      <div className="rounded-xl bg-gradient-to-r from-brand-50 to-blue-50 p-6 ring-1 ring-brand-200/50">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">批量导入学生</h1>
            <p className="mt-2 text-sm text-slate-600">
              支持 Excel 格式文件，可以批量导入学生账号。管理员可以导入所有学校的学生，班主任只能导入自己管理的班级的学生。
              <br />
              <span className="font-medium text-slate-700">
                单次导入上限：6000 条。姓名和邮箱为必填项（邮箱示例：gqc@gfce.com）。已存在的学生（通过邮箱或手机号判断）将被跳过，同班同名将自动添加后缀（A, AA, AAA...）。
              </span>
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="ml-4 flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-brand-700 hover:to-brand-800 hover:shadow-lg"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            下载导入模板
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-4 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {message.type === 'success' ? (
              <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <p className="text-sm whitespace-pre-line flex-1">{message.text}</p>
          </div>
        </div>
      )}

      {/* 导入进度 */}
      {importProgress && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">导入进度</span>
            <span className="text-slate-600">
              {importProgress.current} / {importProgress.total} ({Math.round((importProgress.current / importProgress.total) * 100)}%)
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

      {/* 导入结果详情 */}
      {importResult && !importProgress && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">导入结果详情</h3>
            <button
              onClick={() => setImportResult(null)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              关闭
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-600 mb-1">总数</div>
              <div className="text-2xl font-bold text-slate-900">{importResult.success + importResult.failed}</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4">
              <div className="text-sm text-emerald-600 mb-1">成功</div>
              <div className="text-2xl font-bold text-emerald-700">{importResult.success}</div>
            </div>
            <div className="rounded-lg bg-red-50 p-4">
              <div className="text-sm text-red-600 mb-1">失败</div>
              <div className="text-2xl font-bold text-red-700">{importResult.failed}</div>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                错误详情 ({importResult.errors.length} 条)
              </h4>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                <div className="divide-y divide-slate-100">
                  {importResult.errors.map((error, index) => (
                    <div key={index} className="px-3 py-2 text-sm text-slate-600">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
            Excel文件格式：姓名（必填）、昵称（可选）、邮箱（必填，示例：gqc@gfce.com）、手机号（可选）、学校（可选）、年级（可选）、班级（可选）、密码（可选）
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
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                数据预览 ({previewData.length} 条)
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                已选择文件：<span className="font-medium text-slate-700">{fileName}</span>
              </p>
            </div>
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

          {/* 数据统计 */}
          <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3 text-xs">
            <div>
              <span className="text-slate-600">有姓名：</span>
              <span className="ml-1 font-semibold text-slate-900">
                {previewData.filter((s) => s.name?.trim()).length}
              </span>
            </div>
            <div>
              <span className="text-slate-600">有邮箱：</span>
              <span className="ml-1 font-semibold text-slate-900">
                {previewData.filter((s) => s.email?.trim()).length}
              </span>
            </div>
            <div>
              <span className="text-slate-600">有手机号：</span>
              <span className="ml-1 font-semibold text-slate-900">
                {previewData.filter((s) => s.phone?.trim()).length}
              </span>
            </div>
            <div>
              <span className="text-slate-600">有学校信息：</span>
              <span className="ml-1 font-semibold text-slate-900">
                {previewData.filter((s) => s.school?.trim() || selectedSchoolId).length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-600">序号</th>
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
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{student.name || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{student.nickname || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{student.email || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{student.phone || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {student.school || (selectedSchoolId ? '（使用默认）' : '-')}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {student.grade || (selectedGradeId ? '（使用默认）' : '-')}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {student.class || (selectedClassId ? '（使用默认）' : '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 20 && (
              <p className="mt-3 text-xs text-slate-500 text-center">
                仅显示前 20 条，共 {previewData.length} 条数据。导入时将处理所有数据。
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
              <strong>邮箱</strong>（必填）：学生邮箱，示例：gqc@gfce.com。已存在的邮箱将被跳过
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
      {importHistory && importHistory.length > 0 && (
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
                {(importHistory as any[]).map((record: any) => (
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
