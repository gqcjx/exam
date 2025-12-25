import { Link } from 'react-router-dom'

export default function Unauthorized() {
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <h1 className="text-3xl font-bold text-slate-900">无权限访问</h1>
      <p className="text-sm text-slate-600">请使用有权限的账号登录，或联系管理员开通。</p>
      <div className="flex justify-center gap-3">
        <Link to="/dashboard" className="btn btn-secondary">
          返回控制台
        </Link>
        <Link to="/login" className="btn btn-primary">
          重新登录
        </Link>
      </div>
    </div>
  )
}





