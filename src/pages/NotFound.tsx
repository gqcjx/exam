import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <h1 className="text-3xl font-bold text-slate-900">页面未找到</h1>
      <p className="text-sm text-slate-600">请检查链接，或返回首页/控制台。</p>
      <div className="flex justify-center gap-3">
        <Link to="/" className="btn btn-secondary">
          返回首页
        </Link>
        <Link to="/dashboard" className="btn btn-primary">
          控制台
        </Link>
      </div>
    </div>
  )
}





