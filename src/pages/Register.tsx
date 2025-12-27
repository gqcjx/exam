import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, supabaseReady } from '../lib/supabaseClient'
import { verifyInviteCode, useInviteCode } from '../api/inviteCodes'
import { findStudentByEmail } from '../api/students'
import { checkPasswordStrength, getPasswordStrengthText, getPasswordStrengthColor } from '../utils/passwordStrength'

type RegisterType = 'student' | 'parent' | 'teacher'

export default function Register() {
  const navigate = useNavigate()
  const [registerType, setRegisterType] = useState<RegisterType>('student')
  
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [childEmail, setChildEmail] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [verifyingChild, setVerifyingChild] = useState(false)

  // 密码强度检测
  const passwordStrength = checkPasswordStrength(password)
  const passwordMatch = password && confirmPassword ? password === confirmPassword : null

  // 验证邀请码
  const handleVerifyCode = async () => {
    if (!inviteCode.trim()) {
      setError('请输入邀请码')
      return
    }

    setVerifyingCode(true)
    setError(null)

    try {
      const role = registerType === 'teacher' ? 'teacher' : 'admin'
      const isValid = await verifyInviteCode(inviteCode.trim().toUpperCase(), role)
      if (isValid) {
        setError(null)
        setSuccess('邀请码验证成功！')
        setTimeout(() => setSuccess(null), 2000)
      } else {
        setError('邀请码无效或已过期，请检查后重试')
      }
    } catch (err: any) {
      setError(err?.message || '验证邀请码失败')
    } finally {
      setVerifyingCode(false)
    }
  }

  // 验证学生邮箱（家长注册时）
  const handleVerifyChildEmail = async () => {
    if (!childEmail.trim()) {
      setError('请输入孩子邮箱')
      return
    }

    setVerifyingChild(true)
    setError(null)

    try {
      const student = await findStudentByEmail(childEmail.trim())
      if (student) {
        setError(null)
        setSuccess(`找到学生：${student.name || childEmail}`)
        setTimeout(() => setSuccess(null), 2000)
      } else {
        setError('未找到该学生账号，请确认邮箱是否正确')
      }
    } catch (err: any) {
      setError(err?.message || '验证学生邮箱失败')
    } finally {
      setVerifyingChild(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!supabaseReady) {
      setError('Supabase 环境变量未配置。请在项目根目录创建 .env.local 文件，并设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY（使用 anon/public key，不是 service role key）。')
      return
    }

    // 验证姓名或昵称
    if (!name.trim()) {
      setError('请输入姓名或昵称')
      return
    }

    // 验证密码强度
    if (!passwordStrength.meetsRequirements) {
      setError('密码不符合要求：长度6-32个字符，必须包含数字、大小写字母、特殊符号中的至少两种')
      return
    }

    // 验证密码确认
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    // 验证协议同意
    if (!agreedToTerms) {
      setError('请先阅读并同意使用条款和隐私说明')
      return
    }

    // 教师注册需要验证邀请码
    if (registerType === 'teacher') {
      if (!inviteCode.trim()) {
        setError('请输入邀请码')
        return
      }
      const isValid = await verifyInviteCode(inviteCode.trim().toUpperCase(), 'teacher')
      if (!isValid) {
        setError('邀请码无效或已过期')
        return
      }
    }

    // 家长注册时，如果填写了孩子邮箱，需要验证
    if (registerType === 'parent' && childEmail.trim()) {
      const student = await findStudentByEmail(childEmail.trim())
      if (!student) {
        setError('未找到该学生账号，请确认邮箱是否正确')
        return
      }
    }

    setLoading(true)

    try {
      // 生成临时邮箱（用于 Supabase 认证，用户后续可以在设置中修改）
      const tempEmail = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}@temp.local`
      
      // 注册用户（使用临时邮箱，用户后续可以在设置中添加真实邮箱和手机号）
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: tempEmail,
        password,
        options: {
          data: {
            name: name.trim(),
            role: registerType,
            temp_email: true, // 标记为临时邮箱
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (!authData.user) {
        setError('注册失败，请重试')
        setLoading(false)
        return
      }

      // 如果是教师，使用邀请码
      if (registerType === 'teacher') {
        const codeUsed = await useInviteCode(inviteCode.trim().toUpperCase(), authData.user.id)
        if (!codeUsed) {
          setError('使用邀请码失败，请重试')
          setLoading(false)
          return
        }
      }

      // 如果是家长且填写了孩子邮箱，创建绑定关系
      if (registerType === 'parent' && childEmail.trim()) {
        const student = await findStudentByEmail(childEmail.trim())
        if (student) {
          // 等待 profile 创建完成（触发器会自动创建）
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const { error: bindError } = await supabase.from('parent_child').insert({
            parent_id: authData.user.id,
            child_id: student.user_id,
          })

          if (bindError) {
            console.warn('绑定孩子失败，但账号已创建', bindError.message)
            // 不阻止注册成功，只是提示
          }
        }
      }

      setLoading(false)
      setSuccess('注册成功！请前往个人设置完善您的信息（添加手机号、邮箱等）。')
      setTimeout(() => navigate('/settings'), 2000)
    } catch (err: any) {
      setLoading(false)
      setError(err?.message || '注册失败，请重试')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50/30 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo 和标题区域 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-lg">
            <span className="text-2xl font-bold">QF</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">青锋测 - 免费注册</h1>
        </div>

        {/* 注册表单卡片 */}
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200/60">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* 姓名或昵称 */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                <span className="text-brand-600 font-semibold">现在注册，永久免费使用</span>
              </label>
              <input
                type="text"
                placeholder="请输入您的姓名或昵称"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">注册后可在个人设置中添加手机号和邮箱</p>
            </div>

            {/* 密码 */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">密码</label>
              <input
                type="password"
                placeholder="6-32个字符"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                maxLength={32}
              />
              {password && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${getPasswordStrengthColor(passwordStrength.strength)}`}
                        style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      passwordStrength.strength === 'weak' ? 'text-red-600' :
                      passwordStrength.strength === 'medium' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {getPasswordStrengthText(passwordStrength.strength)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    必须使用两种或以上的数字/小写字母/大写字母/其他特殊符号的组合
                  </p>
                  {passwordStrength.feedback.length > 0 && (
                    <ul className="text-xs text-amber-600 list-disc list-inside">
                      {passwordStrength.feedback.map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* 确认密码 */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">确认密码</label>
              <input
                type="password"
                placeholder="再次输入密码"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword && passwordMatch !== null && (
                <p className={`text-xs ${passwordMatch ? 'text-emerald-600' : 'text-red-600'}`}>
                  {passwordMatch ? '✓ 密码匹配' : '✗ 密码不匹配'}
                </p>
              )}
            </div>

            {/* 角色选择 */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">你是？</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={registerType === 'student'}
                    onChange={(e) => setRegisterType(e.target.value as RegisterType)}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-slate-700">学生</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="parent"
                    checked={registerType === 'parent'}
                    onChange={(e) => setRegisterType(e.target.value as RegisterType)}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-slate-700">家长</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="teacher"
                    checked={registerType === 'teacher'}
                    onChange={(e) => setRegisterType(e.target.value as RegisterType)}
                    className="text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-slate-700">老师</span>
                </label>
              </div>
            </div>

            {/* 教师注册：邀请码 */}
            {registerType === 'teacher' && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">邀请码 *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="输入邀请码"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm uppercase focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={verifyingCode || !inviteCode.trim()}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifyingCode ? '验证中...' : '验证'}
                  </button>
                </div>
                <p className="text-xs text-slate-500">请联系管理员获取邀请码</p>
              </div>
            )}

            {/* 家长注册：孩子邮箱（可选） */}
            {registerType === 'parent' && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">孩子邮箱（可选）</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="输入孩子注册邮箱"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    value={childEmail}
                    onChange={(e) => setChildEmail(e.target.value)}
                  />
                  {childEmail.trim() && (
                    <button
                      type="button"
                      onClick={handleVerifyChildEmail}
                      disabled={verifyingChild}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyingChild ? '验证中...' : '验证'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500">输入孩子的注册邮箱进行绑定（可选）</p>
              </div>
            )}

            {/* 协议同意 */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="agree-terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                required
              />
              <label htmlFor="agree-terms" className="text-xs text-slate-600 cursor-pointer">
                点击注册即表明你已阅读过并且同意我们的
                <Link to="/terms" className="text-brand-600 underline hover:text-brand-700">使用条款</Link>
                和
                <Link to="/privacy" className="text-brand-600 underline hover:text-brand-700">隐私说明</Link>
              </label>
            </div>

            {/* 错误和成功提示 */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            {success && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-sm text-emerald-600">{success}</p>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:from-brand-700 hover:to-brand-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  注册中...
                </span>
              ) : (
                '注 册'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              已有账号？
              <Link to="/login" className="ml-1 font-medium text-brand-600 hover:text-brand-700">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
