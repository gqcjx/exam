# Exam —— 中小学在线考试平台

响应式考试系统，包含管理员 / 老师 / 学生 / 家长四角色，支持单选、多选、判断、填空、简答等多题型，提供题库管理、组卷、在线答题、自动批改、简答人工阅卷、成绩分析与家长端查看。

## 技术栈
- 前端：React + TypeScript + Vite + Tailwind CSS（简洁统一的视觉体系）
- 数据与认证：Supabase（Auth + Postgres + Storage + Edge Functions）
- 数据获取：TanStack Query
- 移动端：Capacitor 打包安卓
- 部署：GitHub Pages（可绑定自定义域）

## 本地开发
```bash
pnpm install # 或 npm install
npm run dev
```

需要在根目录创建 `.env`（或在构建环境变量中配置）：
```
VITE_SUPABASE_URL=你的supabase项目url
VITE_SUPABASE_ANON_KEY=你的anon key
```

## 目录说明
- `src/App.tsx`：落地的简洁风格首页与模块概览
- `src/lib/supabaseClient.ts`：Supabase 客户端初始化（依赖 env）
- `supabase/schema.sql`：数据库表结构与索引草案
- `supabase/functions/import-questions/`：题库导入 Edge Function 示例
- `supabase/policies.sql`：RLS 策略示例（profiles/questions/papers/answers/parent_child）
- `supabase/rpc.sql`：随机抽题函数 fn_random_questions
- `src/context/AuthContext.tsx` + `ProtectedRoute`：登录/角色守卫
- `src/api/questions.ts`：题库查询（Supabase 可用时自动切换，缺省回退示例数据）

后续计划：
- 补充路由与角色守卫（管理员/老师/学生/家长）
- 题库、组卷、答题、批改、成绩分析等页面与组件（已搭骨架，待接数据）
- Edge Functions：批量导入题库、导出报表、复杂判分/模糊匹配
-- Supabase：应用 schema.sql + policies.sql + rpc.sql，配置环境变量后前端自动切换真实数据
